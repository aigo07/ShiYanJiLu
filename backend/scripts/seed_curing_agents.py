from __future__ import annotations

from pathlib import Path

from app.core.database import SessionLocal
from scripts.seed_db import default_paths, replace_curing_agents_from_json


def main() -> None:
    paths = default_paths()
    catalysts_json: Path = paths.catalysts_json

    with SessionLocal() as db:
        replace_curing_agents_from_json(db, catalysts_json)
        db.commit()

    print("Curing agents seed complete.")


if __name__ == "__main__":
    main()

