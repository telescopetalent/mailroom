"""Web app connector — handles paste/upload from the web interface."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.connectors.base import BaseConnector
from app.models.api_schemas import CreateCaptureRequest


class WebConnector(BaseConnector):
    """Translates web app CreateCaptureRequest into pipeline arguments."""

    def parse_request(self, raw_input: Any, user_id: UUID, workspace_id: UUID) -> dict[str, Any]:
        req: CreateCaptureRequest = raw_input

        return {
            "source": req.source.value if hasattr(req.source, "value") else str(req.source),
            "content_text": req.content_text,
            "content_url": req.content_url,
            "source_ref": req.source_ref,
            "file_keys": None,
            "file_metas": None,
        }
