from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.curing_agents import router as curing_agents_router
from app.api.routes.dicts import router as dicts_router
from app.api.routes.experiments import router as experiments_router
from app.api.routes.exports import router as exports_router
from app.api.routes.health import router as health_router
from app.api.routes.materials import router as materials_router
from app.api.routes.records import router as records_router
from app.api.routes.stats import router as stats_router
from app.api.routes.audit_events import router as audit_events_router
from app.api.routes.auth import router as auth_router


api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(dicts_router, tags=["dicts"])
api_router.include_router(curing_agents_router, tags=["curing_agents"])
api_router.include_router(experiments_router, tags=["experiments"])
api_router.include_router(records_router, tags=["records"])
api_router.include_router(exports_router, tags=["exports"])
api_router.include_router(materials_router, tags=["materials"])
api_router.include_router(stats_router, tags=["stats"])
api_router.include_router(audit_events_router, tags=["audit_events"])

