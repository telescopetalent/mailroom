"""Capture API endpoints."""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.connectors.web import WebConnector
from app.core.auth import get_current_user
from app.core.database import get_db
from app.db.models import AttachmentRow, CaptureRow, ExtractionRow
from app.models.api_schemas import (
    CaptureListResponse,
    CaptureResponse,
    CreateCaptureRequest,
    PaginationMeta,
)
from app.models.extraction import Extraction
from app.pipeline.orchestrator import run_pipeline
from app.services.model_provider import get_model_provider

router = APIRouter(prefix="/captures", tags=["captures"])


def _capture_to_response(capture: CaptureRow, extraction: ExtractionRow | None, attachment_count: int) -> CaptureResponse:
    """Convert DB rows to API response."""
    ext = None
    if extraction:
        ext = Extraction(
            id=extraction.id,
            capture_id=extraction.capture_id,
            summary=extraction.summary,
            next_steps=extraction.next_steps or [],
            tasks=extraction.tasks or [],
            owners=extraction.owners or [],
            due_dates=extraction.due_dates or [],
            blockers=extraction.blockers or [],
            follow_ups=extraction.follow_ups or [],
            priority=extraction.priority or "none",
            source_references=extraction.source_references or [],
            model_provider=extraction.model_provider,
            model_id=extraction.model_id,
            created_at=extraction.created_at,
        )

    return CaptureResponse(
        id=capture.id,
        workspace_id=capture.workspace_id,
        user_id=capture.user_id,
        source=capture.source,
        source_ref=capture.source_ref,
        content_type=capture.content_type,
        normalized_text=capture.normalized_text,
        status=capture.status,
        captured_at=capture.captured_at,
        created_at=capture.created_at,
        extraction=ext,
        attachment_count=attachment_count,
    )


@router.post("", response_model=CaptureResponse, status_code=status.HTTP_201_CREATED)
def create_capture(
    body: CreateCaptureRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new capture and run it through the pipeline."""
    connector = WebConnector()
    pipeline_args = connector.parse_request(
        body,
        user_id=current_user["user_id"],
        workspace_id=current_user["workspace_id"],
    )

    provider = get_model_provider()

    capture, extraction = run_pipeline(
        user_id=current_user["user_id"],
        workspace_id=current_user["workspace_id"],
        provider=provider,
        db=db,
        **pipeline_args,
    )

    db.commit()
    db.refresh(capture)
    db.refresh(extraction)

    attachment_count = db.query(AttachmentRow).filter(AttachmentRow.capture_id == capture.id).count()

    return _capture_to_response(capture, extraction, attachment_count)


@router.get("", response_model=CaptureListResponse)
def list_captures(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List captures for the current workspace."""
    query = (
        db.query(CaptureRow)
        .filter(CaptureRow.workspace_id == current_user["workspace_id"])
        .order_by(CaptureRow.created_at.desc())
    )

    total = query.count()
    captures = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for cap in captures:
        ext = db.query(ExtractionRow).filter(ExtractionRow.capture_id == cap.id).first()
        att_count = db.query(AttachmentRow).filter(AttachmentRow.capture_id == cap.id).count()
        items.append(_capture_to_response(cap, ext, att_count))

    return CaptureListResponse(
        items=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total,
            total_pages=max(1, math.ceil(total / page_size)),
        ),
    )


@router.get("/{capture_id}", response_model=CaptureResponse)
def get_capture(
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single capture with its extraction."""
    capture = (
        db.query(CaptureRow)
        .filter(
            CaptureRow.id == capture_id,
            CaptureRow.workspace_id == current_user["workspace_id"],
        )
        .first()
    )
    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    extraction = db.query(ExtractionRow).filter(ExtractionRow.capture_id == capture.id).first()
    att_count = db.query(AttachmentRow).filter(AttachmentRow.capture_id == capture.id).count()

    return _capture_to_response(capture, extraction, att_count)
