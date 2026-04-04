"""Pipeline stage 4: AI-powered structured extraction."""

from __future__ import annotations

import base64
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import CaptureRow, ExtractionRow
from app.services.model_provider import ModelProvider
from app.services.storage import get_storage

logger = logging.getLogger("mailroom.pipeline.extract")


def _load_image_data(image_keys: list[str]) -> list[dict[str, str]]:
    """Download images from storage and return base64-encoded data for vision."""
    storage = get_storage()
    image_data = []

    for key in image_keys:
        try:
            data = storage.download(key)
            b64 = base64.b64encode(data).decode("utf-8")

            # Determine media type from key extension
            lower_key = key.lower()
            if lower_key.endswith(".png"):
                media_type = "image/png"
            elif lower_key.endswith((".jpg", ".jpeg")):
                media_type = "image/jpeg"
            elif lower_key.endswith(".webp"):
                media_type = "image/webp"
            elif lower_key.endswith(".gif"):
                media_type = "image/gif"
            else:
                media_type = "image/png"  # default

            image_data.append({"data": b64, "media_type": media_type})
            logger.info("Loaded image for vision: %s (%d bytes)", key, len(data))
        except Exception:
            logger.exception("Failed to load image %s for vision", key)

    return image_data


def extract(
    capture: CaptureRow,
    provider: ModelProvider,
    db: Session,
) -> ExtractionRow:
    """Run AI extraction on a normalized capture.

    Takes the normalized_text and any image attachments from the capture,
    sends them to the model provider (with vision for images),
    and saves the structured extraction result to the database.
    """
    text = capture.normalized_text or ""
    raw_content = capture.raw_content or {}
    image_keys = raw_content.get("image_keys", [])

    has_text = bool(text.strip())
    has_images = bool(image_keys)

    if not has_text and not has_images:
        logger.warning("Capture %s has no text or images — producing empty extraction", capture.id)
        result = {
            "summary": None,
            "next_steps": [],
            "tasks": [],
            "owners": [],
            "due_dates": [],
            "blockers": [],
            "workflows": [],
            "follow_ups": [],
            "priority": "none",
            "source_references": [],
        }
    elif has_images:
        # Vision extraction — load images and pass to provider
        image_data = _load_image_data(image_keys)
        if image_data:
            result = provider.extract(text, image_data=image_data)
        elif has_text:
            result = provider.extract(text)
        else:
            result = {"summary": "Image could not be loaded", "next_steps": [], "tasks": [], "owners": [], "due_dates": [], "blockers": [], "follow_ups": [], "priority": "none", "source_references": []}
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
        workflows=result.get("workflows", []),
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
