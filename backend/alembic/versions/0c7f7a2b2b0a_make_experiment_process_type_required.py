"""make_experiment_process_type_required

Revision ID: 0c7f7a2b2b0a
Revises: 9f4a2c0fd4c1
Create Date: 2026-06-10 15:10:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0c7f7a2b2b0a"
down_revision = "9f4a2c0fd4c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure default process type exists.
    op.execute(
        """
        INSERT INTO process_types (name)
        SELECT '压延'
        WHERE NOT EXISTS (SELECT 1 FROM process_types WHERE name = '压延')
        """
    )
    op.execute(
        """
        UPDATE experiments
        SET process_type_id = (SELECT id FROM process_types WHERE name = '压延' LIMIT 1)
        WHERE process_type_id IS NULL
        """
    )
    op.alter_column("experiments", "process_type_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.alter_column("experiments", "process_type_id", existing_type=sa.Integer(), nullable=True)

