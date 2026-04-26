"""Pipeline stage 3: Normalize into canonical capture and persist to DB."""

from __future__ import annotations

import logging
from datetime import datetime
from io import BytesIO

from sqlalchemy.orm import Session

from app.db.models import AttachmentRow, CaptureRow
from app.pipeline.classify import ClassifyResult
from app.pipeline.ingest import IngestResult
from app.services.storage import get_storage

logger = logging.getLogger("mailroom.pipeline.normalize")


def _extract_pdf_text(data: bytes) -> str:
    """Extract text from a PDF file."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(BytesIO(data))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)
    except Exception:
        logger.exception("Failed to extract text from PDF")
        return ""


def _extract_docx_text(data: bytes) -> str:
    """Extract text from a DOCX file."""
    try:
        from docx import Document
        doc = Document(BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except Exception:
        logger.exception("Failed to extract text from DOCX")
        return ""


def normalize(
    ingest_result: IngestResult,
    classify_result: ClassifyResult,
    db: Session,
) -> CaptureRow:
    """Create a canonical CaptureRow in the database.

    Combines the raw input and classification into a normalized record.
    Also creates AttachmentRows for any uploaded files.
    Extracts text from PDF/DOCX files and flags images for vision processing.
    """
    # Build normalized text from available content
    parts = []
    if ingest_result.raw_text:
        parts.append(ingest_result.raw_text)
    if ingest_result.raw_url:
        parts.append(f"[URL: {ingest_result.raw_url}]")

    # Build raw_content for preservation
    raw_content = {}
    if ingest_result.raw_text:
        raw_content["text"] = ingest_result.raw_text
    if ingest_result.raw_url:
        raw_content["url"] = ingest_result.raw_url

    # Process files: extract text from documents, flag images for vision
    image_keys = []
    storage = get_storage()

    metas = ingest_result.file_metas or []
    keyed_files = list(zip(ingest_result.file_keys, metas))
    # Pad metas if fewer than keys (shouldn't happen, but be safe)
    for i in range(len(keyed_files), len(ingest_result.file_keys)):
        keyed_files.append((ingest_result.file_keys[i], {}))

    for key, meta in keyed_files:
        ct = meta.get("content_type", "")
        filename = meta.get("filename", key)

        if ct == "application/pdf":
            try:
                file_data = storage.download(key)
                text = _extract_pdf_text(file_data)
                if text:
                    parts.append(f"[Extracted from: {filename}]\n{text}")
                    logger.info("Extracted %d chars from PDF %s", len(text), filename)
            except Exception:
                logger.exception("Failed to download/extract PDF %s", key)

        elif ct == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            try:
                file_data = storage.download(key)
                text = _extract_docx_text(file_data)
                if text:
                    parts.append(f"[Extracted from: {filename}]\n{text}")
                    logger.info("Extracted %d chars from DOCX %s", len(text), filename)
            except Exception:
                logger.exception("Failed to download/extract DOCX %s", key)

        elif ct.startswith("image/"):
            image_keys.append(key)

    if image_keys:
        raw_content["image_keys"] = image_keys

    normalized_text = "\n\n".join(parts) if parts else None

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

    for key, meta in keyed_files:
        attachment = AttachmentRow(
            capture_id=capture.id,
            filename=meta.get("filename", key),
            content_type=meta.get("content_type", "application/octet-stream"),
            s3_key=key,
            size_bytes=meta.get("size_bytes", 0),
            created_at=now,
        )
        db.add(attachment)

    return capture
