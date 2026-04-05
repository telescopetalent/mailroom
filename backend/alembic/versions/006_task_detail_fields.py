"""Add task detail fields: labels, reminder, location, notes.

Revision ID: 006
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("approved_tasks", sa.Column("labels", JSONB, server_default="[]"))
    op.add_column("approved_tasks", sa.Column("reminder", sa.DateTime, nullable=True))
    op.add_column("approved_tasks", sa.Column("location", sa.Text, nullable=True))
    op.add_column("approved_tasks", sa.Column("notes", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("approved_tasks", "notes")
    op.drop_column("approved_tasks", "location")
    op.drop_column("approved_tasks", "reminder")
    op.drop_column("approved_tasks", "labels")
