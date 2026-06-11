from __future__ import annotations

from pydantic import Field

from app.api.schemas.common import ORMModel, TimestampOut


class ProcessTypeOut(ORMModel, TimestampOut):
    id: int
    name: str = Field(max_length=32)


class MaterialOut(ORMModel, TimestampOut):
    id: int
    category: str = Field(max_length=32)
    name: str = Field(max_length=64)

    hydrogen_content: float | None = None
    vinyl_content: float | None = None
    volatile_min: float | None = None
    volatile_max: float | None = None
    avg_mw_wan: float | None = None
    pt_ppm: float | None = None


class CuringAgentOut(ORMModel, TimestampOut):
    id: int
    name: str = Field(max_length=64)
    default_ratio: float | None = None
    status: str | None = Field(default=None, max_length=128)
    note: str | None = None
    composition: list[dict] | None = None
    used_record_count: int = 0


class ExperimentSuggestionsOut(ORMModel):
    customers: list[str]
    silicone_models: list[str]


class MaterialCreate(ORMModel):
    category: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=64)

    hydrogen_content: float | None = None
    vinyl_content: float | None = None
    volatile_min: float | None = None
    volatile_max: float | None = None
    avg_mw_wan: float | None = None
    pt_ppm: float | None = None


class MaterialUpdate(ORMModel):
    category: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=64)

    hydrogen_content: float | None = None
    vinyl_content: float | None = None
    volatile_min: float | None = None
    volatile_max: float | None = None
    avg_mw_wan: float | None = None
    pt_ppm: float | None = None

