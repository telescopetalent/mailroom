"""Capture API endpoints."""

from __future__ import annotations

import json
import math
import os
import uuid as uuid_mod
from datetime import datetime
from io import BytesIO
from typing import Dict, List, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.connectors.web import WebConnector
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.db.models import ApprovedTaskRow, AttachmentRow, CaptureRow, ExtractionRow
from app.models.api_schemas import (
    CreateCaptureRequest,
)
from app.pipeline.orchestrator import run_pipeline
from app.services.model_provider import get_model_provider
from app.services.storage import get_storage

router = APIRouter(prefix="/captures", tags=["captures"])


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _sanitize_filename(filename: str | None) -> str:
    """Strip path components to prevent directory traversal."""
    if not filename:
        return "unnamed"
    # Remove any path separators
    clean = os.path.basename(filename)
    # Remove leading dots to prevent hidden files
    clean = clean.lstrip(".")
    return clean or "unnamed"


def _extraction_to_dict(extraction: ExtractionRow) -> dict:
    """Convert ExtractionRow to a plain dict for JSON serialization."""
    return {
        "id": str(extraction.id),
        "capture_id": str(extraction.capture_id),
        "summary": extraction.summary,
        "next_steps": extraction.next_steps or [],
        "tasks": extraction.tasks or [],
        "workflows": extraction.workflows or [],
        "owners": extraction.owners or [],
        "due_dates": extraction.due_dates or [],
        "blockers": extraction.blockers or [],
        "follow_ups": extraction.follow_ups or [],
        "priority": extraction.priority or "none",
        "source_references": extraction.source_references or [],
        "model_provider": extraction.model_provider,
        "model_id": extraction.model_id,
        "created_at": extraction.created_at.isoformat() if extraction.created_at else None,
    }


def _capture_to_response(
    capture: CaptureRow,
    extraction: ExtractionRow | None,
    attachment_count: int,
) -> dict:
    """Convert DB rows to API response dict."""
    ext = _extraction_to_dict(extraction) if extraction else None

    return {
        "id": str(capture.id),
        "workspace_id": str(capture.workspace_id),
        "user_id": str(capture.user_id),
        "source": capture.source,
        "source_ref": capture.source_ref,
        "content_type": capture.content_type,
        "normalized_text": capture.normalized_text,
        "status": capture.status,
        "captured_at": capture.captured_at.isoformat() if capture.captured_at else None,
        "created_at": capture.created_at.isoformat() if capture.created_at else None,
        "extraction": ext,
        "attachment_count": attachment_count,
    }


def _get_capture_metadata(
    db: Session,
    capture_ids: Sequence[UUID],
) -> tuple[Dict[UUID, ExtractionRow], Dict[UUID, int]]:
    """Batch-load extractions and attachment counts for a list of capture IDs.

    Returns:
        (extractions_by_capture_id, attachment_counts_by_capture_id)
    """
    if not capture_ids:
        return {}, {}

    # Batch-load extractions keyed by capture_id
    extractions_map: Dict[UUID, ExtractionRow] = {}
    extraction_rows = (
        db.query(ExtractionRow)
        .filter(ExtractionRow.capture_id.in_(capture_ids))
        .all()
    )
    for ext in extraction_rows:
        extractions_map[ext.capture_id] = ext

    # Batch-load attachment counts using GROUP BY
    att_counts_map: Dict[UUID, int] = {cid: 0 for cid in capture_ids}
    att_rows = (
        db.query(AttachmentRow.capture_id, func.count(AttachmentRow.id))
        .filter(AttachmentRow.capture_id.in_(capture_ids))
        .group_by(AttachmentRow.capture_id)
        .all()
    )
    for capture_id, count in att_rows:
        att_counts_map[capture_id] = count

    return extractions_map, att_counts_map


def _get_capture_or_404(
    db: Session,
    capture_id: UUID,
    workspace_id: UUID,
    *extra_filters,
) -> CaptureRow:
    """Fetch a capture by ID and workspace, or raise NotFoundError."""
    query = db.query(CaptureRow).filter(
        CaptureRow.id == capture_id,
        CaptureRow.workspace_id == workspace_id,
        *extra_filters,
    )
    capture = query.first()
    if not capture:
        raise NotFoundError("Capture")
    return capture


def _single_capture_response(db: Session, capture: CaptureRow) -> dict:
    """Build a response dict for a single capture with its extraction + attachment count."""
    ext = db.query(ExtractionRow).filter(ExtractionRow.capture_id == capture.id).first()
    att_count = db.query(AttachmentRow).filter(AttachmentRow.capture_id == capture.id).count()
    return _capture_to_response(capture, ext, att_count)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=None, status_code=status.HTTP_201_CREATED)
def create_capture(
    body: CreateCaptureRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new capture and run it through the pipeline.

    mode="ai" (default): full pipeline with AI extraction.
    mode="manual": user provides extraction data, skips AI.
    """
    connector = WebConnector()
    pipeline_args = connector.parse_request(
        body,
        user_id=current_user["user_id"],
        workspace_id=current_user["workspace_id"],
    )

    if body.mode == "manual":
        from app.pipeline.ingest import ingest
        from app.pipeline.classify import classify
        from app.pipeline.normalize import normalize

        ingest_result = ingest(
            user_id=current_user["user_id"],
            workspace_id=current_user["workspace_id"],
            **pipeline_args,
        )
        classify_result = classify(ingest_result)
        capture = normalize(ingest_result, classify_result, db)

        # Build extraction from manual input
        manual = body.manual_extraction
        extraction = ExtractionRow(
            capture_id=capture.id,
            summary=manual.summary if manual else None,
            tasks=[t for t in (manual.tasks if manual else [])],
            next_steps=manual.next_steps if manual else [],
            blockers=manual.blockers if manual else [],
            follow_ups=[f for f in (manual.follow_ups if manual else [])],
            workflows=manual.workflows if manual else [],
            owners=[],
            due_dates=[],
            priority=manual.priority if manual else "none",
            source_references=[],
            model_provider="manual",
            model_id=None,
        )
        db.add(extraction)
        capture.status = "review"
    else:
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

    attachment_count = (
        db.query(AttachmentRow)
        .filter(AttachmentRow.capture_id == capture.id)
        .count()
    )

    return _capture_to_response(capture, extraction, attachment_count)


ALLOWED_FILE_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_FILES = 5


@router.post("/upload", response_model=None, status_code=status.HTTP_201_CREATED)
def create_capture_with_files(
    metadata: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a capture with file uploads (images, PDFs, DOCX).

    metadata: JSON string with {source, content_text, mode}
    files: uploaded files (images, PDFs, DOCX)
    """
    try:
        meta = json.loads(metadata)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid metadata JSON")

    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES} files allowed")

    storage = get_storage()
    file_keys: list[str] = []
    file_metas: list[dict] = []

    for f in files:
        content_type = f.content_type or "application/octet-stream"
        if content_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{content_type}' not supported. Allowed: images, PDF, DOCX",
            )

        file_data = f.file.read()
        if len(file_data) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File '{f.filename}' exceeds 10MB limit")

        safe_name = _sanitize_filename(f.filename)
        key = f"{current_user['workspace_id']}/{uuid_mod.uuid4()}/{safe_name}"
        storage.upload(key, BytesIO(file_data), content_type)

        file_keys.append(key)
        file_metas.append({
            "filename": safe_name,
            "content_type": content_type,
            "size_bytes": len(file_data),
        })

    source = meta.get("source", "web")
    content_text = meta.get("content_text")
    content_url = meta.get("content_url")

    provider = get_model_provider()

    capture, extraction = run_pipeline(
        user_id=current_user["user_id"],
        workspace_id=current_user["workspace_id"],
        source=source,
        provider=provider,
        db=db,
        content_text=content_text,
        content_url=content_url,
        source_ref=None,
        file_keys=file_keys if file_keys else None,
        file_metas=file_metas if file_metas else None,
    )

    db.commit()
    db.refresh(capture)
    db.refresh(extraction)

    attachment_count = (
        db.query(AttachmentRow)
        .filter(AttachmentRow.capture_id == capture.id)
        .count()
    )
    return _capture_to_response(capture, extraction, attachment_count)


@router.get("", response_model=None)
def list_captures(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List captures for the current workspace (excludes trashed)."""
    query = (
        db.query(CaptureRow)
        .filter(
            CaptureRow.workspace_id == current_user["workspace_id"],
            CaptureRow.status != "trashed",
        )
        .order_by(CaptureRow.created_at.desc())
    )

    total = query.count()
    captures = query.offset((page - 1) * page_size).limit(page_size).all()

    # Batch-load extractions and attachment counts (eliminates N+1)
    capture_ids = [cap.id for cap in captures]
    extractions_map, att_counts_map = _get_capture_metadata(db, capture_ids)

    items = [
        _capture_to_response(
            cap,
            extractions_map.get(cap.id),
            att_counts_map.get(cap.id, 0),
        )
        for cap in captures
    ]

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_count": total,
            "total_pages": max(1, math.ceil(total / page_size)),
        },
    }


# ---------------------------------------------------------------------------
# Trash endpoints (must be before /{capture_id} to avoid route conflicts)
# ---------------------------------------------------------------------------


@router.get("/trash", response_model=None)
def list_trashed_captures(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List trashed captures for the current workspace."""
    query = (
        db.query(CaptureRow)
        .filter(
            CaptureRow.workspace_id == current_user["workspace_id"],
            CaptureRow.status == "trashed",
        )
        .order_by(CaptureRow.trashed_at.desc())
    )

    total = query.count()
    captures = query.offset((page - 1) * page_size).limit(page_size).all()

    # Batch-load extractions and attachment counts (eliminates N+1)
    capture_ids = [cap.id for cap in captures]
    extractions_map, att_counts_map = _get_capture_metadata(db, capture_ids)

    items = []
    for cap in captures:
        resp = _capture_to_response(
            cap,
            extractions_map.get(cap.id),
            att_counts_map.get(cap.id, 0),
        )
        resp["trashed_at"] = cap.trashed_at.isoformat() if cap.trashed_at else None
        resp["previous_status"] = cap.previous_status
        items.append(resp)

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_count": total,
            "total_pages": max(1, math.ceil(total / page_size)),
        },
    }


@router.post("/trash/delete-all", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_all_trashed(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete all trashed captures in the workspace."""
    trashed = (
        db.query(CaptureRow)
        .filter(
            CaptureRow.workspace_id == current_user["workspace_id"],
            CaptureRow.status == "trashed",
        )
        .all()
    )

    for cap in trashed:
        db.query(ApprovedTaskRow).filter(ApprovedTaskRow.capture_id == cap.id).update(
            {"capture_id": None, "extraction_id": None}, synchronize_session="fetch"
        )
        db.query(ExtractionRow).filter(ExtractionRow.capture_id == cap.id).delete()
        db.query(AttachmentRow).filter(AttachmentRow.capture_id == cap.id).delete()
        db.delete(cap)

    db.commit()


# ---------------------------------------------------------------------------
# Single capture endpoints (after /trash to avoid route conflicts)
# ---------------------------------------------------------------------------


@router.get("/{capture_id}", response_model=None)
def get_capture(
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single capture with its extraction."""
    capture = _get_capture_or_404(db, capture_id, current_user["workspace_id"])
    return _single_capture_response(db, capture)


@router.post("/{capture_id}/trash", response_model=None)
def trash_capture(
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a capture to trash."""
    capture = _get_capture_or_404(db, capture_id, current_user["workspace_id"])
    if capture.status == "trashed":
        raise ValidationError("Capture is already trashed")

    capture.previous_status = capture.status
    capture.status = "trashed"
    capture.trashed_at = datetime.utcnow()
    db.commit()
    db.refresh(capture)
    return _single_capture_response(db, capture)


@router.post("/{capture_id}/restore", response_model=None)
def restore_capture(
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore a capture from trash."""
    capture = _get_capture_or_404(
        db, capture_id, current_user["workspace_id"],
        CaptureRow.status == "trashed",
    )

    capture.status = capture.previous_status or "review"
    capture.previous_status = None
    capture.trashed_at = None
    db.commit()
    db.refresh(capture)
    return _single_capture_response(db, capture)


@router.post("/{capture_id}/reopen", response_model=None)
def reopen_capture(
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Push an approved/rejected capture back to review status."""
    capture = _get_capture_or_404(db, capture_id, current_user["workspace_id"])
    if capture.status not in ("approved", "rejected"):
        raise ValidationError("Only approved or rejected captures can be reopened")

    capture.status = "review"
    db.commit()
    db.refresh(capture)
    return _single_capture_response(db, capture)


@router.delete("/{capture_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_capture(
    capture_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete a trashed capture."""
    capture = _get_capture_or_404(
        db, capture_id, current_user["workspace_id"],
        CaptureRow.status == "trashed",
    )

    # Orphan approved tasks — they survive capture deletion
    db.query(ApprovedTaskRow).filter(ApprovedTaskRow.capture_id == capture.id).update(
        {"capture_id": None, "extraction_id": None}, synchronize_session="fetch"
    )
    # Delete related rows
    db.query(ExtractionRow).filter(ExtractionRow.capture_id == capture.id).delete()
    db.query(AttachmentRow).filter(AttachmentRow.capture_id == capture.id).delete()
    db.delete(capture)
    db.commit()
