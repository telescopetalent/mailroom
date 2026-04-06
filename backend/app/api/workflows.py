"""Workflow endpoints."""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.db.models import ApprovedTaskRow, ApprovedWorkflowRow
from app.models.api_schemas import (
    PaginationMeta,
    SubTaskResponse,
    UpdateWorkflowRequest,
    WorkflowListResponse,
    WorkflowResponse,
    WorkflowTaskResponse,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _workflow_to_response(workflow: ApprovedWorkflowRow, tasks: list[ApprovedTaskRow]) -> WorkflowResponse:
    return WorkflowResponse(
        id=workflow.id,
        workspace_id=workflow.workspace_id,
        name=workflow.name,
        description=workflow.description,
        status=workflow.status,
        capture_id=workflow.capture_id,
        tasks=[
            WorkflowTaskResponse(
                id=t.id,
                title=t.title,
                description=t.description,
                owner=t.owner,
                due_date=t.due_date,
                priority=t.priority or "none",
                status=t.status,
                workflow_order=t.workflow_order or 0,
                depends_on_prior=bool((t.source_ref or {}).get("depends_on_prior")),
                sub_tasks=[
                    SubTaskResponse(title=st["title"], completed=st.get("completed", False))
                    for st in (t.source_ref or {}).get("sub_tasks", [])
                ],
            )
            for t in sorted(tasks, key=lambda t: t.workflow_order or 0)
        ],
        approved_at=workflow.approved_at,
        created_at=workflow.created_at,
    )


def _get_workflow_with_tasks(
    db: Session, workflow_id: UUID, workspace_id: UUID,
) -> tuple[ApprovedWorkflowRow, list[ApprovedTaskRow]]:
    """Fetch a workflow and its tasks, or raise NotFoundError."""
    wf = (
        db.query(ApprovedWorkflowRow)
        .filter(
            ApprovedWorkflowRow.id == workflow_id,
            ApprovedWorkflowRow.workspace_id == workspace_id,
        )
        .first()
    )
    if not wf:
        raise NotFoundError("Workflow")

    tasks = (
        db.query(ApprovedTaskRow)
        .filter(ApprovedTaskRow.workflow_id == wf.id)
        .order_by(ApprovedTaskRow.workflow_order)
        .all()
    )
    return wf, tasks


@router.get("", response_model=WorkflowListResponse)
def list_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None, description="Filter by status: open, completed"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List workflows for the current workspace."""
    query = (
        db.query(ApprovedWorkflowRow)
        .filter(ApprovedWorkflowRow.workspace_id == current_user["workspace_id"])
        .order_by(ApprovedWorkflowRow.created_at.desc())
    )

    if status:
        query = query.filter(ApprovedWorkflowRow.status == status)

    total = query.count()
    workflows = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for wf in workflows:
        tasks = (
            db.query(ApprovedTaskRow)
            .filter(ApprovedTaskRow.workflow_id == wf.id)
            .order_by(ApprovedTaskRow.workflow_order)
            .all()
        )
        items.append(_workflow_to_response(wf, tasks))

    return WorkflowListResponse(
        items=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total,
            total_pages=max(1, math.ceil(total / page_size)),
        ),
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single workflow with its tasks."""
    wf, tasks = _get_workflow_with_tasks(db, workflow_id, current_user["workspace_id"])
    return _workflow_to_response(wf, tasks)


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: UUID,
    body: UpdateWorkflowRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a workflow (name, status)."""
    wf, tasks = _get_workflow_with_tasks(db, workflow_id, current_user["workspace_id"])

    if body.name is not None:
        wf.name = body.name
    if body.status is not None:
        wf.status = body.status.value if hasattr(body.status, "value") else body.status

    db.commit()
    db.refresh(wf)

    tasks = (
        db.query(ApprovedTaskRow)
        .filter(ApprovedTaskRow.workflow_id == wf.id)
        .order_by(ApprovedTaskRow.workflow_order)
        .all()
    )
    return _workflow_to_response(wf, tasks)


@router.post("/{workflow_id}/reorder", response_model=WorkflowResponse)
def reorder_workflow_steps(
    workflow_id: UUID,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reorder steps within a workflow. Body: {"task_ids": ["id1", "id2", ...]}"""
    wf, _ = _get_workflow_with_tasks(db, workflow_id, current_user["workspace_id"])

    task_ids = body.get("task_ids", [])
    for order, tid in enumerate(task_ids):
        task = (
            db.query(ApprovedTaskRow)
            .filter(ApprovedTaskRow.id == tid, ApprovedTaskRow.workflow_id == wf.id)
            .first()
        )
        if task:
            task.workflow_order = order

    db.commit()

    tasks = (
        db.query(ApprovedTaskRow)
        .filter(ApprovedTaskRow.workflow_id == wf.id)
        .order_by(ApprovedTaskRow.workflow_order)
        .all()
    )
    return _workflow_to_response(wf, tasks)
