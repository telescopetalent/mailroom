"""Pipeline stage 4: AI-powered structured extraction."""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import CaptureRow, ExtractionRow
from app.services.model_provider import ModelProvider

logger = logging.getLogger("mailroom.pipeline.extract")


def extract(
    capture: CaptureRow,
    provider: ModelProvider,
    db: Session,
) -> ExtractionRow:
    """Run AI extraction on a normalized capture.

    Takes the normalized_text from the capture, sends it to the model provider,
    and saves the structured extraction result to the database.
    """
    text = capture.normalized_text or ""
    if not text.strip():
        logger.warning("Capture %s has no normalized text — producing empty extraction", capture.id)
        result = {
            "summary": None,
            "next_steps": [],
            "tasks": [],
            "owners": [],
            "due_dates": [],
            "blockers": [],
            "follow_ups": [],
            "priority": "none",
            "source_references": [],
        }
    else:
        result = provider.extract(text)

    now = datetime.utcnow()

    extraction = ExtractionRow(
        capture_id=capture.id,
        summary=result.get("summary"),
        next_steps=result.get("next_steps", []),
        tasks=result.get("tasks", []),
        owners=result.get("owners", []),
        due_dates=result.get("due_dates", []),
        blockers=result.get("blockers", []),
        follow_ups=result.get("follow_ups", []),
        priority=result.get("priority", "none"),
        source_references=result.get("source_references", []),
        model_provider=provider.provider_name,
        model_id=provider.model_id,
        created_at=now,
    )
    db.add(extraction)

    # Update capture status to review
    capture.status = "review"

    return extraction
