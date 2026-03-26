"""Structured extraction output models.

These models represent the AI-extracted structured data from a capture.
The extraction pipeline produces these, and they are presented to the user
for review before becoming approved tasks.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from .enums import Priority


class ExtractedTask(BaseModel):
    """A task extracted from captured content."""

    title: str
    description: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[date] = None
    priority: Priority = Priority.NONE


class DueDate(BaseModel):
    """A deadline extracted from captured content."""

    description: str
    date: Optional[date] = None
    source_text: str  # The original text that indicated this deadline


class FollowUp(BaseModel):
    """A follow-up action extracted from captured content."""

    description: str
    owner: Optional[str] = None
    due_date: Optional[date] = None


class SourceReference(BaseModel):
    """A reference back to original source material."""

    source: str  # e.g. "email", "slack", "url"
    url: Optional[str] = None
    description: Optional[str] = None


class Extraction(BaseModel):
    """The full structured extraction result from a capture.

    Produced by the extract pipeline stage and presented for user review.
    """

    id: UUID = Field(default_factory=uuid4)
    capture_id: UUID
    summary: Optional[str] = None
    next_steps: list[str] = Field(default_factory=list)
    tasks: list[ExtractedTask] = Field(default_factory=list)
    owners: list[str] = Field(default_factory=list)
    due_dates: list[DueDate] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    follow_ups: list[FollowUp] = Field(default_factory=list)
    priority: Priority = Priority.NONE
    source_references: list[SourceReference] = Field(default_factory=list)
    model_provider: Optional[str] = None  # e.g. "anthropic", "gemini"
    model_id: Optional[str] = None  # e.g. "claude-sonnet-4-6"
    created_at: datetime = Field(default_factory=datetime.utcnow)
