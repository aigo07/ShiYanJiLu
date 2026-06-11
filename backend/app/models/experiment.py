from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import TimestampMixin


class Experiment(TimestampMixin, Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # meta
    customer_name: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    project_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), index=True, nullable=False, default="待开始"
    )
    debug_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    silicone_model: Mapped[str] = mapped_column(String(128), index=True, nullable=False)

    process_type_id: Mapped[int] = mapped_column(
        ForeignKey("process_types.id"), index=True, nullable=False
    )

    # Final/selected record for this experiment (may be null).
    final_record_id: Mapped[int | None] = mapped_column(
        ForeignKey("records.id", ondelete="SET NULL"), index=True, nullable=True
    )

    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Only meaningful when status == "已结束". Active experiments should keep it NULL.
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # default process values
    cure_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    cure_time_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    bake_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    bake_time_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    sheet_thickness_mm: Mapped[float | None] = mapped_column(Float, nullable=True)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    process_type: Mapped["ProcessType | None"] = relationship()
    final_record: Mapped["Record | None"] = relationship(foreign_keys=[final_record_id])

    records: Mapped[list["Record"]] = relationship(
        back_populates="experiment",
        foreign_keys="Record.experiment_id",
        cascade="all, delete-orphan",
    )

