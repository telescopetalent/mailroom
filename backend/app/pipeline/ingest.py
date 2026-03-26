"""Pipeline stage 1: Ingest raw input into a common format."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import UUID


@dataclass
class IngestResult:
    """Output of the ingest stage — raw content in a common envelope."""

    user_id: UUID
    workspace_id: UUID
    source: str  # CaptureSource value
    raw_text: Optional[str] = None
    raw_url: Optional[str] = None
    source_ref: dict[str, Any] = field(default_factory=dict)
    file_keys: list[str] = field(default_factory=list)  # S3 keys for uploaded files
    file_metas: list[dict[str, Any]] = field(default_factory=list)  # filename, content_type, size


def ingest(
    user_id: UUID,
    workspace_id: UUID,
    source: str,
    content_text: str | None = None,
    content_url: str | None = None,
    source_ref: dict[str, Any] | None = None,
    file_keys: list[str] | None = None,
    file_metas: list[dict[str, Any]] | None = None,
) -> IngestResult:
    """Parse raw input into an IngestResult.

    This stage does minimal processing — just packages the raw input
    into a consistent envelope for downstream stages.
    """
    return IngestResult(
        user_id=user_id,
        workspace_id=workspace_id,
        source=source,
        raw_text=content_text,
        raw_url=content_url,
        source_ref=source_ref or {},
        file_keys=file_keys or [],
        file_metas=file_metas or [],
    )
