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
)
from .extraction import Extraction, ExtractedTask


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
    priority: Priority = Priority.NONE


class CreateCaptureRequest(BaseModel):
    """Request body for POST /api/v1/captures.

    This is the universal entry point. All surfaces send content through
    this schema (or their connector translates into it).
    """

    source: CaptureSource
    content_text: Optional[str] = None
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
    status: TaskStatus
    source: CaptureSource
    source_ref: Optional[dict[str, Any]] = None
    capture_id: UUID
    extraction_id: UUID
    approved_at: datetime
    created_at: datetime


class TaskListResponse(BaseModel):
    """Paginated list of approved tasks."""

    items: list[TaskResponse]
    pagination: PaginationMeta


class UpdateTaskRequest(BaseModel):
    """Request body for PATCH /api/v1/tasks/{id}."""

    status: Optional[TaskStatus] = None
    owner: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[Priority] = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Response for GET /api/v1/health."""

    status: str = "ok"
    version: str = "0.1.0"
