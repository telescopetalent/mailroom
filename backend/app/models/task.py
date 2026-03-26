"""Approved task model.

Tasks are created when a user approves extracted items from the review workflow.
Each task preserves a link back to its source capture for traceability.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from .enums import Priority, TaskStatus


class ApprovedTask(BaseModel):
    """A task that has been approved through the review workflow.

    Always links back to the extraction and capture it came from,
    preserving full source traceability.
    """

    id: UUID = Field(default_factory=uuid4)
    extraction_id: UUID
    capture_id: UUID
    workspace_id: UUID
    title: str
    description: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[date] = None
    priority: Priority = Priority.NONE
    source_ref: dict[str, Any] = Field(default_factory=dict)
    status: TaskStatus = TaskStatus.OPEN
    approved_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
