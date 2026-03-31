"""Email connector — parses inbound email into pipeline kwargs."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from app.connectors.base import BaseConnector


class EmailConnector(BaseConnector):
    """Translates an inbound email payload into pipeline arguments."""

    def parse_request(self, raw_input: Any, user_id: UUID, workspace_id: UUID) -> dict[str, Any]:
        """Parse email payload into pipeline kwargs.

        raw_input is a dict with keys:
            from_addr: str (sender email)
            subject: str
            body_text: str (plain text body)
            body_html: str (optional HTML body)
            message_id: str
            received_at: str (optional ISO timestamp)
        """
        subject = raw_input.get("subject", "")
        body_text = raw_input.get("body_text", "")
        body_html = raw_input.get("body_html", "")

        # Build content: subject + body
        parts = []
        if subject:
            parts.append(f"Subject: {subject}")
        if body_text:
            parts.append(body_text)
        elif body_html:
            # Basic HTML stripping — just remove tags
            import re
            parts.append(re.sub(r"<[^>]+>", "", body_html))

        content_text = "\n\n".join(parts) if parts else "Empty email"

        source_ref = {
            "source": "email",
            "message_id": raw_input.get("message_id", ""),
            "from_addr": raw_input.get("from_addr", raw_input.get("from", "")),
            "subject": subject,
            "received_at": raw_input.get("received_at", datetime.utcnow().isoformat()),
        }

        return {
            "source": "email",
            "content_text": content_text,
            "content_url": None,
            "source_ref": source_ref,
            "file_keys": None,
            "file_metas": None,
        }
