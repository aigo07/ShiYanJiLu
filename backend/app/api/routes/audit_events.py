from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas.audit_events import AuditEventListOut, AuditEventOut
from app.core.audit import require_audit_token
from app.core.database import get_db
from app.core.security import require_roles
from app.models.audit_event import AuditEvent


router = APIRouter()


@router.get("/audit-events", response_model=AuditEventListOut)
def list_audit_events(
    request: Request,
    ts_from: datetime | None = Query(default=None),
    ts_to: datetime | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor")),
) -> AuditEventListOut:
    require_audit_token(request)

    stmt = select(AuditEvent)
    if ts_from is not None:
        stmt = stmt.where(AuditEvent.ts >= ts_from)
    if ts_to is not None:
        stmt = stmt.where(AuditEvent.ts <= ts_to)
    if actor_id is not None:
        stmt = stmt.where(AuditEvent.actor_id == actor_id)
    if entity_type is not None:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(AuditEvent.entity_id == entity_id)
    if action is not None:
        stmt = stmt.where(AuditEvent.action == action)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = int(db.scalar(total_stmt) or 0)

    items = list(
        db.scalars(stmt.order_by(AuditEvent.ts.desc()).limit(limit).offset(offset)).all()
    )
    return AuditEventListOut(
        items=[AuditEventOut.model_validate(x) for x in items],
        total=total,
    )

