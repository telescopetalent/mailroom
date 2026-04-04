"""Tests for capture API endpoints."""

from __future__ import annotations


def test_create_capture(client, auth_headers):
    resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "Test capture", "mode": "ai"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "review"
    assert data["content_type"] == "text"
    assert data["extraction"] is not None
    assert data["extraction"]["model_provider"] == "stub"


def test_create_manual_capture(client, auth_headers):
    resp = client.post(
        "/api/v1/captures",
        json={
            "source": "web",
            "content_text": "Manual test",
            "mode": "manual",
            "manual_extraction": {
                "summary": "Weekly sync",
                "tasks": [{"title": "Deploy", "owner": "John"}],
                "next_steps": ["Review PR"],
                "blockers": ["Waiting on QA"],
            },
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["extraction"]["summary"] == "Weekly sync"
    assert data["extraction"]["model_provider"] == "manual"
    assert len(data["extraction"]["tasks"]) == 1


def test_list_captures(client, auth_headers):
    # Create a capture first
    client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "For listing", "mode": "ai"},
        headers=auth_headers,
    )

    resp = client.get("/api/v1/captures", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1
    assert "pagination" in data


def test_get_capture(client, auth_headers):
    create_resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "Get test", "mode": "ai"},
        headers=auth_headers,
    )
    capture_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/captures/{capture_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == capture_id


def test_get_capture_not_found(client, auth_headers):
    import uuid
    resp = client.get(f"/api/v1/captures/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


def test_trash_capture(client, auth_headers):
    create_resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "Trash test", "mode": "ai"},
        headers=auth_headers,
    )
    capture_id = create_resp.json()["id"]

    resp = client.post(f"/api/v1/captures/{capture_id}/trash", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "trashed"


def test_trash_already_trashed(client, auth_headers):
    create_resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "Double trash", "mode": "ai"},
        headers=auth_headers,
    )
    capture_id = create_resp.json()["id"]

    client.post(f"/api/v1/captures/{capture_id}/trash", headers=auth_headers)
    resp = client.post(f"/api/v1/captures/{capture_id}/trash", headers=auth_headers)
    assert resp.status_code == 400


def test_restore_capture(client, auth_headers):
    create_resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "Restore test", "mode": "ai"},
        headers=auth_headers,
    )
    capture_id = create_resp.json()["id"]

    client.post(f"/api/v1/captures/{capture_id}/trash", headers=auth_headers)
    resp = client.post(f"/api/v1/captures/{capture_id}/restore", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "review"


def test_list_trashed(client, auth_headers):
    create_resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "Trash list test", "mode": "ai"},
        headers=auth_headers,
    )
    capture_id = create_resp.json()["id"]
    client.post(f"/api/v1/captures/{capture_id}/trash", headers=auth_headers)

    resp = client.get("/api/v1/captures/trash", headers=auth_headers)
    assert resp.status_code == 200
    assert any(c["id"] == capture_id for c in resp.json()["items"])


def test_permanent_delete(client, auth_headers):
    create_resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": "Perm delete", "mode": "ai"},
        headers=auth_headers,
    )
    capture_id = create_resp.json()["id"]
    client.post(f"/api/v1/captures/{capture_id}/trash", headers=auth_headers)

    resp = client.delete(f"/api/v1/captures/{capture_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Verify it's gone
    resp = client.get(f"/api/v1/captures/{capture_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_unauthorized_request(client):
    resp = client.get("/api/v1/captures")
    assert resp.status_code in (401, 403)


def test_invalid_api_key(client):
    resp = client.get(
        "/api/v1/captures",
        headers={"Authorization": "Bearer mr_bad_key"},
    )
    assert resp.status_code == 401
