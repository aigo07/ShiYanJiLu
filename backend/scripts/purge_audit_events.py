from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.core.database import SessionLocal
from app.models.audit_event import AuditEvent


def main() -> None:
    days = int(os.getenv("AUDIT_RETENTION_DAYS", "30"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    with SessionLocal() as db:
        res = db.execute(delete(AuditEvent).where(AuditEvent.ts < cutoff))
        db.commit()
        print(f"deleted={res.rowcount or 0} cutoff={cutoff.isoformat()} days={days}")


if __name__ == "__main__":
    main()

