from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.security import decode_access_token

_token_url = f"{settings.api_prefix}/auth/login"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=_token_url)
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl=_token_url, auto_error=False)


def _credentials_error(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    subject = payload.get("sub")
    if subject is None:
        raise _credentials_error()
    try:
        user = db.get(User, int(subject))
    except (TypeError, ValueError) as exc:
        raise _credentials_error() from exc
    if user is None:
        raise _credentials_error("User not found")
    return user


def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account"
        )
    return user


def get_current_admin(user: User = Depends(get_current_active_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required"
        )
    return user


def get_current_editor(user: User = Depends(get_current_active_user)) -> User:
    if user.role not in (UserRole.admin, UserRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Editor privileges required"
        )
    return user


def get_current_moderator(user: User = Depends(get_current_active_user)) -> User:
    if user.role not in (UserRole.admin, UserRole.editor, UserRole.supervisor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Moderator privileges required"
        )
    return user


def get_optional_user(
    token: str | None = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user = db.get(User, int(payload["sub"]))
    except (KeyError, TypeError, ValueError, HTTPException):
        return None
    if user is None or not user.is_active:
        return None
    return user
