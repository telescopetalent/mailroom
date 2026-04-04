import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface Task {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  source: string;
  capture_id: string | null;
  workflow_id: string | null;
  workflow_name: string | null;
  workflow_order: number | null;
  approved_at: string;
}

interface TaskList {
  items: Task[];
  pagination: { total_count: number };
}

interface WorkflowTask {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  status: string;
  priority: string;
  workflow_order: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  capture_id: string | null;
  tasks: WorkflowTask[];
}

interface WorkflowList {
  items: Workflow[];
  pagination: { total_count: number };
}

export default function Tasks() {
  const [standaloneTasks, setStandaloneTasks] = useState<Task[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [completedWorkflows, setCompletedWorkflows] = useState<Workflow[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api<TaskList>("/tasks?status=open"),
      api<WorkflowList>("/workflows?status=open"),
    ])
      .then(([taskData, wfData]) => {
        // Standalone tasks = tasks not in any workflow
        setStandaloneTasks(taskData.items.filter((t) => !t.workflow_id));
        setWorkflows(wfData.items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadCompleted = () => {
    Promise.all([
      api<TaskList>("/tasks?status=completed"),
      api<WorkflowList>("/workflows?status=completed"),
    ])
      .then(([taskData, wfData]) => {
        setCompletedTasks(taskData.items.filter((t) => !t.workflow_id));
        setCompletedWorkflows(wfData.items);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(loadAll, []);

  useEffect(() => {
    if (showCompleted && completedTasks.length === 0 && completedWorkflows.length === 0) {
      loadCompleted();
    }
  }, [showCompleted]);

  const toggleTaskStatus = async (task: Task | WorkflowTask) => {
    const newStatus = task.status === "open" ? "completed" : "open";
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      // Reload to get updated workflow statuses
      loadAll();
      if (showCompleted) loadCompleted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const renderTask = (task: Task) => (
    <div
      key={task.id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid #eee",
        opacity: task.status === "completed" ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={task.status === "completed"}
        onChange={() => toggleTaskStatus(task)}
        style={{ marginTop: "0.2rem" }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ textDecoration: task.status === "completed" ? "line-through" : "none" }}>
          <strong>{task.title}</strong>
        </div>
        {task.description && (
          <div style={{ color: "#666", fontSize: "0.85rem" }}>{task.description}</div>
        )}
        <div style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.25rem" }}>
          {task.owner && `Owner: ${task.owner}`}
          {task.due_date && ` | Due: ${task.due_date}`}
          {task.priority !== "none" && ` | Priority: ${task.priority}`}
          {` | Source: ${task.source}`}
          {" | "}
          {task.capture_id ? (
            <Link to={`/captures/${task.capture_id}`}>View capture</Link>
          ) : (
            <span style={{ color: "#ccc", fontStyle: "italic" }}>Source removed</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderWorkflow = (wf: Workflow) => {
    const completedCount = wf.tasks.filter((t) => t.status === "completed").length;
    const totalCount = wf.tasks.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
      <div
        key={wf.id}
        style={{
          marginBottom: "1rem",
          border: "1px solid #ddd",
          borderRadius: "6px",
          padding: "0.75rem",
          opacity: wf.status === "completed" ? 0.6 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div>
            <strong style={{ fontSize: "1rem" }}>{wf.name}</strong>
            {wf.description && <div style={{ color: "#666", fontSize: "0.85rem" }}>{wf.description}</div>}
          </div>
          <span style={{ color: "#888", fontSize: "0.8rem", flexShrink: 0, marginLeft: "0.5rem" }}>
            {completedCount}/{totalCount} steps
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, marginBottom: "0.5rem" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: progress === 100 ? "#22c55e" : "#2563eb",
              borderRadius: 2,
              transition: "width 0.3s",
            }}
          />
        </div>

        {/* Steps */}
        {wf.tasks.map((step) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            <input
              type="checkbox"
              checked={step.status === "completed"}
              onChange={() => toggleTaskStatus(step)}
            />
            <span
              style={{
                color: "#999",
                fontSize: "0.75rem",
                width: "1.5rem",
                textAlign: "center",
              }}
            >
              {step.workflow_order + 1}.
            </span>
            <span
              style={{
                flex: 1,
                textDecoration: step.status === "completed" ? "line-through" : "none",
                opacity: step.status === "completed" ? 0.6 : 1,
              }}
            >
              {step.title}
            </span>
            {step.owner && <span style={{ color: "#888", fontSize: "0.75rem" }}>{step.owner}</span>}
          </div>
        ))}

        {wf.capture_id && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
            <Link to={`/captures/${wf.capture_id}`} style={{ color: "#2563eb" }}>View capture</Link>
          </div>
        )}
      </div>
    );
  };

  const completedCount = completedTasks.length + completedWorkflows.length;

  return (
    <div style={{ maxWidth: 700 }}>
      <h2>Tasks</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : workflows.length === 0 && standaloneTasks.length === 0 ? (
        <p style={{ color: "#888" }}>
          No open tasks. Capture content and approve extracted items to create tasks.
        </p>
      ) : (
        <>
          {/* Workflows */}
          {workflows.map(renderWorkflow)}

          {/* Standalone tasks */}
          {standaloneTasks.length > 0 && workflows.length > 0 && (
            <h4 style={{ margin: "1rem 0 0.5rem", color: "#666" }}>Standalone Tasks</h4>
          )}
          {standaloneTasks.map(renderTask)}
        </>
      )}

      {/* Completed section */}
      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => setShowCompleted((prev) => !prev)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.9rem",
            color: "#666",
            padding: "0.5rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ display: "inline-block", transform: showCompleted ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            &#9654;
          </span>
          Completed
          {completedCount > 0 && ` (${completedCount})`}
        </button>

        {showCompleted && (
          <div>
            {completedCount === 0 ? (
              <p style={{ color: "#aaa", fontSize: "0.85rem", marginLeft: "1.5rem" }}>
                No completed items yet.
              </p>
            ) : (
              <>
                {completedWorkflows.map(renderWorkflow)}
                {completedTasks.map(renderTask)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
