from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator

from app.api.schemas.common import ORMModel, TimestampOut


class RecordBase(BaseModel):
    experiment_id: int
    process_type_id: int | None = None

    curing_agent_a_id: int
    curing_agent_b_id: int

    ratio_a_pct: float = Field(ge=0, le=100)
    ratio_b_pct: float = Field(ge=0, le=100)

    ml: float
    mh: float
    t10_sec: int = Field(ge=0)
    t90_sec: int = Field(ge=0)
    bubble_grade: int = Field(ge=0, le=5)

    note: str | None = None

    cure_temp_c: float | None = None
    cure_time_min: float | None = None
    bake_temp_c: float | None = None
    bake_time_min: float | None = None
    sheet_thickness_mm: float | None = None

    @model_validator(mode="after")
    def validate_ratio_sum(self) -> "RecordBase":
        if (self.ratio_a_pct + self.ratio_b_pct) >= 100:
            raise ValueError("ratio_a_pct + ratio_b_pct must be < 100")
        return self


class RecordCreate(RecordBase):
    pass


class RecordUpdate(BaseModel):
    experiment_id: int | None = None
    process_type_id: int | None = None

    curing_agent_a_id: int | None = None
    curing_agent_b_id: int | None = None

    ratio_a_pct: float | None = Field(default=None, ge=0, le=100)
    ratio_b_pct: float | None = Field(default=None, ge=0, le=100)

    ml: float | None = None
    mh: float | None = None
    t10_sec: int | None = Field(default=None, ge=0)
    t90_sec: int | None = Field(default=None, ge=0)
    bubble_grade: int | None = Field(default=None, ge=0, le=5)

    note: str | None = None

    cure_temp_c: float | None = None
    cure_time_min: float | None = None
    bake_temp_c: float | None = None
    bake_time_min: float | None = None
    sheet_thickness_mm: float | None = None

    @model_validator(mode="after")
    def validate_ratio_sum_partial(self) -> "RecordUpdate":
        # Only validate sum if both provided in this patch.
        if self.ratio_a_pct is not None and self.ratio_b_pct is not None:
            if (self.ratio_a_pct + self.ratio_b_pct) >= 100:
                raise ValueError("ratio_a_pct + ratio_b_pct must be < 100")
        return self


class RecordOut(ORMModel, TimestampOut):
    id: int
    experiment_id: int
    process_type_id: int | None = None

    curing_agent_a_id: int
    curing_agent_b_id: int

    ratio_a_pct: float
    ratio_b_pct: float

    ml: float
    mh: float
    t10_sec: int
    t90_sec: int
    bubble_grade: int

    note: str | None = None

    cure_temp_c: float | None = None
    cure_time_min: float | None = None
    bake_temp_c: float | None = None
    bake_time_min: float | None = None
    sheet_thickness_mm: float | None = None

