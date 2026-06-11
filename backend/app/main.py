from __future__ import annotations

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.http_middleware import request_context_middleware
from app.core.logging import setup_logging


def create_app() -> FastAPI:
    setup_logging()
    app = FastAPI(title=settings.app_name)
    app.middleware("http")(request_context_middleware)
    app.include_router(api_router)
    return app


app = create_app()

