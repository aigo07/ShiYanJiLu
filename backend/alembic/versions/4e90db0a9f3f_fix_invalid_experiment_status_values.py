"""fix_invalid_experiment_status_values

Revision ID: 4e90db0a9f3f
Revises: 0c7f7a2b2b0a
Create Date: 2026-06-10 15:30:00.000000

"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "4e90db0a9f3f"
down_revision = "0c7f7a2b2b0a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Clean invalid/garbled statuses into the 3-state set:
    # - null/empty -> 待开始
    # - already valid -> keep
    # - everything else -> 进行中
    op.execute(
        """
        UPDATE experiments
        SET status = CASE
          WHEN status IS NULL OR btrim(status) = '' THEN '待开始'
          WHEN status IN ('待开始', '进行中', '已结束') THEN status
          ELSE '进行中'
        END
        """
    )


def downgrade() -> None:
    pass

