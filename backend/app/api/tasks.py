"""Approved task endpoints."""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.db.models import ApprovedTaskRow, ApprovedWorkflowRow, CaptureRow
from app.models.api_schemas import (
    PaginationMeta,
    TaskListResponse,
    TaskResponse,
    UpdateTaskRequest,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

NULL_UUID = "00000000-0000-0000-0000-000000000000"


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _load_task_context(
    db: Session,
    task: ApprovedTaskRow,
    *,
    source_cache: dict[UUID, str] | None = None,
    workflow_cache: dict[UUID, str | None] | None = None,
) -> tuple[str, str | None]:
    """Return (source, workflow_name) for a task, using optional caches.

    Uses the provided caches to avoid repeated queries when called in a loop.
    """
    # Resolve source from capture
    if source_cache is not None and task.capture_id in source_cache:
        source = source_cache[task.capture_id]
    else:
        capture = (
            db.query(CaptureRow.source)
            .filter(CaptureRow.id == task.capture_id)
            .first()
        )
        source = capture.source if capture else "web"
        if source_cache is not None:
            source_cache[task.capture_id] = source

    # Resolve workflow name
    wf_name: str | None = None
    if task.workflow_id:
        if workflow_cache is not None and task.workflow_id in workflow_cache:
            wf_name = workflow_cache[task.workflow_id]
        else:
            wf = (
                db.query(ApprovedWorkflowRow.name)
                .filter(ApprovedWorkflowRow.id == task.workflow_id)
                .first()
            )
            wf_name = wf.name if wf else None
            if workflow_cache is not None:
                workflow_cache[task.workflow_id] = wf_name

    return source, wf_name


def _sync_workflow_status(db: Session, workflow_id: UUID) -> None:
    """Recompute workflow open/completed status using COUNT (no row loading)."""
    wf = (
        db.query(ApprovedWorkflowRow)
        .filter(ApprovedWorkflowRow.id == workflow_id)
        .first()
    )
    if not wf:
        return

    incomplete_count: int = (
        db.query(func.count(ApprovedTaskRow.id))
        .filter(
            ApprovedTaskRow.workflow_id == workflow_id,
            ApprovedTaskRow.status != "completed",
        )
        .scalar()
    ) or 0

    if incomplete_count == 0 and wf.status != "completed":
        wf.status = "completed"
    elif incomplete_count > 0 and wf.status == "completed":
        wf.status = "open"


def _apply_task_updates(task: ApprovedTaskRow, body: UpdateTaskRequest) -> None:
    """Apply all field assignments from *body* onto *task*."""
    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.status is not None:
        task.status = body.status.value if hasattr(body.status, "value") else body.status
    if body.owner is not None:
        task.owner = body.owner
    if body.due_date is not None:
        task.due_date = body.due_date
    if body.priority is not None:
        task.priority = body.priority.value if hasattr(body.priority, "value") else body.priority
    if body.labels is not None:
        task.labels = body.labels
    if body.reminder is not None:
        task.reminder = body.reminder
    if body.location is not None:
        task.location = body.location
    if body.notes is not None:
        task.notes = body.notes
    if body.blocked_by_workflow_id is not None:
        task.blocked_by_workflow_id = (
            body.blocked_by_workflow_id
            if str(body.blocked_by_workflow_id) != NULL_UUID
            else None
        )
    if body.blocked_by_task_id is not None:
        task.blocked_by_task_id = (
            body.blocked_by_task_id
            if str(body.blocked_by_task_id) != NULL_UUID
            else None
        )


def _task_to_response(
    task: ApprovedTaskRow,
    source: str,
    workflow_name: str | None = None,
    db: Session | None = None,
) -> TaskResponse:
    """Build a TaskResponse, resolving blocked-by names if *db* is provided."""
    blocked_by_wf_name: str | None = None
    blocked_by_task_title: str | None = None
    is_blocked = False

    if db and task.blocked_by_workflow_id:
        bwf = (
            db.query(ApprovedWorkflowRow)
            .filter(ApprovedWorkflowRow.id == task.blocked_by_workflow_id)
            .first()
        )
        if bwf:
            blocked_by_wf_name = bwf.name
            is_blocked = bwf.status != "completed"

    if db and task.blocked_by_task_id:
        bt = (
            db.query(ApprovedTaskRow)
            .filter(ApprovedTaskRow.id == task.blocked_by_task_id)
            .first()
        )
        if bt:
            blocked_by_task_title = bt.title
            is_blocked = is_blocked or bt.status != "completed"

    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        title=task.title,
        description=task.description,
        owner=task.owner,
        due_date=task.due_date,
        priority=task.priority or "none",
        labels=task.labels or [],
        reminder=task.reminder,
        location=task.location,
        notes=task.notes,
        blocked_by_workflow_id=task.blocked_by_workflow_id,
        blocked_by_workflow_name=blocked_by_wf_name,
        blocked_by_task_id=task.blocked_by_task_id,
        blocked_by_task_title=blocked_by_task_title,
        is_blocked=is_blocked,
        status=task.status,
        source=source,
        source_ref=task.source_ref,
        capture_id=task.capture_id,
        extraction_id=task.extraction_id,
        workflow_id=task.workflow_id,
        workflow_name=workflow_name,
        workflow_order=task.workflow_order,
        approved_at=task.approved_at,
        created_at=task.created_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=TaskListResponse)
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None, description="Filter by status: open, completed"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List approved tasks for the current workspace."""
    query = (
        db.query(ApprovedTaskRow)
        .filter(ApprovedTaskRow.workspace_id == current_user["workspace_id"])
        .order_by(ApprovedTaskRow.created_at.desc())
    )

    if status:
        query = query.filter(ApprovedTaskRow.status == status)

    total = query.count()
    tasks = query.offset((page - 1) * page_size).limit(page_size).all()

    # Shared caches eliminate repeated queries across the page of tasks
    source_cache: dict[UUID, str] = {}
    workflow_cache: dict[UUID, str | None] = {}

    items = []
    for task in tasks:
        source, wf_name = _load_task_context(
            db, task, source_cache=source_cache, workflow_cache=workflow_cache
        )
        items.append(_task_to_response(task, source, wf_name, db))

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
        raise NotFoundError("Task")

    source, wf_name = _load_task_context(db, task)
    return _task_to_response(task, source, wf_name, db)


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
        raise NotFoundError("Task")

    _apply_task_updates(task, body)

    # Auto-complete/reopen parent workflow if this task belongs to one
    if task.workflow_id:
        _sync_workflow_status(db, task.workflow_id)

    db.commit()
    db.refresh(task)

    source, wf_name = _load_task_context(db, task)
    return _task_to_response(task, source, wf_name, db)


@router.post("/{task_id}/subtasks/{subtask_index}/toggle")
def toggle_subtask(
    task_id: UUID,
    subtask_index: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle a sub-task's completed status. Auto-completes parent if all sub-tasks done."""
    task = (
        db.query(ApprovedTaskRow)
        .filter(
            ApprovedTaskRow.id == task_id,
            ApprovedTaskRow.workspace_id == current_user["workspace_id"],
        )
        .first()
    )
    if not task:
        raise NotFoundError("Task")

    source_ref = dict(task.source_ref or {})
    sub_tasks = list(source_ref.get("sub_tasks", []))
    if subtask_index < 0 or subtask_index >= len(sub_tasks):
        raise ValidationError("Invalid sub-task index")

    sub_tasks[subtask_index] = {
        **sub_tasks[subtask_index],
        "completed": not sub_tasks[subtask_index].get("completed", False),
    }
    source_ref["sub_tasks"] = sub_tasks
    task.source_ref = source_ref

    # Auto-complete parent if all sub-tasks done
    all_done = all(st.get("completed") for st in sub_tasks)
    if all_done and sub_tasks and task.status != "completed":
        task.status = "completed"
    elif not all_done and task.status == "completed":
        task.status = "open"

    # Auto-complete/reopen parent workflow
    if task.workflow_id:
        _sync_workflow_status(db, task.workflow_id)

    db.commit()
    db.refresh(task)

    return {"status": "ok", "sub_tasks": sub_tasks, "task_status": task.status}
