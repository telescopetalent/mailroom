"""Pipeline stage 2: Classify content type."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.pipeline.ingest import IngestResult


@dataclass
class ClassifyResult:
    """Output of the classify stage."""

    content_type: str  # ContentType value
    source_metadata: dict[str, Any] = field(default_factory=dict)


def classify(ingest_result: IngestResult) -> ClassifyResult:
    """Determine the content type from the ingested input.

    Rules:
    - If files are present and text is also present → mixed
    - If only files → infer from file content types
    - If URL only → url
    - If text only → text
    """
    has_text = bool(ingest_result.raw_text)
    has_url = bool(ingest_result.raw_url)
    has_files = bool(ingest_result.file_keys)

    if has_files and (has_text or has_url):
        content_type = "mixed"
    elif has_files:
        # Infer from file types
        file_types = [m.get("content_type", "") for m in ingest_result.file_metas]
        if all("image" in t for t in file_types):
            content_type = "image"
        elif all("pdf" in t for t in file_types):
            content_type = "pdf"
        else:
            content_type = "mixed"
    elif has_url and not has_text:
        content_type = "url"
    else:
        content_type = "text"

    return ClassifyResult(
        content_type=content_type,
        source_metadata={"has_text": has_text, "has_url": has_url, "has_files": has_files},
    )
