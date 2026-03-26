"""Approved task endpoints."""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.db.models import ApprovedTaskRow, CaptureRow
from app.models.api_schemas import (
    PaginationMeta,
    TaskListResponse,
    TaskResponse,
    UpdateTaskRequest,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _task_to_response(task: ApprovedTaskRow, source: str) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        title=task.title,
        description=task.description,
        owner=task.owner,
        due_date=task.due_date,
        priority=task.priority or "none",
        status=task.status,
        source=source,
        source_ref=task.source_ref,
        capture_id=task.capture_id,
        extraction_id=task.extraction_id,
        approved_at=task.approved_at,
        created_at=task.created_at,
    )


@router.get("", response_model=TaskListResponse)
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List approved tasks for the current workspace."""
    query = (
        db.query(ApprovedTaskRow)
        .filter(ApprovedTaskRow.workspace_id == current_user["workspace_id"])
        .order_by(ApprovedTaskRow.created_at.desc())
    )

    total = query.count()
    tasks = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for task in tasks:
        capture = db.query(CaptureRow).filter(CaptureRow.id == task.capture_id).first()
        source = capture.source if capture else "web"
        items.append(_task_to_response(task, source))

    return TaskListResponse(
        items=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total,
            total_pages=max(1, math.ceil(total / page_size)),
        ),
    )


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single approved task."""
    task = (
        db.query(ApprovedTaskRow)
        .filter(
            ApprovedTaskRow.id == task_id,
            ApprovedTaskRow.workspace_id == current_user["workspace_id"],
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    capture = db.query(CaptureRow).filter(CaptureRow.id == task.capture_id).first()
    source = capture.source if capture else "web"

    return _task_to_response(task, source)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: UUID,
    body: UpdateTaskRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an approved task (status, owner, due_date, priority)."""
    task = (
        db.query(ApprovedTaskRow)
        .filter(
            ApprovedTaskRow.id == task_id,
            ApprovedTaskRow.workspace_id == current_user["workspace_id"],
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if body.status is not None:
        task.status = body.status.value if hasattr(body.status, "value") else body.status
    if body.owner is not None:
        task.owner = body.owner
    if body.due_date is not None:
        task.due_date = body.due_date
    if body.priority is not None:
        task.priority = body.priority.value if hasattr(body.priority, "value") else body.priority

    db.commit()
    db.refresh(task)

    capture = db.query(CaptureRow).filter(CaptureRow.id == task.capture_id).first()
    source = capture.source if capture else "web"

    return _task_to_response(task, source)
