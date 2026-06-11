from __future__ import annotations

from sqlalchemy import Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin


class Material(TimestampMixin, Base):
    __tablename__ = "materials"
    __table_args__ = (UniqueConstraint("category", "name", name="uq_materials_category_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    category: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    hydrogen_content: Mapped[float | None] = mapped_column(Float, nullable=True)
    vinyl_content: Mapped[float | None] = mapped_column(Float, nullable=True)
    volatile_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    volatile_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_mw_wan: Mapped[float | None] = mapped_column(Float, nullable=True)
    pt_ppm: Mapped[float | None] = mapped_column(Float, nullable=True)

