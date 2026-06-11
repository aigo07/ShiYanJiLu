from __future__ import annotations

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin


class CuringAgent(TimestampMixin, Base):
    __tablename__ = "curing_agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    default_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str | None] = mapped_column(String(128), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSONB composition referencing Material primary keys.
    # Example: [{"material_id": 123, "mass_pct": 71.78}, ...]
    composition: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
