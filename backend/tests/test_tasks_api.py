"""Tests for task API endpoints."""

from __future__ import annotations


def _create_approved_task(client, auth_headers) -> str:
    """Helper: create a capture, approve a task, return task ID."""
    cap_resp = client.post(
        "/api/v1/captures",
        json={
            "source": "web",
            "content_text": "Task test",
            "mode": "manual",
            "manual_extraction": {
                "summary": "Test",
                "tasks": [{"title": "Build feature", "owner": "Alice", "priority": "high"}],
            },
        },
        headers=auth_headers,
    )
    capture_id = cap_resp.json()["id"]

    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [{"item_type": "task", "item_index": 0, "action": "approve"}],
        },
        headers=auth_headers,
    )

    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    return tasks_resp.json()["items"][0]["id"]


def test_list_tasks(client, auth_headers):
    _create_approved_task(client, auth_headers)

    resp = client.get("/api/v1/tasks", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1
    assert data["items"][0]["title"] == "Build feature"


def test_list_tasks_filter_status(client, auth_headers):
    task_id = _create_approved_task(client, auth_headers)

    # Complete the task
    client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )

    # Filter open only
    resp = client.get("/api/v1/tasks?status=open", headers=auth_headers)
    open_tasks = resp.json()["items"]
    assert all(t["status"] == "open" for t in open_tasks)

    # Filter completed
    resp = client.get("/api/v1/tasks?status=completed", headers=auth_headers)
    completed = resp.json()["items"]
    assert any(t["id"] == task_id for t in completed)


def test_get_task(client, auth_headers):
    task_id = _create_approved_task(client, auth_headers)

    resp = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Build feature"


def test_get_task_not_found(client, auth_headers):
    import uuid
    resp = client.get(f"/api/v1/tasks/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


def test_update_task_status(client, auth_headers):
    task_id = _create_approved_task(client, auth_headers)

    resp = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


def test_update_task_fields(client, auth_headers):
    task_id = _create_approved_task(client, auth_headers)

    resp = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"owner": "Bob", "priority": "low"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["owner"] == "Bob"
    assert resp.json()["priority"] == "low"


def test_task_survives_capture_delete(client, auth_headers):
    """Approved tasks should survive when their capture is permanently deleted."""
    cap_resp = client.post(
        "/api/v1/captures",
        json={
            "source": "web",
            "content_text": "Orphan test",
            "mode": "manual",
            "manual_extraction": {
                "tasks": [{"title": "Orphan task"}],
            },
        },
        headers=auth_headers,
    )
    capture_id = cap_resp.json()["id"]

    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [{"item_type": "task", "item_index": 0, "action": "approve"}],
        },
        headers=auth_headers,
    )

    # Trash and delete the capture
    client.post(f"/api/v1/captures/{capture_id}/trash", headers=auth_headers)
    client.delete(f"/api/v1/captures/{capture_id}", headers=auth_headers)

    # Task should still exist (orphaned)
    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    orphan = [t for t in tasks_resp.json()["items"] if t["title"] == "Orphan task"]
    assert len(orphan) == 1
    assert orphan[0]["capture_id"] is None


def test_workspace_isolation_list(client, auth_headers, other_headers):
    """User A's tasks are invisible to user B."""
    _create_approved_task(client, auth_headers)

    # User B should see no tasks
    resp = client.get("/api/v1/tasks", headers=other_headers)
    assert resp.status_code == 200
    assert resp.json()["items"] == []


def test_workspace_isolation_get(client, auth_headers, other_headers):
    """User B cannot fetch user A's task by ID."""
    import uuid
    task_id = _create_approved_task(client, auth_headers)

    resp = client.get(f"/api/v1/tasks/{task_id}", headers=other_headers)
    assert resp.status_code == 404


def test_workspace_isolation_patch(client, auth_headers, other_headers):
    """User B cannot modify user A's task."""
    task_id = _create_approved_task(client, auth_headers)

    resp = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "completed"},
        headers=other_headers,
    )
    assert resp.status_code == 404

    # Original task is unchanged
    original = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
    assert original["status"] == "open"


def test_workspace_isolation_delete(client, auth_headers, other_headers):
    """User B cannot delete user A's task."""
    task_id = _create_approved_task(client, auth_headers)

    resp = client.delete(f"/api/v1/tasks/{task_id}", headers=other_headers)
    assert resp.status_code == 404

    # Task still exists for user A
    original = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
    assert original["id"] == task_id
