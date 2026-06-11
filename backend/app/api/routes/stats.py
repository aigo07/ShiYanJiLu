from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas.stats import CuringAgentTopItem, DashboardStatsOut
from app.core.database import get_db
from app.core.security import require_roles
from app.models.curing_agent import CuringAgent
from app.models.experiment import Experiment
from app.models.record import Record


router = APIRouter()


def _week_start_utc(now: datetime) -> datetime:
    # Week starts on Monday 00:00 (UTC).
    # We keep it explicit to avoid locale-dependent behavior.
    monday = now - timedelta(days=now.weekday())
    return datetime(monday.year, monday.month, monday.day, tzinfo=timezone.utc)


@router.get("/stats/dashboard", response_model=DashboardStatsOut)
def get_dashboard_stats(
    completed_days: int = Query(default=7, ge=1, le=3650),
    top_n: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> DashboardStatsOut:
    now = datetime.now(timezone.utc)
    completed_since = now - timedelta(days=completed_days)
    week_start = _week_start_utc(now)

    ongoing_experiments_count = (
        db.scalar(select(func.count()).select_from(Experiment).where(Experiment.status == "进行中")) or 0
    )
    completed_experiments_count = (
        db.scalar(
            select(func.count())
            .select_from(Experiment)
            .where(Experiment.status == "已结束", Experiment.end_at >= completed_since)
        )
        or 0
    )
    new_experiments_this_week_count = (
        db.scalar(select(func.count()).select_from(Experiment).where(Experiment.created_at >= week_start)) or 0
    )

    # Top curing agents by appearance in records (A position / B position).
    a_rows = list(
        db.execute(
            select(
                Record.curing_agent_a_id.label("curing_agent_id"),
                func.count().label("count"),
                func.coalesce(CuringAgent.name, "").label("name"),
            )
            .join(CuringAgent, CuringAgent.id == Record.curing_agent_a_id)
            .group_by(Record.curing_agent_a_id, CuringAgent.name)
            .order_by(func.count().desc())
            .limit(top_n)
        ).all()
    )
    b_rows = list(
        db.execute(
            select(
                Record.curing_agent_b_id.label("curing_agent_id"),
                func.count().label("count"),
                func.coalesce(CuringAgent.name, "").label("name"),
            )
            .join(CuringAgent, CuringAgent.id == Record.curing_agent_b_id)
            .group_by(Record.curing_agent_b_id, CuringAgent.name)
            .order_by(func.count().desc())
            .limit(top_n)
        ).all()
    )

    a_total = db.scalar(select(func.count()).select_from(Record).where(Record.curing_agent_a_id.is_not(None))) or 0
    b_total = db.scalar(select(func.count()).select_from(Record).where(Record.curing_agent_b_id.is_not(None))) or 0
    a_top_sum = sum(int(r.count) for r in a_rows)
    b_top_sum = sum(int(r.count) for r in b_rows)

    return DashboardStatsOut(
        curing_agents_a_top=[
            CuringAgentTopItem(
                curing_agent_id=int(r.curing_agent_id), name=str(r.name or ""), count=int(r.count)
            )
            for r in a_rows
        ],
        curing_agents_a_other_count=max(0, int(a_total - a_top_sum)),
        curing_agents_b_top=[
            CuringAgentTopItem(
                curing_agent_id=int(r.curing_agent_id), name=str(r.name or ""), count=int(r.count)
            )
            for r in b_rows
        ],
        curing_agents_b_other_count=max(0, int(b_total - b_top_sum)),
        ongoing_experiments_count=int(ongoing_experiments_count),
        completed_experiments_count=int(completed_experiments_count),
        new_experiments_this_week_count=int(new_experiments_this_week_count),
    )

