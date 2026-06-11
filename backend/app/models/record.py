from __future__ import annotations

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import TimestampMixin


class Record(TimestampMixin, Base):
    __tablename__ = "records"

    __table_args__ = (
        CheckConstraint("ratio_a_pct >= 0 AND ratio_a_pct <= 100", name="ck_ratio_a_pct"),
        CheckConstraint("ratio_b_pct >= 0 AND ratio_b_pct <= 100", name="ck_ratio_b_pct"),
        CheckConstraint(
            "(ratio_a_pct + ratio_b_pct) < 100", name="ck_ratio_sum_lt_100"
        ),
        CheckConstraint(
            "bubble_grade >= 0 AND bubble_grade <= 5", name="ck_bubble_grade_0_5"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    experiment_id: Mapped[int] = mapped_column(
        ForeignKey("experiments.id", ondelete="CASCADE"), index=True, nullable=False
    )

    process_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("process_types.id"), index=True, nullable=True
    )

    curing_agent_a_id: Mapped[int] = mapped_column(
        ForeignKey("curing_agents.id"), index=True, nullable=False
    )
    curing_agent_b_id: Mapped[int] = mapped_column(
        ForeignKey("curing_agents.id"), index=True, nullable=False
    )

    ratio_a_pct: Mapped[float] = mapped_column(Float, nullable=False)
    ratio_b_pct: Mapped[float] = mapped_column(Float, nullable=False)

    ml: Mapped[float] = mapped_column(Float, nullable=False)
    mh: Mapped[float] = mapped_column(Float, nullable=False)
    t10_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    t90_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    bubble_grade: Mapped[int] = mapped_column(Integer, nullable=False)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # optional per-record process override
    cure_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    cure_time_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    bake_temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    bake_time_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    sheet_thickness_mm: Mapped[float | None] = mapped_column(Float, nullable=True)

    experiment: Mapped["Experiment"] = relationship(
        back_populates="records", foreign_keys=[experiment_id]
    )
    process_type: Mapped["ProcessType | None"] = relationship()

