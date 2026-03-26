"""Base connector interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID


class BaseConnector(ABC):
    """Translates surface-specific input into pipeline arguments."""

    @abstractmethod
    def parse_request(self, raw_input: Any, user_id: UUID, workspace_id: UUID) -> dict[str, Any]:
        """Parse surface-specific input into kwargs for run_pipeline().

        Returns a dict with keys: source, content_text, content_url,
        source_ref, file_keys, file_metas.
        """
        ...
