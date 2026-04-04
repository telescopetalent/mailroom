"""Pipeline orchestrator — coordinates all stages sequentially."""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import CaptureRow, ExtractionRow
from app.pipeline.classify import classify
from app.pipeline.extract import extract
from app.pipeline.ingest import ingest
from app.pipeline.normalize import normalize
from app.services.model_provider import ModelProvider

logger = logging.getLogger("mailroom.pipeline")


def run_pipeline(
    user_id: UUID,
    workspace_id: UUID,
    source: str,
    provider: ModelProvider,
    db: Session,
    content_text: str | None = None,
    content_url: str | None = None,
    source_ref: dict[str, Any] | None = None,
    file_keys: list[str] | None = None,
    file_metas: list[dict[str, Any]] | None = None,
) -> tuple[CaptureRow, ExtractionRow]:
    """Run the full capture pipeline: ingest → classify → normalize → extract.

    Returns the persisted CaptureRow and ExtractionRow.
    The caller is responsible for committing the transaction.
    """
    pipeline_start = time.time()
    logger.info("Pipeline starting for user=%s workspace=%s source=%s", user_id, workspace_id, source)

    # Stage 1: Ingest
    t0 = time.time()
    ingest_result = ingest(
        user_id=user_id,
        workspace_id=workspace_id,
        source=source,
        content_text=content_text,
        content_url=content_url,
        source_ref=source_ref,
        file_keys=file_keys,
        file_metas=file_metas,
    )
    logger.info("Ingest complete (%.0fms)", (time.time() - t0) * 1000)

    # Stage 2: Classify
    t0 = time.time()
    classify_result = classify(ingest_result)
    logger.info("Classify complete: content_type=%s (%.0fms)", classify_result.content_type, (time.time() - t0) * 1000)

    # Stage 3: Normalize (persists CaptureRow)
    t0 = time.time()
    capture = normalize(ingest_result, classify_result, db)
    logger.info("Normalize complete: capture_id=%s (%.0fms)", capture.id, (time.time() - t0) * 1000)

    # Stage 4: Extract (persists ExtractionRow, updates capture status)
    t0 = time.time()
    extraction = extract(capture, provider, db)
    logger.info("Extract complete: extraction_id=%s (%.0fms)", extraction.id, (time.time() - t0) * 1000)

    total_ms = (time.time() - pipeline_start) * 1000
    logger.info("Pipeline complete: total=%.0fms", total_ms)

    return capture, extraction
