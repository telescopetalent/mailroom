"""User and workspace endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
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
    return WorkspaceResponse(id=workspace.id, name=workspace.name)
