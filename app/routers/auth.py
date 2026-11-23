from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_active_user
from app.models import User
from app.oauth import (
    OAuthFlowError,
    authorization_url,
    create_oauth_code,
    create_oauth_state,
    enabled_providers,
    fetch_oauth_profile,
    provider_configured,
    read_oauth_code,
    read_oauth_state,
    resolve_oauth_user,
    safe_next_path,
)
from app.email import send_password_reset_email, send_verification_email
from app.models import utcnow
from app.schemas import (
    EmailVerificationRequest,
    ForgotPasswordRequest,
    OAuthExchangeRequest,
    OAuthProviders,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    Token,
    UserOut,
    UserRegister,
    UserUpdate,
)
from app.security import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_email_verification_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_email_verification_token(user.id)
    try:
        sent = send_verification_email(user.email, user.full_name, token)
    except Exception:
        db.delete(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send confirmation email. Please try again later.",
        )

    if not sent and settings.environment != "production":
        user.email_verified_at = utcnow()
        db.add(user)
        db.commit()

    return RegisterResponse(
        message=(
            "Account created. You can now log in."
            if user.email_verified_at is not None
            else "Account created. Please check your email to confirm your account."
        ),
        email=user.email,
    )


@router.post("/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.email == form.username.strip().lower()))
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account")
    if user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please confirm your email address before logging in.",
        )
    return Token(access_token=create_access_token(str(user.id)))


@router.post("/verify-email")
def verify_email(payload: EmailVerificationRequest, db: Session = Depends(get_db)):
    user_id = decode_email_verification_token(payload.token)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
        db.add(user)
        db.commit()
    return {"message": "Email confirmed. You can now log in."}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or user.email_verified_at is not None or not user.is_active:
        return {"message": "If an unconfirmed account exists, a confirmation email has been sent."}
    token = create_email_verification_token(user.id)
    try:
        send_verification_email(user.email, user.full_name, token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send confirmation email. Please try again later.",
        )
    return {"message": "If an unconfirmed account exists, a confirmation email has been sent."}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    generic = {"message": "If an account exists for that email, a password reset link has been sent."}
    if user is None or not user.is_active:
        return generic
    token = create_password_reset_token(user.id)
    try:
        sent = send_password_reset_email(user.email, user.full_name, token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send password reset email. Please try again later.",
        )
    if not sent and settings.environment != "production":
        return {"message": "SMTP is not configured. Password reset email was not sent in this environment."}
    return generic


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user_id = decode_password_reset_token(payload.token)
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset link")
    user.hashed_password = hash_password(payload.password)
    db.add(user)
    db.commit()
    return {"message": "Password reset successful. You can now log in."}


def _frontend_redirect(**params: str) -> RedirectResponse:
    base = settings.frontend_url.rstrip("/")
    return RedirectResponse(f"{base}/auth/callback?{urlencode(params)}")


@router.get("/oauth/providers", response_model=OAuthProviders)
def oauth_providers():
    return enabled_providers()


@router.get("/oauth/{provider}/start")
def oauth_start(
    provider: str,
    next: str = Query(default="/dashboard", max_length=500),
):
    if provider not in {"google", "facebook"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
    if not provider_configured(provider):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="This sign-in provider is not configured",
        )
    state = create_oauth_state(provider, safe_next_path(next))
    try:
        url = authorization_url(provider, state)
    except OAuthFlowError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="This sign-in provider is not configured",
        ) from exc
    return RedirectResponse(url)


@router.get("/oauth/{provider}/callback")
def oauth_callback(
    provider: str,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if provider not in {"google", "facebook"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
    if not provider_configured(provider):
        return _frontend_redirect(error="provider_unavailable")
    if error:
        return _frontend_redirect(
            error="cancelled" if error == "access_denied" else "oauth_failed"
        )
    if not code or not state:
        return _frontend_redirect(error="oauth_failed")
    try:
        next_path = read_oauth_state(state, provider)
    except HTTPException:
        return _frontend_redirect(error="invalid_state")
    try:
        profile = fetch_oauth_profile(provider, code)
        user = resolve_oauth_user(db, provider, profile)
    except OAuthFlowError as exc:
        return _frontend_redirect(error=exc.code)
    exchange_code = create_oauth_code(user.id)
    return _frontend_redirect(code=exchange_code, next=next_path)


@router.post("/oauth/exchange", response_model=Token)
def oauth_exchange(
    payload: OAuthExchangeRequest,
    db: Session = Depends(get_db),
):
    user = db.get(User, read_oauth_code(payload.code))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired sign-in code",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account")
    return Token(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserOut)
def read_me(user: User = Depends(get_current_active_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="full_name cannot be null"
        )
    if "full_name" in data:
        data["full_name"] = data["full_name"].strip()
    password = data.pop("password", None)
    for field, value in data.items():
        setattr(user, field, value)
    if password:
        user.hashed_password = hash_password(password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
