"""Add task dependency fields: blocked_by_workflow_id, blocked_by_task_id.

Revision ID: 007
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "approved_tasks",
        sa.Column("blocked_by_workflow_id", UUID(as_uuid=True),
                  sa.ForeignKey("approved_workflows.id", ondelete="SET NULL"),
                  nullable=True, index=True),
    )
    op.add_column(
        "approved_tasks",
        sa.Column("blocked_by_task_id", UUID(as_uuid=True),
                  sa.ForeignKey("approved_tasks.id", ondelete="SET NULL"),
                  nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_column("approved_tasks", "blocked_by_task_id")
    op.drop_column("approved_tasks", "blocked_by_workflow_id")
