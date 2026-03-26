"""Initial schema — users, workspaces, captures, extractions, tasks.

Revision ID: 001
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String, unique=True, nullable=False, index=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Workspaces
    op.create_table(
        "workspaces",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Workspace members
    op.create_table(
        "workspace_members",
        sa.Column(
            "workspace_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            primary_key=True,
        ),
        sa.Column("role", sa.String, nullable=False, server_default="member"),
    )

    # API keys
    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("key_hash", sa.String, nullable=False, unique=True),
        sa.Column("name", sa.String, server_default="default"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Captures
    capture_source = sa.Enum(
        "web",
        "email",
        "slack",
        "ios_app",
        "ios_share",
        "apple_notes",
        "chrome_extension",
        "desktop",
        "sms",
        "telegram",
        "discord",
        "whatsapp",
        name="capture_source",
    )
    content_type = sa.Enum(
        "text", "image", "pdf", "screenshot", "url", "mixed", name="content_type"
    )
    capture_status = sa.Enum(
        "pending",
        "processing",
        "review",
        "approved",
        "rejected",
        name="capture_status",
    )

    op.create_table(
        "captures",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("source", capture_source, nullable=False),
        sa.Column("source_ref", JSONB, server_default="{}"),
        sa.Column("content_type", content_type, nullable=False),
        sa.Column("raw_content", JSONB, server_default="{}"),
        sa.Column("normalized_text", sa.Text),
        sa.Column("status", capture_status, nullable=False, server_default="pending"),
        sa.Column("captured_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Attachments
    op.create_table(
        "attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "capture_id",
            UUID(as_uuid=True),
            sa.ForeignKey("captures.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("filename", sa.String, nullable=False),
        sa.Column("content_type", sa.String, nullable=False),
        sa.Column("s3_key", sa.String, nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Extractions
    priority = sa.Enum("high", "medium", "low", "none", name="priority")

    op.create_table(
        "extractions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "capture_id",
            UUID(as_uuid=True),
            sa.ForeignKey("captures.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("summary", sa.Text),
        sa.Column("next_steps", JSONB, server_default="[]"),
        sa.Column("tasks", JSONB, server_default="[]"),
        sa.Column("owners", JSONB, server_default="[]"),
        sa.Column("due_dates", JSONB, server_default="[]"),
        sa.Column("blockers", JSONB, server_default="[]"),
        sa.Column("follow_ups", JSONB, server_default="[]"),
        sa.Column("priority", priority, server_default="none"),
        sa.Column("source_references", JSONB, server_default="[]"),
        sa.Column("model_provider", sa.String),
        sa.Column("model_id", sa.String),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Approved tasks
    task_status = sa.Enum("open", "completed", name="task_status")

    op.create_table(
        "approved_tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "extraction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("extractions.id"),
            nullable=False,
        ),
        sa.Column(
            "capture_id",
            UUID(as_uuid=True),
            sa.ForeignKey("captures.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "workspace_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("owner", sa.String),
        sa.Column("due_date", sa.DateTime),
        sa.Column("priority", priority, server_default="none"),
        sa.Column("source_ref", JSONB, server_default="{}"),
        sa.Column("status", task_status, nullable=False, server_default="open"),
        sa.Column("approved_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("approved_tasks")
    op.drop_table("extractions")
    op.drop_table("attachments")
    op.drop_table("captures")
    op.drop_table("api_keys")
    op.drop_table("workspace_members")
    op.drop_table("workspaces")
    op.drop_table("users")

    # Drop enum types
    sa.Enum(name="task_status").drop(op.get_bind())
    sa.Enum(name="priority").drop(op.get_bind())
    sa.Enum(name="capture_status").drop(op.get_bind())
    sa.Enum(name="content_type").drop(op.get_bind())
    sa.Enum(name="capture_source").drop(op.get_bind())
