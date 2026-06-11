from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.request_context import get_request_id
from app.models.audit_event import AuditEvent


def model_to_dict(obj: Any) -> dict[str, Any]:
    mapper = inspect(obj).mapper
    out: dict[str, Any] = {}
    for attr in mapper.column_attrs:
        key = attr.key
        out[key] = _json_safe(getattr(obj, key))
    return out


def _json_safe(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, datetime):
        # store as ISO string for JSONB compatibility
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return v


def _diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    changed: dict[str, Any] = {}
    for k, after_v in after.items():
        before_v = before.get(k)
        if before_v != after_v:
            changed[k] = {"from": before_v, "to": after_v}
    return changed


def require_audit_token(request: Request) -> None:
    if not settings.audit_token:
        return
    token = request.headers.get("X-Audit-Token")
    if token != settings.audit_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


def emit_audit_event(
    *,
    db: Session,
    request: Request,
    action: str,
    entity_type: str,
    entity_id: str,
    before_obj: Any | None = None,
    after_obj: Any | None = None,
    reason: str | None = None,
) -> AuditEvent:
    actor_id = None
    actor_name = None
    # Prefer authenticated user when available.
    u = getattr(request.state, "user", None)
    if u is not None:
        actor_id = str(getattr(u, "id", None) or getattr(u, "username", "") or "")
        actor_name = getattr(u, "display_name", None) or getattr(u, "username", None)
    if not actor_id:
        # Backward-compatible fallback (older clients/tests).
        actor_id = request.headers.get("X-User-Id")
        actor_name = request.headers.get("X-User-Name")

    if isinstance(before_obj, dict):
        before = before_obj
    else:
        before = model_to_dict(before_obj) if before_obj is not None else None

    if isinstance(after_obj, dict):
        after = after_obj
    else:
        after = model_to_dict(after_obj) if after_obj is not None else None
    diff = _diff(before, after) if before is not None and after is not None else None

    ev = AuditEvent(
        actor_type="user",
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        request_id=get_request_id(),
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
        before=before,
        after=after,
        diff=diff,
        reason=reason,
    )
    db.add(ev)
    return ev

