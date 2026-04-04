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
