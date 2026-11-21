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
from app.schemas import OAuthExchangeRequest, OAuthProviders, Token, UserOut, UserRegister, UserUpdate
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
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
    return user


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
    return Token(access_token=create_access_token(str(user.id)))


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
