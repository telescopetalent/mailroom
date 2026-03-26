"""Mailroom data models — re-exports for convenient imports."""

from .enums import (
    CaptureSource,
    CaptureStatus,
    ContentType,
    Priority,
    ReviewAction,
    TaskStatus,
)
from .user import User, Workspace, WorkspaceMember
from .capture import (
    Attachment,
    Capture,
    EmailSourceRef,
    GenericSourceRef,
    SlackSourceRef,
    SourceRef,
    WebSourceRef,
)
from .extraction import (
    DueDate,
    ExtractedTask,
    Extraction,
    FollowUp,
    SourceReference,
)
from .task import ApprovedTask
from .api_schemas import (
    CaptureListResponse,
    CaptureResponse,
    CreateCaptureRequest,
    HealthResponse,
    PaginationMeta,
    PaginationParams,
    ReviewItemDecision,
    ReviewResponse,
    SubmitReviewRequest,
    TaskListResponse,
    TaskResponse,
    UpdateTaskRequest,
)

__all__ = [
    # Enums
    "CaptureSource",
    "CaptureStatus",
    "ContentType",
    "Priority",
    "ReviewAction",
    "TaskStatus",
    # User
    "User",
    "Workspace",
    "WorkspaceMember",
    # Capture
    "Attachment",
    "Capture",
    "EmailSourceRef",
    "GenericSourceRef",
    "SlackSourceRef",
    "SourceRef",
    "WebSourceRef",
    # Extraction
    "DueDate",
    "ExtractedTask",
    "Extraction",
    "FollowUp",
    "SourceReference",
    # Task
    "ApprovedTask",
    # API schemas
    "CaptureListResponse",
    "CaptureResponse",
    "CreateCaptureRequest",
    "HealthResponse",
    "PaginationMeta",
    "PaginationParams",
    "ReviewItemDecision",
    "ReviewResponse",
    "SubmitReviewRequest",
    "TaskListResponse",
    "TaskResponse",
    "UpdateTaskRequest",
]
