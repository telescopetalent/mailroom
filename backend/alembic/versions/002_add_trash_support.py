"""Add trash support — trashed status, trashed_at, previous_status, trash_retention_days.

Revision ID: 002
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'trashed' to the capture_status enum
    op.execute("ALTER TYPE capture_status ADD VALUE IF NOT EXISTS 'trashed'")

    # Add columns to captures
    op.add_column("captures", sa.Column("previous_status", sa.String, nullable=True))
    op.add_column("captures", sa.Column("trashed_at", sa.DateTime, nullable=True))

    # Add trash_retention_days to workspaces
    op.add_column(
        "workspaces",
        sa.Column("trash_retention_days", sa.Integer, nullable=False, server_default="30"),
    )


def downgrade() -> None:
    op.drop_column("workspaces", "trash_retention_days")
    op.drop_column("captures", "trashed_at")
    op.drop_column("captures", "previous_status")
    # Note: PostgreSQL does not support removing values from enums
