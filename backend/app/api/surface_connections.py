"""Surface connection endpoints — manage email and Slack integrations."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.db.models import SurfaceConnectionRow
from app.models.api_schemas import (
    CreateSurfaceConnectionRequest,
    SurfaceConnectionListResponse,
    SurfaceConnectionResponse,
    UpdateSurfaceConnectionRequest,
)

router = APIRouter(prefix="/surface-connections", tags=["surface-connections"])


def _row_to_response(row: SurfaceConnectionRow) -> SurfaceConnectionResponse:
    return SurfaceConnectionResponse(
        id=row.id,
        workspace_id=row.workspace_id,
        surface=row.surface,
        external_id=row.external_id,
        config=row.config,
        is_active=row.is_active,
        created_at=row.created_at,
    )


@router.get("", response_model=SurfaceConnectionListResponse)
def list_connections(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List surface connections for the current workspace."""
    rows = (
        db.query(SurfaceConnectionRow)
        .filter(SurfaceConnectionRow.workspace_id == current_user["workspace_id"])
        .order_by(SurfaceConnectionRow.created_at.desc())
        .all()
    )
    return SurfaceConnectionListResponse(items=[_row_to_response(r) for r in rows])


@router.post("", response_model=SurfaceConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    body: CreateSurfaceConnectionRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register a new surface connection (email address or Slack workspace)."""
    if body.surface not in ("email", "slack"):
        raise HTTPException(status_code=400, detail="Surface must be 'email' or 'slack'")

    existing = (
        db.query(SurfaceConnectionRow)
        .filter(
            SurfaceConnectionRow.surface == body.surface,
            SurfaceConnectionRow.external_id == body.external_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This surface connection already exists")

    row = SurfaceConnectionRow(
        workspace_id=current_user["workspace_id"],
        user_id=current_user["user_id"],
        surface=body.surface,
        external_id=body.external_id,
        config=body.config or {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return _row_to_response(row)


@router.patch("/{connection_id}", response_model=SurfaceConnectionResponse)
def update_connection(
    connection_id: UUID,
    body: UpdateSurfaceConnectionRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a surface connection (toggle active, update config)."""
    row = (
        db.query(SurfaceConnectionRow)
        .filter(
            SurfaceConnectionRow.id == connection_id,
            SurfaceConnectionRow.workspace_id == current_user["workspace_id"],
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Connection not found")

    if body.is_active is not None:
        row.is_active = body.is_active
    if body.config is not None:
        row.config = body.config

    db.commit()
    db.refresh(row)
    return _row_to_response(row)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a surface connection."""
    row = (
        db.query(SurfaceConnectionRow)
        .filter(
            SurfaceConnectionRow.id == connection_id,
            SurfaceConnectionRow.workspace_id == current_user["workspace_id"],
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Connection not found")

    db.delete(row)
    db.commit()
