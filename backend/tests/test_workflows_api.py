"""Tests for workflow feature — approval, listing, auto-completion."""

from __future__ import annotations


def _create_capture_with_workflow(client, auth_headers) -> str:
    """Create a manual capture with a workflow."""
    resp = client.post(
        "/api/v1/captures",
        json={
            "source": "web",
            "content_text": "Workflow test",
            "mode": "manual",
            "manual_extraction": {
                "summary": "Meal plan",
                "workflows": [
                    {
                        "name": "Weekly Meal Plan",
                        "description": "Plan meals for the week",
                        "steps": [
                            {"title": "Pick recipes", "owner": "Tommy"},
                            {"title": "Make grocery list"},
                            {"title": "Go shopping"},
                        ],
                    },
                ],
                "tasks": [{"title": "Standalone task"}],
            },
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["extraction"]["workflows"]) == 1
    return data["id"]


def test_approve_workflow(client, auth_headers):
    capture_id = _create_capture_with_workflow(client, auth_headers)

    resp = client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "workflow", "item_index": 0, "action": "approve"},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["approved_task_count"] == 1  # 1 workflow approved


def test_workflow_creates_tasks(client, auth_headers):
    capture_id = _create_capture_with_workflow(client, auth_headers)

    # Approve the workflow
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "workflow", "item_index": 0, "action": "approve"},
            ],
        },
        headers=auth_headers,
    )

    # Check tasks were created with workflow association
    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    tasks = tasks_resp.json()["items"]
    workflow_tasks = [t for t in tasks if t.get("workflow_id")]
    assert len(workflow_tasks) == 3
    assert workflow_tasks[0]["workflow_order"] is not None


def test_list_workflows(client, auth_headers):
    capture_id = _create_capture_with_workflow(client, auth_headers)
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={"decisions": [{"item_type": "workflow", "item_index": 0, "action": "approve"}]},
        headers=auth_headers,
    )

    resp = client.get("/api/v1/workflows", headers=auth_headers)
    assert resp.status_code == 200
    workflows = resp.json()["items"]
    assert len(workflows) == 1
    assert workflows[0]["name"] == "Weekly Meal Plan"
    assert len(workflows[0]["tasks"]) == 3


def test_workflow_auto_complete(client, auth_headers):
    capture_id = _create_capture_with_workflow(client, auth_headers)
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={"decisions": [{"item_type": "workflow", "item_index": 0, "action": "approve"}]},
        headers=auth_headers,
    )

    # Get workflow tasks
    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    wf_tasks = [t for t in tasks_resp.json()["items"] if t.get("workflow_id")]

    # Complete all 3 steps
    for t in wf_tasks:
        client.patch(
            f"/api/v1/tasks/{t['id']}",
            json={"status": "completed"},
            headers=auth_headers,
        )

    # Workflow should auto-complete
    wf_resp = client.get("/api/v1/workflows", headers=auth_headers)
    # Open workflows should be empty now
    open_wfs = [w for w in wf_resp.json()["items"] if w["status"] == "open"]
    assert len(open_wfs) == 0

    # Check completed workflows
    wf_all = client.get("/api/v1/workflows?status=completed", headers=auth_headers)
    completed = wf_all.json()["items"]
    assert len(completed) == 1
    assert completed[0]["status"] == "completed"


def test_workflow_reopen_on_uncomplete(client, auth_headers):
    capture_id = _create_capture_with_workflow(client, auth_headers)
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={"decisions": [{"item_type": "workflow", "item_index": 0, "action": "approve"}]},
        headers=auth_headers,
    )

    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    wf_tasks = [t for t in tasks_resp.json()["items"] if t.get("workflow_id")]

    # Complete all
    for t in wf_tasks:
        client.patch(f"/api/v1/tasks/{t['id']}", json={"status": "completed"}, headers=auth_headers)

    # Uncomplete one
    client.patch(f"/api/v1/tasks/{wf_tasks[0]['id']}", json={"status": "open"}, headers=auth_headers)

    # Workflow should reopen
    wf_resp = client.get("/api/v1/workflows?status=open", headers=auth_headers)
    assert len(wf_resp.json()["items"]) == 1


def test_reject_workflow(client, auth_headers):
    capture_id = _create_capture_with_workflow(client, auth_headers)

    resp = client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "workflow", "item_index": 0, "action": "reject"},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["rejected_item_count"] == 1

    # No workflows should exist
    wf_resp = client.get("/api/v1/workflows", headers=auth_headers)
    assert len(wf_resp.json()["items"]) == 0


def test_standalone_tasks_separate_from_workflows(client, auth_headers):
    capture_id = _create_capture_with_workflow(client, auth_headers)

    # Approve both workflow and standalone task
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={
            "decisions": [
                {"item_type": "workflow", "item_index": 0, "action": "approve"},
                {"item_type": "task", "item_index": 0, "action": "approve"},
            ],
        },
        headers=auth_headers,
    )

    tasks_resp = client.get("/api/v1/tasks", headers=auth_headers)
    tasks = tasks_resp.json()["items"]

    standalone = [t for t in tasks if not t.get("workflow_id")]
    workflow_tasks = [t for t in tasks if t.get("workflow_id")]

    assert len(standalone) == 1
    assert standalone[0]["title"] == "Standalone task"
    assert len(workflow_tasks) == 3


def _approve_workflow(client, auth_headers) -> str:
    """Create and approve a workflow; return the workflow ID."""
    capture_id = _create_capture_with_workflow(client, auth_headers)
    client.patch(
        f"/api/v1/captures/{capture_id}/review",
        json={"decisions": [{"item_type": "workflow", "item_index": 0, "action": "approve"}]},
        headers=auth_headers,
    )
    wf_resp = client.get("/api/v1/workflows", headers=auth_headers)
    return wf_resp.json()["items"][0]["id"]


def test_delete_workflow(client, auth_headers):
    """DELETE /workflows/{id} removes the workflow and all its tasks."""
    wf_id = _approve_workflow(client, auth_headers)

    # Confirm tasks exist
    tasks_before = client.get("/api/v1/tasks", headers=auth_headers).json()["items"]
    wf_tasks_before = [t for t in tasks_before if t.get("workflow_id") == wf_id]
    assert len(wf_tasks_before) == 3

    resp = client.delete(f"/api/v1/workflows/{wf_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    # Workflow should be gone
    wf_resp = client.get("/api/v1/workflows", headers=auth_headers)
    assert all(w["id"] != wf_id for w in wf_resp.json()["items"])

    # All workflow tasks should be gone too
    tasks_after = client.get("/api/v1/tasks", headers=auth_headers).json()["items"]
    wf_tasks_after = [t for t in tasks_after if t.get("workflow_id") == wf_id]
    assert len(wf_tasks_after) == 0


def test_delete_workflow_not_found(client, auth_headers):
    """DELETE on a nonexistent workflow returns 404."""
    import uuid
    resp = client.delete(f"/api/v1/workflows/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


def test_add_workflow_step(client, auth_headers):
    """POST /workflows/{id}/steps appends a new open task to the workflow."""
    wf_id = _approve_workflow(client, auth_headers)

    resp = client.post(
        f"/api/v1/workflows/{wf_id}/steps",
        json={"title": "New step"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["tasks"]) == 4
    new_step = data["tasks"][-1]
    assert new_step["title"] == "New step"
    assert new_step["status"] == "open"
    assert new_step["workflow_order"] == 3


def test_add_workflow_step_empty_title(client, auth_headers):
    """POST /workflows/{id}/steps with blank title returns 400."""
    wf_id = _approve_workflow(client, auth_headers)

    resp = client.post(
        f"/api/v1/workflows/{wf_id}/steps",
        json={"title": "   "},
        headers=auth_headers,
    )
    assert resp.status_code == 400
