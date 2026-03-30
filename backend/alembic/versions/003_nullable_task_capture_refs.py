"""Make approved_tasks.capture_id and extraction_id nullable for orphaned tasks.

Revision ID: 003
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("approved_tasks", "capture_id", nullable=True)
    op.alter_column("approved_tasks", "extraction_id", nullable=True)


def downgrade() -> None:
    op.alter_column("approved_tasks", "capture_id", nullable=False)
    op.alter_column("approved_tasks", "extraction_id", nullable=False)
