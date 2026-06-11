from __future__ import annotations

import os
import sys

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User


def main() -> None:
    username = os.getenv("ADMIN_USERNAME", "admin").strip()
    password = os.getenv("ADMIN_PASSWORD", "").strip()
    display_name = os.getenv("ADMIN_DISPLAY_NAME", "管理员").strip() or username

    if not password:
        print("ADMIN_PASSWORD is required", file=sys.stderr)
        raise SystemExit(2)

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.username == username))
        if existing is not None:
            existing.password_hash = hash_password(password)
            existing.display_name = display_name
            existing.role = "admin"
            existing.is_active = True
            db.add(existing)
            db.commit()
            print(f"updated user={username} role=admin")
            return

        u = User(
            username=username,
            password_hash=hash_password(password),
            display_name=display_name,
            role="admin",
            is_active=True,
        )
        db.add(u)
        db.commit()
        print(f"created user={username} role=admin")


if __name__ == "__main__":
    main()

