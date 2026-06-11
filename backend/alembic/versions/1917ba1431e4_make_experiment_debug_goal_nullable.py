"""make_experiment_debug_goal_nullable

Revision ID: 1917ba1431e4
Revises: 863e9dfc7b1b
Create Date: 2026-06-09 23:22:26.153480

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1917ba1431e4'
down_revision = '863e9dfc7b1b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "experiments",
        "debug_goal",
        existing_type=sa.Text(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "experiments",
        "debug_goal",
        existing_type=sa.Text(),
        nullable=False,
    )

