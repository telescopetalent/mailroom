"""Tests for project API endpoints."""

from __future__ import annotations

import uuid


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_project(client, auth_headers, name="Test Project", color="#7c3aed"):
    """Create a project and return its JSON response."""
    resp = client.post(
        "/api/v1/projects",
        json={"name": name, "description": "A test project", "color": color},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_capture(client, auth_headers, text="Capture for project test"):
    """Create a capture and return its ID."""
    resp = client.post(
        "/api/v1/captures",
        json={"source": "web", "content_text": text, "mode": "ai"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_approved_task(client, auth_headers):
    """Create a capture, approve a task, return task ID."""
    cap_resp = client.post(
        "/api/v1/captures",
        json={
            "source": "web",
            "content_text": "Project task test",
            "mode": "manual",
            "manual_extraction": {
                "summary": "Test",
                "tasks": [{"title": "Project task", "owner": "Alice"}],
            },
        },
        headers=auth_headers,
    )
    capture_id = cap_resp.json()["id"]
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={"decisions": [{"item_type": "task", "item_index": 0, "action": "approve"}]},
        headers=auth_headers,
    )
    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    return tasks_resp.json()["items"][0]["id"]


def _create_approved_workflow(client, auth_headers):
    """Create a capture, approve a workflow, return workflow ID."""
    cap_resp = client.post(
        "/api/v1/captures",
        json={
            "source": "web",
            "content_text": "Project workflow test",
            "mode": "manual",
            "manual_extraction": {
                "summary": "Test",
                "workflows": [{"name": "Deploy pipeline", "steps": [{"title": "Step 1"}]}],
            },
        },
        headers=auth_headers,
    )
    capture_id = cap_resp.json()["id"]
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={"decisions": [{"item_type": "workflow", "item_index": 0, "action": "approve"}]},
        headers=auth_headers,
    )
    wf_resp = client.get("/api/v1/workflows", headers=auth_headers)
    return wf_resp.json()["items"][0]["id"]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_project(client, auth_headers):
    data = _create_project(client, auth_headers)
    assert data["name"] == "Test Project"
    assert data["description"] == "A test project"
    assert data["color"] == "#7c3aed"
    assert "id" in data
    assert data["capture_count"] == 0
    assert data["task_count"] == 0
    assert data["workflow_count"] == 0


def test_create_project_name_required(client, auth_headers):
    resp = client.post(
        "/api/v1/projects",
        json={"name": "", "description": "No name"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_create_project_minimal(client, auth_headers):
    """Name-only creation uses defaults for optional fields."""
    resp = client.post(
        "/api/v1/projects",
        json={"name": "Minimal"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Minimal"
    assert data["description"] is None


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def test_list_projects(client, auth_headers):
    _create_project(client, auth_headers, name="Alpha")
    _create_project(client, auth_headers, name="Beta")

    resp = client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    names = [p["name"] for p in items]
    assert "Alpha" in names
    assert "Beta" in names


def test_list_projects_empty(client, auth_headers):
    resp = client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["items"] == []


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------

def test_get_project(client, auth_headers):
    created = _create_project(client, auth_headers, name="Getter")
    project_id = created["id"]

    resp = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == project_id
    assert resp.json()["name"] == "Getter"


def test_get_project_not_found(client, auth_headers):
    resp = client.get(f"/api/v1/projects/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def test_update_project_name(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]

    resp = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Renamed"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


def test_update_project_color(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]

    resp = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"color": "#16a34a"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["color"] == "#16a34a"


def test_update_project_not_found(client, auth_headers):
    resp = client.patch(
        f"/api/v1/projects/{uuid.uuid4()}",
        json={"name": "Ghost"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def test_delete_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]

    resp = client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200

    # Should 404 now
    resp2 = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp2.status_code == 404


def test_delete_project_not_found(client, auth_headers):
    resp = client.delete(f"/api/v1/projects/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Capture assignment
# ---------------------------------------------------------------------------

def test_assign_capture_to_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]
    capture_id = _create_capture(client, auth_headers)

    resp = client.post(
        f"/api/v1/projects/{project_id}/captures/{capture_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # Capture should reflect project assignment
    cap = client.get(f"/api/v1/captures/{capture_id}", headers=auth_headers).json()
    assert cap["project_id"] == project_id


def test_remove_capture_from_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]
    capture_id = _create_capture(client, auth_headers)

    # Assign then remove
    client.post(
        f"/api/v1/projects/{project_id}/captures/{capture_id}",
        headers=auth_headers,
    )
    resp = client.delete(
        f"/api/v1/projects/{project_id}/captures/{capture_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200

    cap = client.get(f"/api/v1/captures/{capture_id}", headers=auth_headers).json()
    assert cap["project_id"] is None


def test_assign_capture_increments_count(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]

    # Initially 0
    proj = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers).json()
    assert proj["capture_count"] == 0

    # Assign one capture
    capture_id = _create_capture(client, auth_headers)
    client.post(
        f"/api/v1/projects/{project_id}/captures/{capture_id}",
        headers=auth_headers,
    )

    proj = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers).json()
    assert proj["capture_count"] == 1


def test_list_captures_filtered_by_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]
    assigned_id = _create_capture(client, auth_headers, text="Assigned")
    _create_capture(client, auth_headers, text="Unassigned")

    client.post(
        f"/api/v1/projects/{project_id}/captures/{assigned_id}",
        headers=auth_headers,
    )

    resp = client.get(
        f"/api/v1/captures?project_id={project_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == assigned_id


# ---------------------------------------------------------------------------
# Task assignment
# ---------------------------------------------------------------------------

def test_assign_task_to_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]
    task_id = _create_approved_task(client, auth_headers)

    resp = client.post(
        f"/api/v1/projects/{project_id}/tasks/{task_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200

    task = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
    assert task["project_id"] == project_id


def test_remove_task_from_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]
    task_id = _create_approved_task(client, auth_headers)

    client.post(
        f"/api/v1/projects/{project_id}/tasks/{task_id}",
        headers=auth_headers,
    )
    resp = client.delete(
        f"/api/v1/projects/{project_id}/tasks/{task_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200

    task = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
    assert task["project_id"] is None


# ---------------------------------------------------------------------------
# Workflow assignment
# ---------------------------------------------------------------------------

def test_assign_workflow_to_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]
    wf_id = _create_approved_workflow(client, auth_headers)

    resp = client.post(
        f"/api/v1/projects/{project_id}/workflows/{wf_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200

    wf = client.get(f"/api/v1/workflows/{wf_id}", headers=auth_headers).json()
    assert wf["project_id"] == project_id


def test_remove_workflow_from_project(client, auth_headers):
    project_id = _create_project(client, auth_headers)["id"]
    wf_id = _create_approved_workflow(client, auth_headers)

    client.post(
        f"/api/v1/projects/{project_id}/workflows/{wf_id}",
        headers=auth_headers,
    )
    resp = client.delete(
        f"/api/v1/projects/{project_id}/workflows/{wf_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200

    wf = client.get(f"/api/v1/workflows/{wf_id}", headers=auth_headers).json()
    assert wf["project_id"] is None


# ---------------------------------------------------------------------------
# Workspace isolation
# ---------------------------------------------------------------------------

def test_workspace_isolation_list(client, auth_headers, other_headers):
    """User A's projects are invisible to user B."""
    _create_project(client, auth_headers, name="Private")

    resp = client.get("/api/v1/projects", headers=other_headers)
    assert resp.status_code == 200
    assert resp.json()["items"] == []


def test_workspace_isolation_get(client, auth_headers, other_headers):
    """User B cannot fetch user A's project."""
    project_id = _create_project(client, auth_headers)["id"]

    resp = client.get(f"/api/v1/projects/{project_id}", headers=other_headers)
    assert resp.status_code == 404


def test_workspace_isolation_update(client, auth_headers, other_headers):
    """User B cannot update user A's project."""
    project_id = _create_project(client, auth_headers)["id"]

    resp = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Hijacked"},
        headers=other_headers,
    )
    assert resp.status_code == 404

    # Original name unchanged
    original = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers).json()
    assert original["name"] == "Test Project"


def test_workspace_isolation_delete(client, auth_headers, other_headers):
    """User B cannot delete user A's project."""
    project_id = _create_project(client, auth_headers)["id"]

    resp = client.delete(f"/api/v1/projects/{project_id}", headers=other_headers)
    assert resp.status_code == 404

    # Project still exists for user A
    resp2 = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp2.status_code == 200


def test_workspace_isolation_assign_capture(client, auth_headers, other_headers):
    """User B cannot assign a capture to user A's project."""
    project_id = _create_project(client, auth_headers)["id"]
    capture_id = _create_capture(client, auth_headers)

    resp = client.post(
        f"/api/v1/projects/{project_id}/captures/{capture_id}",
        headers=other_headers,
    )
    assert resp.status_code == 404
