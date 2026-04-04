"""Shared pytest fixtures for Mailroom backend tests."""

from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime

import pytest
from sqlalchemy import JSON, String, TypeDecorator, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Session, sessionmaker

from app.core.auth import hash_api_key
from app.core.database import Base, get_db
from app.db.models import (
    ApiKeyRow,
    UserRow,
    WorkspaceMemberRow,
    WorkspaceRow,
)

# Force stub provider in tests
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ.pop("GEMINI_API_KEY", None)
from app.core.config import settings
settings.anthropic_api_key = ""
settings.gemini_api_key = ""

from app.main import app

# Register UUID adapter for SQLite
sqlite3.register_adapter(uuid.UUID, lambda u: str(u))


# ---------------------------------------------------------------------------
# UUID type that works in both PostgreSQL and SQLite
# ---------------------------------------------------------------------------

class UniversalUUID(TypeDecorator):
    """UUID type that stores as String in SQLite but works with UUID comparisons."""

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        return value  # Keep as string


# ---------------------------------------------------------------------------
# Patch PG-specific types to work with SQLite
# ---------------------------------------------------------------------------

_patched = False


def _patch_for_sqlite():
    global _patched
    if _patched:
        return
    _patched = True

    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, PGUUID):
                col.type = UniversalUUID()
            elif isinstance(col.type, JSONB):
                col.type = JSON()


_TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test.db")
_TEST_DB_URL = f"sqlite:///{_TEST_DB_PATH}"


@pytest.fixture()
def db_engine():
    """Create a fresh SQLite engine per test."""
    if os.path.exists(_TEST_DB_PATH):
        os.unlink(_TEST_DB_PATH)

    _patch_for_sqlite()

    engine = create_engine(_TEST_DB_URL, echo=False)
    Base.metadata.create_all(bind=engine)

    yield engine

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists(_TEST_DB_PATH):
        os.unlink(_TEST_DB_PATH)


@pytest.fixture()
def db(db_engine) -> Session:
    """Yield a database session."""
    TestSession = sessionmaker(bind=db_engine, expire_on_commit=False)
    session = TestSession()
    yield session
    session.close()


@pytest.fixture()
def test_user(db) -> dict:
    """Create a test user + workspace + API key."""
    wid = str(uuid.uuid4())
    uid = str(uuid.uuid4())
    api_key = "mr_test_key_123"

    db.add(WorkspaceRow(id=wid, name="Test Workspace", trash_retention_days=30, created_at=datetime.utcnow()))
    db.add(UserRow(id=uid, email="test@mailroom.dev", name="Test User", created_at=datetime.utcnow()))
    db.add(WorkspaceMemberRow(workspace_id=wid, user_id=uid, role="admin"))
    db.add(ApiKeyRow(workspace_id=wid, user_id=uid, key_hash=hash_api_key(api_key), name="test-key", created_at=datetime.utcnow()))
    db.commit()

    return {"user_id": uid, "workspace_id": wid, "email": "test@mailroom.dev", "api_key": api_key}


@pytest.fixture()
def client(db, db_engine):
    """FastAPI TestClient with the DB session overridden."""
    from fastapi.testclient import TestClient

    TestSession = sessionmaker(bind=db_engine, expire_on_commit=False)

    def _override_get_db():
        s = TestSession()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(test_user) -> dict:
    """Authorization headers using the test API key."""
    return {"Authorization": f"Bearer {test_user['api_key']}"}
