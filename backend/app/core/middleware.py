"""Request logging and error handling middleware."""

from __future__ import annotations

import contextvars
import logging
import time
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("mailroom")

# Context variable for correlation ID — accessible from any code in the request
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class CorrelationIdFilter(logging.Filter):
    """Inject the current request_id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get("-")
        return True


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with method, path, status, and duration."""

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = str(uuid4())[:8]
        request_id_var.set(rid)
        start = time.time()

        logger.info(
            "[%s] %s %s",
            rid,
            request.method,
            request.url.path,
        )

        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        logger.info(
            "[%s] %s %s → %d (%.0fms)",
            rid,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

        response.headers["X-Request-ID"] = rid
        return response
