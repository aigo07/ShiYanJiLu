"""experiment end_at nullable

Revision ID: 9a1a7b2c3d4e
Revises: 4e90db0a9f3f
Create Date: 2026-06-11 10:42:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9a1a7b2c3d4e"
down_revision = "4e90db0a9f3f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("experiments", "end_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    # Optional cleanup: active experiments should not have end_at
    op.execute("UPDATE experiments SET end_at = NULL WHERE status IS NOT NULL AND status != '已结束'")


def downgrade() -> None:
    # Downgrade keeps data; set NULL end_at to start_at to satisfy NOT NULL constraint
    op.execute("UPDATE experiments SET end_at = start_at WHERE end_at IS NULL")
    op.alter_column("experiments", "end_at", existing_type=sa.DateTime(timezone=True), nullable=False)

