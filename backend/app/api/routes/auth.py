from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    CurrentUser,
    clear_csrf_cookie,
    clear_session_cookie,
    create_session,
    get_current_user,
    hash_token,
    issue_csrf_token,
    verify_password,
)
from app.models.session import Session as DbSession
from app.models.user import User


router = APIRouter()


class LoginIn(BaseModel):
    username: str
    password: str


class MeOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    csrf_token: str | None = None


@router.post("/auth/login", response_model=MeOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> MeOut:
    username = payload.username.strip()
    if not username or not payload.password:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    user = db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    create_session(db, user=user, request=request, response=response)
    csrf = issue_csrf_token(response)
    return MeOut(id=user.id, username=user.username, display_name=user.display_name, role=user.role, csrf_token=csrf)


@router.post("/auth/logout")
def logout(request: Request, response: Response, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.core.config import settings

    token = request.cookies.get(settings.session_cookie_name)
    if token:
        token_hash = hash_token(token)
        s = db.scalar(select(DbSession).where(DbSession.token_hash == token_hash))
        if s is not None:
            db.delete(s)
            db.commit()
    clear_session_cookie(response)
    clear_csrf_cookie(response)
    return {"status": "ok"}


@router.get("/auth/me", response_model=MeOut)
def me(response: Response, user: CurrentUser = Depends(get_current_user)) -> MeOut:
    csrf = issue_csrf_token(response)
    return MeOut(id=user.id, username=user.username, display_name=user.display_name, role=user.role, csrf_token=csrf)

