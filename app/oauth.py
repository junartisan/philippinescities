from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User, UserRole, utcnow
from app.security import hash_password

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
FACEBOOK_DIALOG_URL = "https://www.facebook.com/{version}/dialog/oauth"
FACEBOOK_TOKEN_URL = "https://graph.facebook.com/{version}/oauth/access_token"
FACEBOOK_USERINFO_URL = "https://graph.facebook.com/{version}/me"


@dataclass(frozen=True)
class OAuthProfile:
    provider_id: str
    email: str | None
    full_name: str
    avatar_url: str | None


class OAuthFlowError(Exception):
    def __init__(self, code: str = "oauth_failed") -> None:
        self.code = code
        super().__init__(code)


def provider_configured(provider: str) -> bool:
    if provider == "google":
        return bool(settings.google_client_id and settings.google_client_secret)
    if provider == "facebook":
        return bool(settings.facebook_app_id and settings.facebook_app_secret)
    return False


def enabled_providers() -> dict[str, bool]:
    return {
        "google": provider_configured("google"),
        "facebook": provider_configured("facebook"),
    }


def safe_next_path(value: object) -> str:
    if not isinstance(value, str):
        return "/dashboard"
    value = value.strip()
    if not value.startswith("/") or value.startswith("//") or "\\" in value:
        return "/dashboard"
    return value[:500]


def _provider_redirect_uri(provider: str) -> str:
    base = settings.backend_url.rstrip("/")
    return f"{base}{settings.api_prefix}/auth/oauth/{provider}/callback"


def _encode_scoped_token(payload: dict, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    data = {**payload, "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(data, settings.secret_key, algorithm=settings.algorithm)


def _decode_scoped_token(token: str, purpose: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired sign-in request",
        ) from exc
    if payload.get("purpose") != purpose:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid sign-in request",
        )
    return payload


def create_oauth_state(provider: str, next_path: str) -> str:
    return _encode_scoped_token(
        {
            "purpose": "oauth_state",
            "provider": provider,
            "next": safe_next_path(next_path),
        },
        minutes=10,
    )


def read_oauth_state(state: str, provider: str) -> str:
    payload = _decode_scoped_token(state, "oauth_state")
    if payload.get("provider") != provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid sign-in request",
        )
    return safe_next_path(payload.get("next"))


def create_oauth_code(user_id: int) -> str:
    return _encode_scoped_token(
        {"purpose": "oauth_exchange", "sub": str(user_id)},
        minutes=5,
    )


def read_oauth_code(code: str) -> int:
    try:
        payload = _decode_scoped_token(code, "oauth_exchange")
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError, HTTPException) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired sign-in code",
        ) from exc


def authorization_url(provider: str, state: str) -> str:
    redirect_uri = _provider_redirect_uri(provider)
    if provider == "google":
        query = urlencode(
            {
                "client_id": settings.google_client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "prompt": "select_account",
            }
        )
        return f"{GOOGLE_AUTH_URL}?{query}"
    if provider == "facebook":
        query = urlencode(
            {
                "client_id": settings.facebook_app_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "email,public_profile",
                "state": state,
            }
        )
        return f"{FACEBOOK_DIALOG_URL.format(version=settings.facebook_graph_version)}?{query}"
    raise OAuthFlowError("provider_unavailable")


def _clean_name(value: object, email: str) -> str:
    name = str(value or "").strip()[:120]
    if len(name) < 2:
        name = email.split("@", 1)[0].strip()[:120]
    return name if len(name) >= 2 else "Member"


def _google_profile(code: str) -> OAuthProfile:
    try:
        with httpx.Client(timeout=15) as client:
            token_response = client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": _provider_redirect_uri("google"),
                },
            )
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            if not access_token:
                raise OAuthFlowError()
            userinfo_response = client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            userinfo_response.raise_for_status()
            data = userinfo_response.json()
    except OAuthFlowError:
        raise
    except (httpx.HTTPError, ValueError, TypeError, KeyError, AttributeError) as exc:
        raise OAuthFlowError() from exc

    provider_id = str(data.get("sub") or "").strip()[:255]
    email = str(data.get("email") or "").strip().lower()
    if not provider_id or not email or data.get("email_verified") is not True:
        raise OAuthFlowError("email_required")
    avatar_url = str(data.get("picture") or "").strip()[:500] or None
    return OAuthProfile(
        provider_id=provider_id,
        email=email,
        full_name=_clean_name(data.get("name"), email),
        avatar_url=avatar_url,
    )


def _facebook_profile(code: str) -> OAuthProfile:
    version = settings.facebook_graph_version
    try:
        with httpx.Client(timeout=15) as client:
            token_response = client.get(
                FACEBOOK_TOKEN_URL.format(version=version),
                params={
                    "client_id": settings.facebook_app_id,
                    "client_secret": settings.facebook_app_secret,
                    "redirect_uri": _provider_redirect_uri("facebook"),
                    "code": code,
                },
            )
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            if not access_token:
                raise OAuthFlowError()
            userinfo_response = client.get(
                FACEBOOK_USERINFO_URL.format(version=version),
                params={
                    "fields": "id,name,email,picture.type(large)",
                    "access_token": access_token,
                },
            )
            userinfo_response.raise_for_status()
            data = userinfo_response.json()
    except OAuthFlowError:
        raise
    except (httpx.HTTPError, ValueError, TypeError, KeyError, AttributeError) as exc:
        raise OAuthFlowError() from exc

    provider_id = str(data.get("id") or "").strip()[:255]
    email = str(data.get("email") or "").strip().lower()
    if not provider_id or not email:
        raise OAuthFlowError("email_required")
    picture = data.get("picture")
    avatar_url = None
    if isinstance(picture, dict):
        picture_data = picture.get("data")
        if isinstance(picture_data, dict):
            avatar_url = str(picture_data.get("url") or "").strip()[:500] or None
    return OAuthProfile(
        provider_id=provider_id,
        email=email,
        full_name=_clean_name(data.get("name"), email),
        avatar_url=avatar_url,
    )


def fetch_oauth_profile(provider: str, code: str) -> OAuthProfile:
    if provider == "google":
        return _google_profile(code)
    if provider == "facebook":
        return _facebook_profile(code)
    raise OAuthFlowError("provider_unavailable")


def resolve_oauth_user(db: Session, provider: str, profile: OAuthProfile) -> User:
    id_field = "google_id" if provider == "google" else "facebook_id"
    user = db.scalar(
        select(User).where(getattr(User, id_field) == profile.provider_id)
    )
    if user is None and profile.email:
        user = db.scalar(
            select(User).where(func.lower(User.email) == profile.email.lower())
        )
        if user is not None:
            linked_id = getattr(user, id_field)
            if linked_id and linked_id != profile.provider_id:
                raise OAuthFlowError("account_conflict")
            setattr(user, id_field, profile.provider_id)

    if user is None:
        if not profile.email:
            raise OAuthFlowError("email_required")
        user = User(
            email=profile.email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=profile.full_name,
            avatar_url=profile.avatar_url,
            role=UserRole.user,
            email_verified_at=utcnow(),
            **{id_field: profile.provider_id},
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    if not user.is_active:
        raise OAuthFlowError("account_inactive")
    if not user.avatar_url and profile.avatar_url:
        user.avatar_url = profile.avatar_url
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
