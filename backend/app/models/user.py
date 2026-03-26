"""User and workspace models."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, EmailStr, Field


class User(BaseModel):
    """A Mailroom user."""

    id: UUID = Field(default_factory=uuid4)
    email: EmailStr
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Workspace(BaseModel):
    """A workspace / tenant."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WorkspaceMember(BaseModel):
    """Association between a user and a workspace."""

    workspace_id: UUID
    user_id: UUID
    role: str = "member"  # member, admin, owner
