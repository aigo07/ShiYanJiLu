from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "shiyanjilu-api"
    app_env: str = "dev"
    database_url: str = "postgresql+psycopg://shiyanjilu:shiyanjilu@localhost:5432/shiyanjilu"

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"  # json | text
    log_to_stdout: bool = True
    log_to_file: bool = True
    # Relative to backend working directory (see start-dev.ps1).
    log_dir: str = "logs"
    log_file_max_bytes: int = 20 * 1024 * 1024
    log_file_backup_count: int = 5

    # Audit
    # If set, `GET /audit-events` requires header `X-Audit-Token: <value>`.
    audit_token: str | None = None

    # Auth (public internet)
    session_cookie_name: str = "sid"
    csrf_cookie_name: str = "csrf_token"
    # Preferred: seconds-based TTL for fine-grained control.
    # Example: 30 minutes = 1800
    session_ttl_seconds: int = 1800
    # Legacy (kept for backward compatibility with existing .env):
    # Example: 14 days = 14
    session_ttl_days: int = 14
    cookie_secure: bool = False  # set True behind HTTPS in prod
    cookie_samesite: str = "lax"  # lax|strict|none
    cookie_domain: str | None = None


settings = Settings()

