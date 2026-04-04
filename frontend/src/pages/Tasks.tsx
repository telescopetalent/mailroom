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
  approved_at: string;
}

interface TaskList {
  items: Task[];
  pagination: { total_count: number };
}

export default function Tasks() {
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTasks = () => {
    setLoading(true);
    api<TaskList>("/tasks?status=open")
      .then((data) => setOpenTasks(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadCompleted = () => {
    api<TaskList>("/tasks?status=completed")
      .then((data) => setCompletedTasks(data.items))
      .catch((e) => setError(e.message));
  };

  useEffect(loadTasks, []);

  useEffect(() => {
    if (showCompleted && completedTasks.length === 0) {
      loadCompleted();
    }
  }, [showCompleted]);

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === "open" ? "completed" : "open";
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      // Move task between lists
      if (newStatus === "completed") {
        setOpenTasks((prev) => prev.filter((t) => t.id !== task.id));
        setCompletedTasks((prev) => [{ ...task, status: newStatus }, ...prev]);
      } else {
        setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
        setOpenTasks((prev) => [{ ...task, status: newStatus }, ...prev]);
      }
    } catch (e: any) {
      setError(e.message);
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
        onChange={() => toggleStatus(task)}
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

  return (
    <div style={{ maxWidth: 700 }}>
      <h2>Tasks</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Open tasks */}
      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : openTasks.length === 0 ? (
        <p style={{ color: "#888" }}>
          No open tasks. Capture content and approve extracted items to create tasks.
        </p>
      ) : (
        openTasks.map(renderTask)
      )}

      {/* Completed section */}
      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => {
            setShowCompleted((prev) => !prev);
          }}
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
          {completedTasks.length > 0 && ` (${completedTasks.length})`}
        </button>

        {showCompleted && (
          <div>
            {completedTasks.length === 0 ? (
              <p style={{ color: "#aaa", fontSize: "0.85rem", marginLeft: "1.5rem" }}>
                No completed tasks yet.
              </p>
            ) : (
              completedTasks.map(renderTask)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
