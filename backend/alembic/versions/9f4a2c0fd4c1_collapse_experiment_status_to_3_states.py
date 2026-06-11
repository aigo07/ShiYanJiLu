"""collapse_experiment_status_to_3_states

Revision ID: 9f4a2c0fd4c1
Revises: 2d5d2c5d88aa
Create Date: 2026-06-10 15:00:00.000000

"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "9f4a2c0fd4c1"
down_revision = "2d5d2c5d88aa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Map legacy 5-state workflow into 3 states:
    # - 已结束: keep
    # - 已完成/关闭 -> 已结束
    # - 待开始: keep
    # - others (including 客测/交付/未知值) -> 进行中
    # - null/empty -> 待开始
    op.execute(
        """
        UPDATE experiments
        SET status = CASE
          WHEN status IS NULL OR btrim(status) = '' THEN '待开始'
          WHEN status IN ('已结束', '已完成/关闭') THEN '已结束'
          WHEN status = '待开始' THEN '待开始'
          ELSE '进行中'
        END
        """
    )


def downgrade() -> None:
    # No exact rollback (information-losing collapse). Keep data as-is.
    pass

