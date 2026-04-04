"""Tests for webhook API endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from app.db.models import SurfaceConnectionRow


def _add_connection(db, workspace_id, user_id, surface, external_id):
    """Helper: add a surface connection."""
    conn = SurfaceConnectionRow(
        workspace_id=workspace_id,
        user_id=user_id,
        surface=surface,
        external_id=external_id,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(conn)
    db.commit()
    return conn


def test_email_webhook_registered(client, db, test_user):
    _add_connection(
        db, test_user["workspace_id"], test_user["user_id"], "email", "test@mailroom.dev"
    )

    resp = client.post(
        "/api/v1/webhooks/email",
        json={
            "from": "test@mailroom.dev",
            "subject": "Test email",
            "body_text": "Deploy by EOD",
            "message_id": "<test@msg.com>",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "captured"


def test_email_webhook_unregistered(client, db, test_user):
    resp = client.post(
        "/api/v1/webhooks/email",
        json={
            "from": "unknown@random.com",
            "subject": "Spam",
            "body_text": "Buy now",
            "message_id": "<spam@msg.com>",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


def test_email_webhook_no_sender(client, db, test_user):
    resp = client.post(
        "/api/v1/webhooks/email",
        json={"subject": "No from", "body_text": "Missing sender"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


def test_slack_url_verification(client, db, test_user):
    resp = client.post(
        "/api/v1/webhooks/slack",
        json={"type": "url_verification", "challenge": "test_challenge_123"},
    )
    assert resp.status_code == 200
    assert resp.json()["challenge"] == "test_challenge_123"


def test_slack_slash_command(client, db, test_user):
    _add_connection(
        db, test_user["workspace_id"], test_user["user_id"], "slack", "T_TEST"
    )

    resp = client.post(
        "/api/v1/webhooks/slack",
        data={
            "team_id": "T_TEST",
            "channel_id": "C01",
            "channel_name": "general",
            "user_id": "U01",
            "text": "Ship the feature",
            "command": "/mailroom",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["response_type"] == "ephemeral"
    assert "Captured" in data["text"]


def test_slack_slash_empty_text(client, db, test_user):
    resp = client.post(
        "/api/v1/webhooks/slack",
        data={
            "team_id": "T_TEST",
            "text": "",
            "command": "/mailroom",
        },
    )
    assert resp.status_code == 200
    assert "Usage" in resp.json()["text"]


def test_slack_unregistered_team(client, db, test_user):
    resp = client.post(
        "/api/v1/webhooks/slack",
        data={
            "team_id": "T_UNKNOWN",
            "text": "Some content",
            "command": "/mailroom",
        },
    )
    assert resp.status_code == 200
    assert "not connected" in resp.json()["text"]
