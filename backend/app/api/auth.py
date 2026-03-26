"""API key management endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import generate_api_key, get_current_user, hash_api_key
from app.core.database import get_db
from app.db.models import ApiKeyRow, UserRow, WorkspaceMemberRow

router = APIRouter(prefix="/auth", tags=["auth"])


class CreateApiKeyRequest(BaseModel):
    name: str = "default"


class ApiKeyResponse(BaseModel):
    key: str  # Only returned on creation
    name: str
    message: str = "Store this key securely. It cannot be retrieved again."


@router.post("/keys", response_model=ApiKeyResponse)
def create_api_key(
    body: CreateApiKeyRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new API key for the current user's workspace."""
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)

    row = ApiKeyRow(
        workspace_id=current_user["workspace_id"],
        user_id=current_user["user_id"],
        key_hash=key_hash,
        name=body.name,
    )
    db.add(row)
    db.commit()

    return ApiKeyResponse(key=raw_key, name=body.name)


# ---------------------------------------------------------------------------
# Bootstrap endpoint — creates initial user + workspace + key (no auth)
# ---------------------------------------------------------------------------


class BootstrapRequest(BaseModel):
    email: str
    name: str
    workspace_name: str


class BootstrapResponse(BaseModel):
    user_id: UUID
    workspace_id: UUID
    api_key: str
    message: str = "Store this API key securely. It cannot be retrieved again."


@router.post("/bootstrap", response_model=BootstrapResponse)
def bootstrap(body: BootstrapRequest, db: Session = Depends(get_db)):
    """Create an initial user, workspace, and API key.

    This is an unauthenticated endpoint for first-time setup.
    """
    # Check if user already exists
    existing = db.query(UserRow).filter(UserRow.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    from app.db.models import WorkspaceRow

    user = UserRow(email=body.email, name=body.name)
    workspace = WorkspaceRow(name=body.workspace_name)
    db.add(user)
    db.add(workspace)
    db.flush()

    member = WorkspaceMemberRow(
        workspace_id=workspace.id, user_id=user.id, role="owner"
    )
    db.add(member)

    raw_key = generate_api_key()
    api_key = ApiKeyRow(
        workspace_id=workspace.id,
        user_id=user.id,
        key_hash=hash_api_key(raw_key),
        name="default",
    )
    db.add(api_key)
    db.commit()

    return BootstrapResponse(
        user_id=user.id,
        workspace_id=workspace.id,
        api_key=raw_key,
    )
