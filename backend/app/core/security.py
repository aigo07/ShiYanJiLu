from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.session import Session as DbSession
from app.models.user import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


Role = str  # "admin"|"auditor"|"editor"|"viewer"


@dataclass(frozen=True)
class CurrentUser:
    id: int
    username: str
    display_name: str
    role: Role


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_token(token: str) -> str:
    return _hash_token(token)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cookie_params() -> dict:
    return {
        "httponly": True,
        "secure": bool(settings.cookie_secure),
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain,
        "path": "/",
    }


def _csrf_cookie_params() -> dict:
    # Must be readable by JS so frontend can echo it into header.
    return {
        "httponly": False,
        "secure": bool(settings.cookie_secure),
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain,
        "path": "/",
    }


def issue_csrf_token(response: Response) -> str:
    token = secrets.token_urlsafe(24)
    response.set_cookie(settings.csrf_cookie_name, token, max_age=60 * 60 * 24 * settings.session_ttl_days, **_csrf_cookie_params())
    return token


def create_session(db: Session, *, user: User, request: Request, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    ttl = timedelta(days=int(settings.session_ttl_days))
    exp = _now() + ttl
    s = DbSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=exp,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(s)
    db.commit()

    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=int(ttl.total_seconds()),
        **_cookie_params(),
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.session_cookie_name, domain=settings.cookie_domain, path="/")


def clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(settings.csrf_cookie_name, domain=settings.cookie_domain, path="/")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_hash = _hash_token(token)

    stmt = (
        select(DbSession, User)
        .join(User, User.id == DbSession.user_id)
        .where(DbSession.token_hash == token_hash)
        .where(DbSession.expires_at > _now())
        .where(User.is_active.is_(True))
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess, user = row

    # touch last_seen
    sess.last_seen_at = _now()
    db.add(sess)
    db.commit()

    cu = CurrentUser(id=user.id, username=user.username, display_name=user.display_name, role=user.role)
    request.state.user = cu
    return cu


def require_roles(*roles: Role):
    def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _dep


def require_csrf(request: Request) -> None:
    # For cookie-based auth, protect unsafe methods.
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    cookie_token = request.cookies.get(settings.csrf_cookie_name)
    header_token = request.headers.get("X-CSRF-Token")
    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(status_code=403, detail="CSRF check failed")


def require_write_roles(*roles: Role):
    def _dep(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        require_csrf(request)
        return user

    return _dep

