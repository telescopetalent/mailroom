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
  capture_id: string;
  approved_at: string;
}

interface TaskList {
  items: Task[];
  pagination: { total_count: number };
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<TaskList>("/tasks")
      .then((data) => setTasks(data.items))
      .catch((e) => setError(e.message));
  }, []);

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === "open" ? "completed" : "open";
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h2>Approved Tasks</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {tasks.length === 0 && <p style={{ color: "#888" }}>No tasks yet. Capture content and approve extracted items to create tasks.</p>}

      {tasks.map((task) => (
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
            {task.description && <div style={{ color: "#666", fontSize: "0.85rem" }}>{task.description}</div>}
            <div style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              {task.owner && `Owner: ${task.owner}`}
              {task.due_date && ` | Due: ${task.due_date}`}
              {task.priority !== "none" && ` | Priority: ${task.priority}`}
              {` | Source: ${task.source}`}
              {" | "}
              <Link to={`/captures/${task.capture_id}`}>View capture</Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
