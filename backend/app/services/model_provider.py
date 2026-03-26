"""LLM model provider abstraction for structured extraction."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings

logger = logging.getLogger("mailroom.model_provider")

EXTRACTION_PROMPT = """You are an action extraction engine. Analyze the following captured content and extract structured information.

Return a JSON object with these fields:
- "summary": A brief 1-2 sentence summary of the content
- "next_steps": Array of strings — identified next actions
- "tasks": Array of objects with (title, description, owner, due_date, priority)
  - owner: only include if explicitly mentioned (name or role)
  - due_date: only include if explicitly mentioned (ISO format YYYY-MM-DD)
  - priority: "high", "medium", "low", or "none"
- "owners": Array of strings — all people/roles mentioned as responsible
- "due_dates": Array of objects with (description, date, source_text)
  - date: ISO format YYYY-MM-DD if parseable, null otherwise
  - source_text: the original text that mentioned the deadline
- "blockers": Array of strings — identified blockers or dependencies
- "follow_ups": Array of objects with (description, owner, due_date)
- "priority": Overall priority of the content: "high", "medium", "low", or "none"
- "source_references": Array of objects with (source, url, description)

Rules:
- Only extract what is explicitly stated in the content
- Do NOT invent owners, dates, or tasks that aren't mentioned
- If a field has no relevant data, use an empty array or null
- Return valid JSON only, no markdown formatting

Content to analyze:
---
{content}
---

Return the JSON object:"""


class ModelProvider(ABC):
    """Abstract interface for LLM-based extraction."""

    @abstractmethod
    def extract(self, text: str) -> dict[str, Any]:
        """Run structured extraction on text. Returns parsed JSON dict."""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @property
    @abstractmethod
    def model_id(self) -> str:
        ...


class AnthropicProvider(ModelProvider):
    """Anthropic Claude provider for structured extraction."""

    def __init__(self):
        import anthropic

        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._model_id = "claude-sonnet-4-20250514"

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def model_id(self) -> str:
        return self._model_id

    def extract(self, text: str) -> dict[str, Any]:
        prompt = EXTRACTION_PROMPT.format(content=text)

        response = self._client.messages.create(
            model=self._model_id,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )

        raw_text = response.content[0].text
        logger.debug("Anthropic response: %s", raw_text)

        # Parse JSON from response (handle potential markdown wrapping)
        text_clean = raw_text.strip()
        if text_clean.startswith("```"):
            # Strip markdown code block
            lines = text_clean.split("\n")
            text_clean = "\n".join(lines[1:-1])

        return json.loads(text_clean)


class StubProvider(ModelProvider):
    """Stub provider for development without API keys."""

    @property
    def provider_name(self) -> str:
        return "stub"

    @property
    def model_id(self) -> str:
        return "stub-v1"

    def extract(self, text: str) -> dict[str, Any]:
        return {
            "summary": f"Captured content ({len(text)} chars)",
            "next_steps": [],
            "tasks": [],
            "owners": [],
            "due_dates": [],
            "blockers": [],
            "follow_ups": [],
            "priority": "none",
            "source_references": [],
        }


def get_model_provider() -> ModelProvider:
    """Get the configured model provider."""
    if settings.anthropic_api_key:
        return AnthropicProvider()
    logger.warning("No API key configured — using stub model provider")
    return StubProvider()
