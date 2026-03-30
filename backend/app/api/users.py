"""User and workspace endpoints."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.db.models import UserRow, WorkspaceRow

router = APIRouter(tags=["users"])


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    trash_retention_days: int = 30


class UpdateWorkspaceSettingsRequest(BaseModel):
    trash_retention_days: Optional[int] = Field(None, ge=1, le=365)


@router.get("/users/me", response_model=UserResponse)
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current authenticated user."""
    user = db.query(UserRow).filter(UserRow.id == current_user["user_id"]).first()
    return UserResponse(id=user.id, email=user.email, name=user.name)


@router.get("/workspaces/current", response_model=WorkspaceResponse)
def get_current_workspace(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current workspace."""
    workspace = (
        db.query(WorkspaceRow)
        .filter(WorkspaceRow.id == current_user["workspace_id"])
        .first()
    )
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        trash_retention_days=workspace.trash_retention_days,
    )


@router.patch("/workspaces/current/settings", response_model=WorkspaceResponse)
def update_workspace_settings(
    body: UpdateWorkspaceSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update workspace settings."""
    workspace = (
        db.query(WorkspaceRow)
        .filter(WorkspaceRow.id == current_user["workspace_id"])
        .first()
    )

    if body.trash_retention_days is not None:
        workspace.trash_retention_days = body.trash_retention_days

    db.commit()
    db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        trash_retention_days=workspace.trash_retention_days,
    )
