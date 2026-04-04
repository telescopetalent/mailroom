"""Custom exception hierarchy for structured error responses."""

from __future__ import annotations


class MailroomError(Exception):
    """Base exception for all Mailroom errors."""

    status_code: int = 500
    error_code: str = "internal_error"

    def __init__(self, message: str = "An internal error occurred"):
        self.message = message
        super().__init__(message)


class NotFoundError(MailroomError):
    """Resource not found."""

    status_code = 404
    error_code = "not_found"

    def __init__(self, resource: str = "Resource", identifier: str = ""):
        msg = f"{resource} not found"
        if identifier:
            msg = f"{resource} '{identifier}' not found"
        super().__init__(msg)


class ValidationError(MailroomError):
    """Invalid input data."""

    status_code = 400
    error_code = "validation_error"


class ExtractionError(MailroomError):
    """AI extraction failed after retries."""

    status_code = 502
    error_code = "extraction_failed"

    def __init__(self, message: str = "AI extraction failed"):
        super().__init__(message)


class ExternalServiceError(MailroomError):
    """External service (API, storage) unavailable or errored."""

    status_code = 502
    error_code = "external_service_error"


class RateLimitError(MailroomError):
    """Rate limit exceeded."""

    status_code = 429
    error_code = "rate_limit_exceeded"

    def __init__(self, message: str = "Rate limit exceeded. Please slow down."):
        super().__init__(message)
