"""Approved task endpoints."""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.exceptions import NotFoundError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.db.models import ApprovedTaskRow, ApprovedWorkflowRow, CaptureRow
from app.models.api_schemas import (
    PaginationMeta,
    TaskListResponse,
    TaskResponse,
    UpdateTaskRequest,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _task_to_response(
    task: ApprovedTaskRow,
    source: str,
    workflow_name: str | None = None,
    db: Session | None = None,
) -> TaskResponse:
    # Resolve dependency names and blocked status
    blocked_by_wf_name = None
    blocked_by_task_title = None
    is_blocked = False

    if db and task.blocked_by_workflow_id:
        bwf = db.query(ApprovedWorkflowRow).filter(ApprovedWorkflowRow.id == task.blocked_by_workflow_id).first()
        if bwf:
            blocked_by_wf_name = bwf.name
            is_blocked = bwf.status != "completed"

    if db and task.blocked_by_task_id:
        bt = db.query(ApprovedTaskRow).filter(ApprovedTaskRow.id == task.blocked_by_task_id).first()
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

    # Cache workflow names to avoid N+1
    workflow_names: dict = {}

    items = []
    for task in tasks:
        capture = db.query(CaptureRow).filter(CaptureRow.id == task.capture_id).first()
        source = capture.source if capture else "web"

        wf_name = None
        if task.workflow_id:
            if task.workflow_id not in workflow_names:
                wf = db.query(ApprovedWorkflowRow).filter(ApprovedWorkflowRow.id == task.workflow_id).first()
                workflow_names[task.workflow_id] = wf.name if wf else None
            wf_name = workflow_names[task.workflow_id]

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

    capture = db.query(CaptureRow).filter(CaptureRow.id == task.capture_id).first()
    source = capture.source if capture else "web"

    wf_name = None
    if task.workflow_id:
        wf = db.query(ApprovedWorkflowRow).filter(ApprovedWorkflowRow.id == task.workflow_id).first()
        wf_name = wf.name if wf else None

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
        task.blocked_by_workflow_id = body.blocked_by_workflow_id if str(body.blocked_by_workflow_id) != "00000000-0000-0000-0000-000000000000" else None
    if body.blocked_by_task_id is not None:
        task.blocked_by_task_id = body.blocked_by_task_id if str(body.blocked_by_task_id) != "00000000-0000-0000-0000-000000000000" else None

    db.commit()
    db.refresh(task)

    # Auto-complete/reopen parent workflow if this task belongs to one
    if task.workflow_id:
        siblings = (
            db.query(ApprovedTaskRow)
            .filter(ApprovedTaskRow.workflow_id == task.workflow_id)
            .all()
        )
        all_completed = all(s.status == "completed" for s in siblings)
        wf = db.query(ApprovedWorkflowRow).filter(ApprovedWorkflowRow.id == task.workflow_id).first()
        if wf:
            if all_completed and wf.status != "completed":
                wf.status = "completed"
                db.commit()
            elif not all_completed and wf.status == "completed":
                wf.status = "open"
                db.commit()

    capture = db.query(CaptureRow).filter(CaptureRow.id == task.capture_id).first()
    source = capture.source if capture else "web"

    wf_name = None
    if task.workflow_id:
        wf = db.query(ApprovedWorkflowRow).filter(ApprovedWorkflowRow.id == task.workflow_id).first()
        wf_name = wf.name if wf else None

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
        from app.core.exceptions import ValidationError
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

    db.commit()
    db.refresh(task)

    # Auto-complete/reopen parent workflow
    if task.workflow_id:
        siblings = db.query(ApprovedTaskRow).filter(ApprovedTaskRow.workflow_id == task.workflow_id).all()
        wf_all_done = all(s.status == "completed" for s in siblings)
        wf = db.query(ApprovedWorkflowRow).filter(ApprovedWorkflowRow.id == task.workflow_id).first()
        if wf:
            if wf_all_done and wf.status != "completed":
                wf.status = "completed"
                db.commit()
            elif not wf_all_done and wf.status == "completed":
                wf.status = "open"
                db.commit()

    return {"status": "ok", "sub_tasks": sub_tasks, "task_status": task.status}
