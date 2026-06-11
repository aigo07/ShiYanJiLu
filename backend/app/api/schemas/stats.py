from __future__ import annotations

from pydantic import BaseModel, Field


class CuringAgentTopItem(BaseModel):
    curing_agent_id: int
    name: str = Field(default="")
    count: int = Field(ge=0)


class DashboardStatsOut(BaseModel):
    curing_agents_a_top: list[CuringAgentTopItem]
    curing_agents_a_other_count: int = Field(ge=0)
    curing_agents_b_top: list[CuringAgentTopItem]
    curing_agents_b_other_count: int = Field(ge=0)
    ongoing_experiments_count: int = Field(ge=0)
    completed_experiments_count: int = Field(ge=0)
    new_experiments_this_week_count: int = Field(ge=0)

