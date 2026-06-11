from __future__ import annotations

from datetime import datetime

from typing import Literal
from pydantic import BaseModel, Field

from app.api.schemas.common import ORMModel, TimestampOut


ExperimentStatus = Literal["待开始", "进行中", "已结束"]


class ExperimentBase(BaseModel):
    customer_name: str = Field(min_length=1, max_length=128)
    project_no: str = Field(min_length=1, max_length=64)
    status: ExperimentStatus = "待开始"
    debug_goal: str | None = None
    silicone_model: str = Field(min_length=1, max_length=128)

    process_type_id: int

    start_at: datetime
    # Only meaningful when status == "已结束"
    end_at: datetime | None = None

    cure_temp_c: float | None = None
    cure_time_min: float | None = None
    bake_temp_c: float | None = None
    bake_time_min: float | None = None
    sheet_thickness_mm: float | None = None

    note: str | None = None


class ExperimentCreate(ExperimentBase):
    pass


class ExperimentUpdate(BaseModel):
    customer_name: str | None = Field(default=None, min_length=1, max_length=128)
    project_no: str | None = Field(default=None, min_length=1, max_length=64)
    status: ExperimentStatus | None = None
    debug_goal: str | None = None
    silicone_model: str | None = Field(default=None, min_length=1, max_length=128)

    process_type_id: int | None = None
    final_record_id: int | None = None

    start_at: datetime | None = None
    end_at: datetime | None = None

    cure_temp_c: float | None = None
    cure_time_min: float | None = None
    bake_temp_c: float | None = None
    bake_time_min: float | None = None
    sheet_thickness_mm: float | None = None

    note: str | None = None


class ExperimentOut(ORMModel, TimestampOut):
    id: int

    customer_name: str
    project_no: str
    status: ExperimentStatus
    debug_goal: str | None = None
    silicone_model: str

    process_type_id: int
    final_record_id: int | None = None

    start_at: datetime
    end_at: datetime | None = None

    cure_temp_c: float | None = None
    cure_time_min: float | None = None
    bake_temp_c: float | None = None
    bake_time_min: float | None = None
    sheet_thickness_mm: float | None = None

    note: str | None = None


class ExperimentOutWithRecords(ExperimentOut):
    records: list["RecordOut"] = []


from app.api.schemas.records import RecordOut  # noqa: E402  (circular refs)

