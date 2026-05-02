"""API request/response schemas.

These schemas define the contracts between clients and the Mailroom API.
All connectors and the frontend build against these types.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from .enums import (
    CaptureSource,
    CaptureStatus,
    ContentType,
    Priority,
    ReviewAction,
    TaskStatus,
    WorkflowStatus,
)
from .extraction import Extraction


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginationMeta(BaseModel):
    """Pagination metadata returned in list responses."""

    page: int
    page_size: int
    total_count: int
    total_pages: int


# ---------------------------------------------------------------------------
# Capture endpoints
# ---------------------------------------------------------------------------


class ManualExtractionInput(BaseModel):
    """User-provided extraction data for manual captures (no AI)."""

    summary: Optional[str] = None
    tasks: list[dict[str, Any]] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    follow_ups: list[dict[str, Any]] = Field(default_factory=list)
    workflows: list[dict[str, Any]] = Field(default_factory=list)
    priority: Priority = Priority.NONE


class CreateCaptureRequest(BaseModel):
    """Request body for POST /api/v1/captures.

    This is the universal entry point. All surfaces send content through
    this schema (or their connector translates into it).
    """

    source: CaptureSource
    content_text: Optional[str] = Field(None, max_length=100_000)
    content_url: Optional[str] = None
    source_ref: Optional[dict[str, Any]] = None
    mode: str = "ai"  # "ai" or "manual"
    manual_extraction: Optional[ManualExtractionInput] = None


class CaptureResponse(BaseModel):
    """Response for a single capture with its extraction."""

    id: UUID
    workspace_id: UUID
    user_id: UUID
    source: CaptureSource
    source_ref: Optional[dict[str, Any]] = None
    content_type: ContentType
    normalized_text: Optional[str] = None
    status: CaptureStatus
    project_id: Optional[UUID] = None
    captured_at: datetime
    created_at: datetime
    extraction: Optional[Extraction] = None
    attachment_count: int = 0


class CaptureListResponse(BaseModel):
    """Paginated list of captures."""

    items: list[CaptureResponse]
    pagination: PaginationMeta


# ---------------------------------------------------------------------------
# Review endpoints
# ---------------------------------------------------------------------------


class ReviewItemDecision(BaseModel):
    """A decision on a single extracted item during review."""

    item_type: str  # "task", "next_step", "follow_up", "blocker"
    item_index: int  # Index within the extraction's list for that type
    action: ReviewAction
    edited_value: Optional[dict[str, Any]] = None  # Only for action=edit


class SubmitReviewRequest(BaseModel):
    """Request body for PATCH /api/v1/captures/{id}/review."""

    decisions: list[ReviewItemDecision]


class ReviewResponse(BaseModel):
    """Response after submitting a review."""

    capture_id: UUID
    status: CaptureStatus
    approved_task_count: int
    rejected_item_count: int


# ---------------------------------------------------------------------------
# Task endpoints
# ---------------------------------------------------------------------------


class TaskResponse(BaseModel):
    """Response for a single approved task with source traceability."""

    id: UUID
    workspace_id: UUID
    title: str
    description: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[date] = None
    priority: Priority
    labels: list[str] = Field(default_factory=list)
    reminder: Optional[datetime] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    blocked_by_workflow_id: Optional[UUID] = None
    blocked_by_workflow_name: Optional[str] = None
    blocked_by_task_id: Optional[UUID] = None
    blocked_by_task_title: Optional[str] = None
    is_blocked: bool = False
    status: TaskStatus
    project_id: Optional[UUID] = None
    source: CaptureSource
    source_ref: Optional[dict[str, Any]] = None
    capture_id: Optional[UUID] = None
    extraction_id: Optional[UUID] = None
    workflow_id: Optional[UUID] = None
    workflow_name: Optional[str] = None
    workflow_order: Optional[int] = None
    approved_at: datetime
    created_at: datetime


class TaskListResponse(BaseModel):
    """Paginated list of approved tasks."""

    items: list[TaskResponse]
    pagination: PaginationMeta


class UpdateTaskRequest(BaseModel):
    """Request body for PATCH /api/v1/tasks/{id}."""

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    owner: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[Priority] = None
    labels: Optional[list[str]] = None
    reminder: Optional[datetime] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    blocked_by_workflow_id: Optional[UUID] = None
    blocked_by_task_id: Optional[UUID] = None


# ---------------------------------------------------------------------------
# Workflow endpoints
# ---------------------------------------------------------------------------


class SubTaskResponse(BaseModel):
    """A sub-task within a workflow step."""

    title: str
    completed: bool = False


class WorkflowTaskResponse(BaseModel):
    """A task within a workflow response."""

    id: UUID
    title: str
    description: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[date] = None
    priority: Priority
    status: TaskStatus
    workflow_order: int
    depends_on_prior: bool = False
    sub_tasks: list[SubTaskResponse] = Field(default_factory=list)


class WorkflowResponse(BaseModel):
    """Response for an approved workflow with its tasks."""

    id: UUID
    workspace_id: UUID
    name: str
    description: Optional[str] = None
    status: WorkflowStatus
    capture_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    tasks: list[WorkflowTaskResponse] = Field(default_factory=list)
    approved_at: datetime
    created_at: datetime


class WorkflowListResponse(BaseModel):
    """Paginated list of workflows."""

    items: list[WorkflowResponse]
    pagination: PaginationMeta


class UpdateWorkflowRequest(BaseModel):
    """Request body for PATCH /api/v1/workflows/{id}."""

    status: Optional[WorkflowStatus] = None
    name: Optional[str] = None


# ---------------------------------------------------------------------------
# Surface connections
# ---------------------------------------------------------------------------


class CreateSurfaceConnectionRequest(BaseModel):
    """Request body for POST /api/v1/surface-connections."""

    surface: str  # "email" or "slack"
    external_id: str  # email address or Slack team_id
    config: Optional[dict[str, Any]] = None


class UpdateSurfaceConnectionRequest(BaseModel):
    """Request body for PATCH /api/v1/surface-connections/{id}."""

    is_active: Optional[bool] = None
    config: Optional[dict[str, Any]] = None


class SurfaceConnectionResponse(BaseModel):
    """Response for a single surface connection."""

    id: UUID
    workspace_id: UUID
    surface: str
    external_id: str
    config: Optional[dict[str, Any]] = None
    is_active: bool
    created_at: datetime


class SurfaceConnectionListResponse(BaseModel):
    """List of surface connections."""

    items: list[SurfaceConnectionResponse]


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


class CreateProjectRequest(BaseModel):
    """Request body for POST /api/v1/projects."""

    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class UpdateProjectRequest(BaseModel):
    """Request body for PATCH /api/v1/projects/{id}."""

    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class ProjectResponse(BaseModel):
    """Response for a single project."""

    id: UUID
    workspace_id: UUID
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    capture_count: int = 0
    created_at: datetime


class ProjectListResponse(BaseModel):
    """List of projects."""

    items: list[ProjectResponse]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Response for GET /api/v1/health."""

    status: str = "ok"
    version: str = "0.1.0"
