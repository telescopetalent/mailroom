"""Review workflow endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.exceptions import NotFoundError, ValidationError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.db.models import ApprovedTaskRow, ApprovedWorkflowRow, CaptureRow, ExtractionRow
from app.models.api_schemas import ReviewResponse, SubmitReviewRequest


def _parse_due_date(value: str | None) -> datetime | None:
    """Parse a due_date string into a datetime, or None if unparseable."""
    if not value:
        return None
    # Try ISO format first (YYYY-MM-DD)
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except (ValueError, TypeError):
        pass
    # Try other common formats
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value, fmt)
        except (ValueError, TypeError):
            pass
    # Unparseable (e.g. "Thursday", "next week") — drop it
    return None

def _make_task(
    extraction: ExtractionRow,
    capture: CaptureRow,
    workspace_id: UUID,
    now: datetime,
    *,
    title: str,
    description: str | None = None,
    owner: str | None = None,
    due_date: datetime | None = None,
    priority: str = "none",
    workflow_id: UUID | None = None,
    workflow_order: int | None = None,
    source_ref_extra: dict | None = None,
) -> ApprovedTaskRow:
    return ApprovedTaskRow(
        extraction_id=extraction.id,
        capture_id=capture.id,
        workspace_id=workspace_id,
        workflow_id=workflow_id,
        workflow_order=workflow_order,
        title=title,
        description=description,
        owner=owner,
        due_date=due_date,
        priority=priority,
        source_ref={**(capture.source_ref or {}), **(source_ref_extra or {})},
        approved_at=now,
        created_at=now,
    )


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

            db.add(_make_task(
                extraction, capture, current_user["workspace_id"], now,
                title=task_data.get("title", "Untitled"),
                description=task_data.get("description"),
                owner=task_data.get("owner"),
                due_date=_parse_due_date(task_data.get("due_date")),
                priority=task_data.get("priority", "none"),
            ))
            approved_count += 1

        elif decision.item_type == "next_step":
            next_steps = extraction.next_steps or []
            if decision.item_index >= len(next_steps):
                continue

            step_text = next_steps[decision.item_index]
            if decision.action == "edit" and decision.edited_value:
                step_text = decision.edited_value.get("title", step_text)

            db.add(_make_task(extraction, capture, current_user["workspace_id"], now, title=step_text))
            approved_count += 1

        elif decision.item_type == "follow_up":
            follow_ups = extraction.follow_ups or []
            if decision.item_index >= len(follow_ups):
                continue

            fu = follow_ups[decision.item_index]
            if decision.action == "edit" and decision.edited_value:
                fu = {**fu, **decision.edited_value}

            db.add(_make_task(
                extraction, capture, current_user["workspace_id"], now,
                title=fu.get("description", "Follow-up"),
                owner=fu.get("owner"),
                due_date=_parse_due_date(fu.get("due_date")),
            ))
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

            steps = wf_data.get("steps", [])
            for order, step in enumerate(steps):
                db.add(_make_task(
                    extraction, capture, current_user["workspace_id"], now,
                    title=step.get("title", "Untitled step"),
                    description=step.get("description"),
                    owner=step.get("owner"),
                    due_date=_parse_due_date(step.get("due_date")),
                    priority=step.get("priority", "none"),
                    workflow_id=workflow.id,
                    workflow_order=order,
                    source_ref_extra={
                        "depends_on_prior": bool(step.get("depends_on_prior")),
                        "sub_tasks": [{"title": st, "completed": False} for st in (step.get("sub_tasks") or [])],
                    },
                ))

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
