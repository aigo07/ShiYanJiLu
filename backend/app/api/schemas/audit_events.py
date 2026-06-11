from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.api.schemas.common import ORMModel


class AuditEventOut(ORMModel):
    id: int
    ts: datetime

    actor_type: str
    actor_id: str | None = None
    actor_name: str | None = None

    action: str
    entity_type: str
    entity_id: str

    request_id: str | None = None
    ip: str | None = None
    user_agent: str | None = None

    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    diff: dict[str, Any] | None = None
    reason: str | None = None


class AuditEventListOut(BaseModel):
    items: list[AuditEventOut]
    total: int = Field(ge=0)

