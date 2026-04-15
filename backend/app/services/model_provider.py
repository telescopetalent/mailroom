"""LLM model provider abstraction for structured extraction."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings
from app.core.exceptions import ExtractionError

logger = logging.getLogger("mailroom.model_provider")

EXTRACTION_PROMPT = """You are an action extraction engine. Analyze the following captured content and extract structured information.

Return a JSON object with these fields:
- "summary": A brief 1-2 sentence summary of the content
- "tasks": Array of INDEPENDENT, standalone tasks — objects with (title, description, owner, due_date, priority). Only put tasks here that are NOT part of a sequence.
- "workflows": Array of workflows — use this when multiple tasks form a logical sequence toward a goal. Each workflow is an object with:
  - "name": Short name for the workflow (e.g. "Weekly meal plan", "Deploy release")
  - "description": Brief description of the goal (optional)
  - "steps": Array of ordered task objects with (title, description, owner, due_date, priority, depends_on_prior, sub_tasks)
    - depends_on_prior: boolean — set to true ONLY for steps that explicitly depend on all prior steps completing first (e.g. "update org chart once hiring is complete"). Most steps should be false.
    - sub_tasks: Array of strings — granular checklist items within a step. Break down each step into its component actions whenever possible (e.g. "Clean bathroom" → ["Scrub toilet", "Wipe counters", "Scrub shower", "Wipe mirrors"], "Write job description" → ["Define role requirements", "List responsibilities", "Set compensation range", "Post draft for review"]). Only leave empty if the step truly cannot be broken down further.
- "next_steps": Array of strings — identified next actions that aren't full tasks
- "owners": Array of strings — all people/roles mentioned as responsible
- "due_dates": Array of objects with (description, date, source_text)
  - date: ISO format YYYY-MM-DD if parseable, null otherwise
  - source_text: the original text that mentioned the deadline
- "blockers": Array of strings — identified blockers or dependencies
- "follow_ups": Array of objects with (description, owner, due_date)
- "priority": Overall priority of the content: "high", "medium", "low", or "none"
- "source_references": Array of objects with (source, url, description)

Workflow vs tasks rules:
- If tasks must be done in order or work toward a shared goal, group them into a workflow
- If a task depends on a workflow completing first (e.g. "update the org chart once hiring is complete"), include it as the LAST step of that workflow — do NOT put it in standalone "tasks". This way, the dependent task is part of the workflow and unlocks when the prior steps are done.
- If a task is truly independent with no relationship to any workflow, put it in "tasks"
- A single isolated task should NOT be a workflow
- owner/due_date: only include if explicitly mentioned
- priority: "high", "medium", "low", or "none"

General rules:
- Extract what is stated in the content
- You MAY infer obvious intermediate steps that are logically required between stated steps (e.g. if someone says "interview candidates, then update org chart" — infer "make hiring decision" between them)
- Do NOT invent owners, dates, or priorities that aren't mentioned
- If a field has no relevant data, use an empty array or null
- Return valid JSON only, no markdown formatting

Content to analyze:
---
{content}
---

Return the JSON object:"""

VISION_EXTRACTION_PROMPT = """You are an action extraction engine. Analyze the image(s) provided — they may be screenshots of emails, Slack messages, documents, social media posts, meeting notes, or any other content.

Read and understand everything visible in the image(s), then extract structured information.

Return a JSON object with these fields:
- "summary": A brief 1-2 sentence summary of what the image contains
- "tasks": Array of INDEPENDENT, standalone tasks — objects with (title, description, owner, due_date, priority). Only put tasks here that are NOT part of a sequence.
- "workflows": Array of workflows — use when multiple tasks form a logical sequence toward a goal. Each workflow: (name, description, steps: array of task objects)
- "next_steps": Array of strings — next actions that aren't full tasks
- "owners": Array of strings — all people/roles mentioned as responsible
- "due_dates": Array of objects with (description, date, source_text)
- "blockers": Array of strings — identified blockers or dependencies
- "follow_ups": Array of objects with (description, owner, due_date)
- "priority": Overall priority: "high", "medium", "low", or "none"
- "source_references": Array of objects with (source, url, description)

Workflow vs tasks: Group sequential/related steps into workflows. If a task depends on a workflow completing, include it as the last step of that workflow. Keep only truly independent tasks separate.

Rules:
- Only extract what is explicitly visible in the image(s)
- Do NOT invent owners, dates, or tasks that aren't shown
- If a field has no relevant data, use an empty array or null
- Return valid JSON only, no markdown formatting
{additional_context}
Return the JSON object:"""


class ModelProvider(ABC):
    """Abstract interface for LLM-based extraction."""

    @abstractmethod
    def extract(self, text: str, image_data: list[dict[str, str]] | None = None) -> dict[str, Any]:
        """Run structured extraction on text and/or images.

        image_data: optional list of {"data": base64_str, "media_type": "image/png"}
        """
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
    """Anthropic Claude provider for structured extraction with vision support."""

    def __init__(self):
        import anthropic
        import httpx

        self._client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key,
            timeout=httpx.Timeout(60.0, connect=10.0),
        )
        self._model_id = "claude-sonnet-4-20250514"

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def model_id(self) -> str:
        return self._model_id

    def extract(self, text: str, image_data: list[dict[str, str]] | None = None) -> dict[str, Any]:
        if image_data:
            return self._extract_with_vision(text, image_data)
        return self._extract_text_only(text)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
        reraise=True,
        before_sleep=lambda rs: logger.warning("Retrying extraction (attempt %d)...", rs.attempt_number),
    )
    def _extract_text_only(self, text: str) -> dict[str, Any]:
        prompt = EXTRACTION_PROMPT.format(content=text)

        try:
            response = self._client.messages.create(
                model=self._model_id,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:
            logger.exception("Anthropic API call failed")
            raise ExtractionError(f"AI extraction failed: {e}") from e

        return self._parse_response(response)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
        reraise=True,
        before_sleep=lambda rs: logger.warning("Retrying vision extraction (attempt %d)...", rs.attempt_number),
    )
    def _extract_with_vision(self, text: str, image_data: list[dict[str, str]]) -> dict[str, Any]:
        # Build multimodal content blocks
        content = []

        for img in image_data:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img["media_type"],
                    "data": img["data"],
                },
            })

        additional = ""
        if text:
            additional = f"\nAdditional context provided with the image(s):\n---\n{text}\n---\n"

        prompt = VISION_EXTRACTION_PROMPT.format(additional_context=additional)
        content.append({"type": "text", "text": prompt})

        try:
            response = self._client.messages.create(
                model=self._model_id,
                max_tokens=2048,
                messages=[{"role": "user", "content": content}],
            )
        except Exception as e:
            logger.exception("Anthropic vision API call failed")
            raise ExtractionError(f"AI vision extraction failed: {e}") from e

        return self._parse_response(response)

    def _parse_response(self, response: Any) -> dict[str, Any]:
        raw_text = response.content[0].text
        logger.debug("Anthropic response: %s", raw_text)

        text_clean = raw_text.strip()
        if text_clean.startswith("```"):
            lines = text_clean.split("\n")
            text_clean = "\n".join(lines[1:-1])

        # Try to find JSON in the response
        try:
            return json.loads(text_clean)
        except json.JSONDecodeError:
            # Try to extract JSON from within the text
            start = text_clean.find("{")
            end = text_clean.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text_clean[start:end])
                except json.JSONDecodeError:
                    pass
            logger.warning("Could not parse JSON from response: %s", text_clean[:200])
            return {
                "summary": text_clean[:200] if text_clean else "Could not extract structured data",
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


class StubProvider(ModelProvider):
    """Stub provider for development without API keys."""

    @property
    def provider_name(self) -> str:
        return "stub"

    @property
    def model_id(self) -> str:
        return "stub-v1"

    def extract(self, text: str, image_data: list[dict[str, str]] | None = None) -> dict[str, Any]:
        desc = f"Captured content ({len(text)} chars)"
        if image_data:
            desc += f" + {len(image_data)} image(s)"
        return {
            "summary": desc,
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
