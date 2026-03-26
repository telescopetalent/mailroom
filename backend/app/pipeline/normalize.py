"""Pipeline stage 3: Normalize into canonical capture and persist to DB."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import AttachmentRow, CaptureRow
from app.pipeline.classify import ClassifyResult
from app.pipeline.ingest import IngestResult


def normalize(
    ingest_result: IngestResult,
    classify_result: ClassifyResult,
    db: Session,
) -> CaptureRow:
    """Create a canonical CaptureRow in the database.

    Combines the raw input and classification into a normalized record.
    Also creates AttachmentRows for any uploaded files.
    """
    # Build normalized text from available content
    parts = []
    if ingest_result.raw_text:
        parts.append(ingest_result.raw_text)
    if ingest_result.raw_url:
        parts.append(f"[URL: {ingest_result.raw_url}]")

    normalized_text = "\n\n".join(parts) if parts else None

    # Build raw_content for preservation
    raw_content = {}
    if ingest_result.raw_text:
        raw_content["text"] = ingest_result.raw_text
    if ingest_result.raw_url:
        raw_content["url"] = ingest_result.raw_url

    now = datetime.utcnow()

    capture = CaptureRow(
        workspace_id=ingest_result.workspace_id,
        user_id=ingest_result.user_id,
        source=ingest_result.source,
        source_ref=ingest_result.source_ref,
        content_type=classify_result.content_type,
        raw_content=raw_content,
        normalized_text=normalized_text,
        status="processing",
        captured_at=now,
        created_at=now,
    )
    db.add(capture)
    db.flush()  # Get capture.id for attachments

    # Create attachment records
    for i, key in enumerate(ingest_result.file_keys):
        meta = ingest_result.file_metas[i] if i < len(ingest_result.file_metas) else {}
        attachment = AttachmentRow(
            capture_id=capture.id,
            filename=meta.get("filename", f"file_{i}"),
            content_type=meta.get("content_type", "application/octet-stream"),
            s3_key=key,
            size_bytes=meta.get("size_bytes", 0),
            created_at=now,
        )
        db.add(attachment)

    return capture
