"""SQLAlchemy ORM models — maps to PostgreSQL tables."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.database import Base


# ---------------------------------------------------------------------------
# Users & Workspaces
# ---------------------------------------------------------------------------


class UserRow(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WorkspaceRow(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    trash_retention_days = Column(Integer, default=30, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SurfaceConnectionRow(Base):
    __tablename__ = "surface_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    surface = Column(String, nullable=False)  # "email" or "slack"
    external_id = Column(String, nullable=False)  # email address or Slack team_id
    config = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WorkspaceMemberRow(Base):
    __tablename__ = "workspace_members"

    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), primary_key=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role = Column(String, default="member", nullable=False)


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------


class ApiKeyRow(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    key_hash = Column(String, nullable=False, unique=True)
    name = Column(String, default="default")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Captures
# ---------------------------------------------------------------------------

CAPTURE_SOURCE_ENUM = Enum(
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

CONTENT_TYPE_ENUM = Enum(
    "text", "image", "pdf", "screenshot", "url", "mixed", name="content_type"
)

CAPTURE_STATUS_ENUM = Enum(
    "pending", "processing", "review", "approved", "rejected", "trashed", name="capture_status"
)

PRIORITY_ENUM = Enum("high", "medium", "low", "none", name="priority")

TASK_STATUS_ENUM = Enum("open", "completed", name="task_status")

WORKFLOW_STATUS_ENUM = Enum("open", "completed", name="workflow_status")


class CaptureRow(Base):
    __tablename__ = "captures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    source = Column(CAPTURE_SOURCE_ENUM, nullable=False)
    source_ref = Column(JSONB, default=dict)
    content_type = Column(CONTENT_TYPE_ENUM, nullable=False)
    raw_content = Column(JSONB, default=dict)
    normalized_text = Column(Text)
    status = Column(CAPTURE_STATUS_ENUM, default="pending", nullable=False)
    previous_status = Column(String, nullable=True)
    captured_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    trashed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Attachments
# ---------------------------------------------------------------------------


class AttachmentRow(Base):
    __tablename__ = "attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    capture_id = Column(
        UUID(as_uuid=True), ForeignKey("captures.id"), nullable=False, index=True
    )
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    s3_key = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Extractions
# ---------------------------------------------------------------------------


class ExtractionRow(Base):
    __tablename__ = "extractions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    capture_id = Column(
        UUID(as_uuid=True), ForeignKey("captures.id"), nullable=False, index=True
    )
    summary = Column(Text)
    next_steps = Column(JSONB, default=list)
    tasks = Column(JSONB, default=list)
    owners = Column(JSONB, default=list)
    due_dates = Column(JSONB, default=list)
    blockers = Column(JSONB, default=list)
    follow_ups = Column(JSONB, default=list)
    priority = Column(PRIORITY_ENUM, default="none")
    source_references = Column(JSONB, default=list)
    workflows = Column(JSONB, default=list)
    model_provider = Column(String)
    model_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Approved Workflows
# ---------------------------------------------------------------------------


class ApprovedWorkflowRow(Base):
    __tablename__ = "approved_workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    capture_id = Column(
        UUID(as_uuid=True), ForeignKey("captures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    extraction_id = Column(
        UUID(as_uuid=True), ForeignKey("extractions.id", ondelete="SET NULL"), nullable=True
    )
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(WORKFLOW_STATUS_ENUM, default="open", nullable=False)
    approved_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Approved Tasks
# ---------------------------------------------------------------------------


class ApprovedTaskRow(Base):
    __tablename__ = "approved_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    extraction_id = Column(
        UUID(as_uuid=True), ForeignKey("extractions.id", ondelete="SET NULL"), nullable=True
    )
    capture_id = Column(
        UUID(as_uuid=True), ForeignKey("captures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    workflow_id = Column(
        UUID(as_uuid=True), ForeignKey("approved_workflows.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workflow_order = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    owner = Column(String)
    due_date = Column(DateTime)
    priority = Column(PRIORITY_ENUM, default="none")
    labels = Column(JSONB, default=list)
    reminder = Column(DateTime, nullable=True)
    location = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    blocked_by_workflow_id = Column(
        UUID(as_uuid=True), ForeignKey("approved_workflows.id", ondelete="SET NULL"), nullable=True, index=True
    )
    blocked_by_task_id = Column(
        UUID(as_uuid=True), ForeignKey("approved_tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_ref = Column(JSONB, default=dict)
    status = Column(TASK_STATUS_ENUM, default="open", nullable=False)
    approved_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
