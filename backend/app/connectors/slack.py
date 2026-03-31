"""Slack connector — parses Slack slash command or event into pipeline kwargs."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.connectors.base import BaseConnector


class SlackConnector(BaseConnector):
    """Translates a Slack payload into pipeline arguments."""

    def parse_request(self, raw_input: Any, user_id: UUID, workspace_id: UUID) -> dict[str, Any]:
        """Parse Slack payload into pipeline kwargs.

        raw_input is a dict with keys (from slash command or event):
            text: str (message content)
            channel_id: str
            channel_name: str
            team_id: str
            user_id: str (Slack user ID)
            command: str (optional, e.g. "/mailroom")
            message_ts: str (optional, for events)
            thread_ts: str (optional)
            permalink: str (optional)
        """
        text = raw_input.get("text", "")
        channel_name = raw_input.get("channel_name", "")

        # Add channel context to content
        if channel_name:
            content_text = f"[Slack #{channel_name}] {text}"
        else:
            content_text = text

        source_ref = {
            "source": "slack",
            "channel_id": raw_input.get("channel_id", ""),
            "channel_name": channel_name,
            "message_ts": raw_input.get("message_ts", raw_input.get("trigger_id", "")),
            "thread_ts": raw_input.get("thread_ts"),
            "permalink": raw_input.get("permalink"),
        }

        return {
            "source": "slack",
            "content_text": content_text,
            "content_url": None,
            "source_ref": source_ref,
            "file_keys": None,
            "file_metas": None,
        }
