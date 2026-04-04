"""Tests for review workflow API endpoints."""

from __future__ import annotations


def _create_capture_with_tasks(client, auth_headers) -> str:
    """Helper: create a manual capture with reviewable tasks."""
    resp = client.post(
        "/api/v1/captures",
        json={
            "source": "web",
            "content_text": "Review test",
            "mode": "manual",
            "manual_extraction": {
                "summary": "Sprint planning",
                "tasks": [
                    {"title": "Fix login bug", "owner": "Sarah", "priority": "high"},
                    {"title": "Update docs", "owner": "John"},
                ],
                "next_steps": ["Deploy to staging"],
                "follow_ups": [{"description": "Check metrics", "owner": "Mike"}],
            },
        },
        headers=auth_headers,
    )
    return resp.json()["id"]


def test_approve_all(client, auth_headers):
    capture_id = _create_capture_with_tasks(client, auth_headers)

    resp = client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "task", "item_index": 0, "action": "approve"},
                {"item_type": "task", "item_index": 1, "action": "approve"},
                {"item_type": "next_step", "item_index": 0, "action": "approve"},
                {"item_type": "follow_up", "item_index": 0, "action": "approve"},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["approved_task_count"] == 4
    assert data["rejected_item_count"] == 0


def test_reject_all(client, auth_headers):
    capture_id = _create_capture_with_tasks(client, auth_headers)

    resp = client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "task", "item_index": 0, "action": "reject"},
                {"item_type": "task", "item_index": 1, "action": "reject"},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["approved_task_count"] == 0
    assert data["rejected_item_count"] == 2


def test_mixed_review(client, auth_headers):
    capture_id = _create_capture_with_tasks(client, auth_headers)

    resp = client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "task", "item_index": 0, "action": "approve"},
                {"item_type": "task", "item_index": 1, "action": "reject"},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"  # at least one approved
    assert data["approved_task_count"] == 1
    assert data["rejected_item_count"] == 1


def test_review_creates_tasks(client, auth_headers):
    capture_id = _create_capture_with_tasks(client, auth_headers)

    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "task", "item_index": 0, "action": "approve"},
            ],
        },
        headers=auth_headers,
    )

    # Check that a task was created
    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    tasks = tasks_resp.json()["items"]
    assert any(t["title"] == "Fix login bug" for t in tasks)


def test_review_not_found(client, auth_headers):
    import uuid
    resp = client.patch(
        f"/api/v1/captures/{uuid.uuid4()}/review",
        json={"decisions": []},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_reopen_approved(client, auth_headers):
    capture_id = _create_capture_with_tasks(client, auth_headers)

    # Approve
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [{"item_type": "task", "item_index": 0, "action": "approve"}],
        },
        headers=auth_headers,
    )

    # Reopen
    resp = client.post(f"/api/v1/captures/{capture_id}/reopen", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "review"


def test_reopen_non_approved_fails(client, auth_headers):
    capture_id = _create_capture_with_tasks(client, auth_headers)

    # Still in "review" — reopen should fail
    resp = client.post(f"/api/v1/captures/{capture_id}/reopen", headers=auth_headers)
    assert resp.status_code == 400
