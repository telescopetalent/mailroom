"""Project endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.db.models import CaptureRow, ProjectRow
from app.models.api_schemas import (
    CreateProjectRequest,
    ProjectListResponse,
    ProjectResponse,
    UpdateProjectRequest,
)

router = APIRouter(prefix="/projects", tags=["projects"])

CAPTURE_ACTIVE_STATUSES = ("pending", "processing", "review", "approved", "rejected")


def _project_to_response(project: ProjectRow, capture_count: int) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        workspace_id=project.workspace_id,
        name=project.name,
        description=project.description,
        color=project.color,
        capture_count=capture_count,
        created_at=project.created_at,
    )


def _get_project_or_404(db: Session, project_id: UUID, workspace_id: UUID) -> ProjectRow:
    project = (
        db.query(ProjectRow)
        .filter(
            ProjectRow.id == project_id,
            ProjectRow.workspace_id == workspace_id,
        )
        .first()
    )
    if not project:
        raise NotFoundError("Project")
    return project


def _capture_counts(db: Session, project_ids: list[UUID]) -> dict[UUID, int]:
    """Batch-load non-trashed capture counts per project."""
    if not project_ids:
        return {}
    rows = (
        db.query(CaptureRow.project_id, func.count(CaptureRow.id))
        .filter(
            CaptureRow.project_id.in_(project_ids),
            CaptureRow.status.in_(CAPTURE_ACTIVE_STATUSES),
        )
        .group_by(CaptureRow.project_id)
        .all()
    )
    return {pid: count for pid, count in rows}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=ProjectListResponse)
def list_projects(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all projects for the current workspace."""
    projects = (
        db.query(ProjectRow)
        .filter(ProjectRow.workspace_id == current_user["workspace_id"])
        .order_by(ProjectRow.created_at.asc())
        .all()
    )
    counts = _capture_counts(db, [p.id for p in projects])
    return ProjectListResponse(
        items=[_project_to_response(p, counts.get(p.id, 0)) for p in projects]
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    body: CreateProjectRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project."""
    name = (body.name or "").strip()
    if not name:
        raise ValidationError("name is required")

    from datetime import datetime
    project = ProjectRow(
        workspace_id=current_user["workspace_id"],
        name=name,
        description=body.description,
        color=body.color or "#7c3aed",
        created_at=datetime.utcnow(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_response(project, 0)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single project."""
    project = _get_project_or_404(db, project_id, current_user["workspace_id"])
    counts = _capture_counts(db, [project.id])
    return _project_to_response(project, counts.get(project.id, 0))


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    body: UpdateProjectRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a project's name, description, or color."""
    project = _get_project_or_404(db, project_id, current_user["workspace_id"])

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise ValidationError("name cannot be empty")
        project.name = name
    if body.description is not None:
        project.description = body.description
    if body.color is not None:
        project.color = body.color

    db.commit()
    db.refresh(project)
    counts = _capture_counts(db, [project.id])
    return _project_to_response(project, counts.get(project.id, 0))


@router.delete("/{project_id}")
def delete_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a project (captures are unassigned, not deleted)."""
    project = _get_project_or_404(db, project_id, current_user["workspace_id"])

    # Null out project_id on all associated captures
    db.query(CaptureRow).filter(CaptureRow.project_id == project.id).update(
        {"project_id": None}
    )
    db.delete(project)
    db.commit()
    return {"status": "ok"}


@router.post("/{project_id}/captures/{capture_id}")
def add_capture_to_project(
    project_id: UUID,
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign a capture to a project."""
    project = _get_project_or_404(db, project_id, current_user["workspace_id"])

    capture = (
        db.query(CaptureRow)
        .filter(
            CaptureRow.id == capture_id,
            CaptureRow.workspace_id == current_user["workspace_id"],
        )
        .first()
    )
    if not capture:
        raise NotFoundError("Capture")

    capture.project_id = project.id
    db.commit()
    return {"status": "ok"}


@router.delete("/{project_id}/captures/{capture_id}")
def remove_capture_from_project(
    project_id: UUID,
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a capture from a project."""
    _get_project_or_404(db, project_id, current_user["workspace_id"])

    capture = (
        db.query(CaptureRow)
        .filter(
            CaptureRow.id == capture_id,
            CaptureRow.workspace_id == current_user["workspace_id"],
            CaptureRow.project_id == project_id,
        )
        .first()
    )
    if not capture:
        raise NotFoundError("Capture")

    capture.project_id = None
    db.commit()
    return {"status": "ok"}
