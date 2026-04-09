"""Canonical capture object and related models.

The Capture is the core data structure of Mailroom. Every input from every
surface is normalized into this format before entering the pipeline.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from .enums import CaptureSource, CaptureStatus, ContentType


# ---------------------------------------------------------------------------
# Source reference schemas — one per surface type
# ---------------------------------------------------------------------------


class EmailSourceRef(BaseModel):
    """Source reference for email captures."""

    source: str = "email"
    message_id: str
    from_addr: str
    subject: str
    received_at: datetime


class SlackSourceRef(BaseModel):
    """Source reference for Slack captures."""

    source: str = "slack"
    channel_id: str
    channel_name: str
    message_ts: str
    thread_ts: Optional[str] = None
    permalink: Optional[str] = None


class WebSourceRef(BaseModel):
    """Source reference for web/browser captures."""

    source: str = "web"
    url: Optional[str] = None
    page_title: Optional[str] = None


class GenericSourceRef(BaseModel):
    """Fallback source reference for surfaces without specific metadata."""

    source: str
    description: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# Union type for source refs
SourceRef = Union[EmailSourceRef, SlackSourceRef, WebSourceRef, GenericSourceRef]


# ---------------------------------------------------------------------------
# Attachment
# ---------------------------------------------------------------------------


class Attachment(BaseModel):
    """A file attached to a capture."""

    id: UUID = Field(default_factory=uuid4)
    capture_id: UUID
    filename: str
    content_type: str  # MIME type
    s3_key: str
    size_bytes: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Canonical Capture Object
# ---------------------------------------------------------------------------


class Capture(BaseModel):
    """The canonical capture object.

    Every input, regardless of source surface, is normalized into this format.
    This is the single data structure that flows through the entire pipeline.
    """

    id: UUID = Field(default_factory=uuid4)
    workspace_id: UUID
    user_id: UUID
    source: CaptureSource
    source_ref: Optional[SourceRef] = None
    content_type: ContentType
    raw_content: dict[str, Any] = Field(default_factory=dict)
    normalized_text: Optional[str] = None
    attachments: list[Attachment] = Field(default_factory=list)
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    status: CaptureStatus = CaptureStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
