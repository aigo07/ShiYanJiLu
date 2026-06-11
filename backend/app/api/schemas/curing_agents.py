from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class CompositionItem(BaseModel):
    material_id: int
    mass_pct: float = Field(ge=0, le=100)


class CuringAgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    default_ratio: float | None = None
    status: str | None = Field(default=None, max_length=128)
    note: str | None = None
    composition: list[CompositionItem] | None = None


class CuringAgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    default_ratio: float | None = None
    status: str | None = Field(default=None, max_length=128)
    note: str | None = None
    composition: list[CompositionItem] | None = None

