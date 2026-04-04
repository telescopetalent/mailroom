"""Simple in-memory sliding-window rate limiter."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from app.core.config import settings


class RateLimiter:
    """Per-key sliding-window rate limiter.

    Tracks request timestamps per key and rejects requests that exceed
    the configured rate. In-memory only — suitable for single-process
    deployments. Use Redis for horizontal scaling.
    """

    def __init__(self, max_requests: int | None = None, window_seconds: int = 60):
        self.max_requests = max_requests or settings.rate_limit_per_minute
        self.window_seconds = window_seconds
        self._requests: dict[str, deque] = defaultdict(deque)

    def is_allowed(self, key: str) -> bool:
        """Check if a request is allowed for the given key."""
        now = time.monotonic()
        window = self._requests[key]

        # Remove expired entries
        cutoff = now - self.window_seconds
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= self.max_requests:
            return False

        window.append(now)
        return True


# Global instance
rate_limiter = RateLimiter()
