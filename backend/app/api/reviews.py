"""Review workflow endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.exceptions import NotFoundError, ValidationError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.db.models import ApprovedTaskRow, ApprovedWorkflowRow, CaptureRow, ExtractionRow
from app.models.api_schemas import ReviewResponse, SubmitReviewRequest

router = APIRouter(prefix="/captures", tags=["reviews"])


@router.patch("/{capture_id}/review", response_model=ReviewResponse)
def submit_review(
    capture_id: UUID,
    body: SubmitReviewRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit review decisions for a capture's extraction.

    Each decision approves, edits, or rejects an extracted item.
    Approved tasks are saved to the approved_tasks table.
    """
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

    if capture.status not in ("review", "approved", "rejected"):
        raise ValidationError(f"Capture is in '{capture.status}' status, not reviewable")

    extraction = db.query(ExtractionRow).filter(ExtractionRow.capture_id == capture.id).first()
    if not extraction:
        raise ValidationError("No extraction found for this capture")

    approved_count = 0
    rejected_count = 0
    now = datetime.utcnow()

    for decision in body.decisions:
        if decision.action == "reject":
            rejected_count += 1
            continue

        if decision.item_type == "task":
            tasks = extraction.tasks or []
            if decision.item_index >= len(tasks):
                continue

            task_data = tasks[decision.item_index]

            # If edited, merge edits
            if decision.action == "edit" and decision.edited_value:
                task_data = {**task_data, **decision.edited_value}

            approved_task = ApprovedTaskRow(
                extraction_id=extraction.id,
                capture_id=capture.id,
                workspace_id=current_user["workspace_id"],
                title=task_data.get("title", "Untitled"),
                description=task_data.get("description"),
                owner=task_data.get("owner"),
                due_date=task_data.get("due_date"),
                priority=task_data.get("priority", "none"),
                source_ref=capture.source_ref or {},
                approved_at=now,
                created_at=now,
            )
            db.add(approved_task)
            approved_count += 1

        elif decision.item_type == "next_step":
            next_steps = extraction.next_steps or []
            if decision.item_index >= len(next_steps):
                continue

            step_text = next_steps[decision.item_index]
            if decision.action == "edit" and decision.edited_value:
                step_text = decision.edited_value.get("title", step_text)

            approved_task = ApprovedTaskRow(
                extraction_id=extraction.id,
                capture_id=capture.id,
                workspace_id=current_user["workspace_id"],
                title=step_text,
                priority="none",
                source_ref=capture.source_ref or {},
                approved_at=now,
                created_at=now,
            )
            db.add(approved_task)
            approved_count += 1

        elif decision.item_type == "follow_up":
            follow_ups = extraction.follow_ups or []
            if decision.item_index >= len(follow_ups):
                continue

            fu = follow_ups[decision.item_index]
            if decision.action == "edit" and decision.edited_value:
                fu = {**fu, **decision.edited_value}

            approved_task = ApprovedTaskRow(
                extraction_id=extraction.id,
                capture_id=capture.id,
                workspace_id=current_user["workspace_id"],
                title=fu.get("description", "Follow-up"),
                owner=fu.get("owner"),
                due_date=fu.get("due_date"),
                priority="none",
                source_ref=capture.source_ref or {},
                approved_at=now,
                created_at=now,
            )
            db.add(approved_task)
            approved_count += 1

        elif decision.item_type == "workflow":
            workflows = extraction.workflows or []
            if decision.item_index >= len(workflows):
                continue

            wf_data = workflows[decision.item_index]

            if decision.action == "reject":
                rejected_count += 1
                continue

            # If edited, merge edits (supports reordering steps)
            if decision.action == "edit" and decision.edited_value:
                wf_data = {**wf_data, **decision.edited_value}

            # Create workflow record
            workflow = ApprovedWorkflowRow(
                workspace_id=current_user["workspace_id"],
                capture_id=capture.id,
                extraction_id=extraction.id,
                name=wf_data.get("name", "Untitled workflow"),
                description=wf_data.get("description"),
                status="open",
                approved_at=now,
                created_at=now,
            )
            db.add(workflow)
            db.flush()  # Get workflow.id

            # Create a task for each step in order
            steps = wf_data.get("steps", [])
            for order, step in enumerate(steps):
                task = ApprovedTaskRow(
                    extraction_id=extraction.id,
                    capture_id=capture.id,
                    workspace_id=current_user["workspace_id"],
                    workflow_id=workflow.id,
                    workflow_order=order,
                    title=step.get("title", "Untitled step"),
                    description=step.get("description"),
                    owner=step.get("owner"),
                    due_date=step.get("due_date"),
                    priority=step.get("priority", "none"),
                    source_ref=capture.source_ref or {},
                    approved_at=now,
                    created_at=now,
                )
                db.add(task)

            approved_count += 1

        else:
            # Unknown item type — approve as generic task
            if decision.action == "approve":
                approved_count += 1

    # Update capture status
    if approved_count > 0:
        capture.status = "approved"
    elif rejected_count > 0 and approved_count == 0:
        capture.status = "rejected"

    db.commit()

    return ReviewResponse(
        capture_id=capture.id,
        status=capture.status,
        approved_task_count=approved_count,
        rejected_item_count=rejected_count,
    )
