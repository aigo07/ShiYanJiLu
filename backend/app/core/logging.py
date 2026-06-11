from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.request_context import get_request_id


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "service": settings.app_name,
            "env": settings.app_env,
        }

        request_id = get_request_id()
        if request_id:
            base["request_id"] = request_id

        if record.exc_info:
            base["exc_info"] = self.formatException(record.exc_info)

        # Allow passing extra structured fields via `extra={"props": {...}}`
        props = getattr(record, "props", None)
        if isinstance(props, dict):
            for k, v in props.items():
                if k not in base:
                    base[k] = v

        return json.dumps(base, ensure_ascii=False, default=str)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def setup_logging() -> None:
    level = settings.log_level.upper()
    root = logging.getLogger()
    root.setLevel(level)

    # Clear any handlers uvicorn might have pre-configured (especially in reload).
    root.handlers.clear()

    formatter: logging.Formatter
    if settings.log_format == "json":
        formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            fmt="%(levelname)s %(name)s %(message)s",
        )

    if settings.log_to_file:
        log_dir = Path(settings.log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "backend.log"

        fh = RotatingFileHandler(
            log_path,
            maxBytes=settings.log_file_max_bytes,
            backupCount=settings.log_file_backup_count,
            encoding="utf-8",
        )
        fh.setLevel(level)
        fh.setFormatter(formatter)
        root.addHandler(fh)

    if settings.log_to_stdout:
        sh = logging.StreamHandler(stream=sys.stdout)
        sh.setLevel(level)
        sh.setFormatter(formatter)
        root.addHandler(sh)

    # Reduce SQLAlchemy noise by default
    logging.getLogger("sqlalchemy.engine").setLevel(os.getenv("SQLALCHEMY_LOG_LEVEL", "WARNING"))

