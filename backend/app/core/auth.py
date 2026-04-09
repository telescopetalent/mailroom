"""API key authentication."""

from __future__ import annotations

import hashlib
import secrets

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import RateLimitError
from app.core.rate_limit import rate_limiter
from app.db.models import ApiKeyRow, UserRow

security = HTTPBearer()


def hash_api_key(key: str) -> str:
    """Hash an API key for storage."""
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> str:
    """Generate a random API key."""
    return f"mr_{secrets.token_urlsafe(32)}"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> dict:
    """FastAPI dependency: validate API key and return user context.

    Returns a dict with user_id, workspace_id, and email.
    """
    key_hash = hash_api_key(credentials.credentials)

    row = db.query(ApiKeyRow).filter(ApiKeyRow.key_hash == key_hash).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    user = db.query(UserRow).filter(UserRow.id == row.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Rate limit check
    if not rate_limiter.is_allowed(str(row.user_id)):
        raise RateLimitError()

    return {
        "user_id": row.user_id,
        "workspace_id": row.workspace_id,
        "email": user.email,
    }
