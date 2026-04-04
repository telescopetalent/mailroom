"""Add workflows support: workflows JSONB on extractions, approved_workflows table,
workflow_id + workflow_order on approved_tasks.

Revision ID: 005
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workflows JSONB column to extractions
    op.add_column("extractions", sa.Column("workflows", JSONB, server_default="[]"))

    # Create approved_workflows table
    op.create_table(
        "approved_workflows",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id"), nullable=False, index=True),
        sa.Column("capture_id", UUID(as_uuid=True), sa.ForeignKey("captures.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("extraction_id", UUID(as_uuid=True), sa.ForeignKey("extractions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.Enum("open", "completed", name="workflow_status"), server_default="open", nullable=False),
        sa.Column("approved_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Add workflow columns to approved_tasks
    op.add_column(
        "approved_tasks",
        sa.Column("workflow_id", UUID(as_uuid=True), sa.ForeignKey("approved_workflows.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    op.add_column(
        "approved_tasks",
        sa.Column("workflow_order", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("approved_tasks", "workflow_order")
    op.drop_column("approved_tasks", "workflow_id")
    op.drop_table("approved_workflows")
    op.drop_column("extractions", "workflows")
