"""Shared enums used across all Mailroom models."""

import sys

if sys.version_info >= (3, 11):
    from enum import StrEnum
else:
    from enum import Enum

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11."""
        pass


class CaptureSource(StrEnum):
    """Surface of origin for a capture."""

    WEB = "web"
    EMAIL = "email"
    SLACK = "slack"
    IOS_APP = "ios_app"
    IOS_SHARE = "ios_share"
    APPLE_NOTES = "apple_notes"
    CHROME_EXTENSION = "chrome_extension"
    DESKTOP = "desktop"
    SMS = "sms"
    TELEGRAM = "telegram"
    DISCORD = "discord"
    WHATSAPP = "whatsapp"


class ContentType(StrEnum):
    """Type of captured content."""

    TEXT = "text"
    IMAGE = "image"
    PDF = "pdf"
    SCREENSHOT = "screenshot"
    URL = "url"
    MIXED = "mixed"


class CaptureStatus(StrEnum):
    """Lifecycle status of a capture."""

    PENDING = "pending"
    PROCESSING = "processing"
    REVIEW = "review"
    APPROVED = "approved"
    REJECTED = "rejected"


class Priority(StrEnum):
    """Priority level for extracted items."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class TaskStatus(StrEnum):
    """Status of an approved task."""

    OPEN = "open"
    COMPLETED = "completed"


class ReviewAction(StrEnum):
    """Action taken on a review item."""

    APPROVE = "approve"
    EDIT = "edit"
    REJECT = "reject"
