"""add_experiment_status

Revision ID: 2d5d2c5d88aa
Revises: 1917ba1431e4
Create Date: 2026-06-10 13:45:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2d5d2c5d88aa"
down_revision = "1917ba1431e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "experiments",
        sa.Column("status", sa.String(length=32), nullable=False, server_default="待开始"),
    )
    op.create_index(op.f("ix_experiments_status"), "experiments", ["status"], unique=False)
    op.alter_column("experiments", "status", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_experiments_status"), table_name="experiments")
    op.drop_column("experiments", "status")

