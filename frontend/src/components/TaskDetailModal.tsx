import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  due_date: string | null;
  priority: string;
  labels: string[];
  reminder: string | null;
  location: string | null;
  notes: string | null;
  blocked_by_workflow_id: string | null;
  blocked_by_workflow_name: string | null;
  blocked_by_task_id: string | null;
  blocked_by_task_title: string | null;
  is_blocked: boolean;
  status: string;
  source: string;
  capture_id: string | null;
  workflow_id: string | null;
  workflow_name: string | null;
  workflow_order: number | null;
  approved_at: string;
  created_at: string;
}

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const priorityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
  none: "#d1d5db",
};

export default function TaskDetailModal({ taskId, onClose, onUpdate }: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [availableWorkflows, setAvailableWorkflows] = useState<{ id: string; name: string }[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api<TaskDetail>(`/tasks/${taskId}`)
      .then(setTask)
      .catch(() => onClose())
      .finally(() => setLoading(false));
    // Load available workflows for dependency picker
    api<{ items: { id: string; name: string; status: string }[] }>("/workflows")
      .then((data) => setAvailableWorkflows(data.items.filter((w) => w.status === "open")))
      .catch(() => {});
  }, [taskId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveField = async (field: string, value: unknown) => {
    if (!task) return;
    try {
      const updated = await api<TaskDetail>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      setTask(updated);
      onUpdate();
    } catch {
      // Silently fail — field reverts on next fetch
    }
    setEditingField(null);
  };

  const addLabel = () => {
    if (!task || !labelInput.trim()) return;
    const newLabels = [...task.labels, labelInput.trim()];
    setLabelInput("");
    saveField("labels", newLabels);
  };

  const removeLabel = (label: string) => {
    if (!task) return;
    saveField("labels", task.labels.filter((l) => l !== label));
  };

  const toggleStatus = () => {
    if (!task) return;
    saveField("status", task.status === "open" ? "completed" : "open");
  };

  if (loading || !task) {
    return (
      <div style={backdropStyle} onClick={onClose}>
        <div style={{ ...modalStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#999" }}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div ref={modalRef} style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <button onClick={onClose} style={closeBtnStyle}>X</button>
          <span style={{ color: "#999", fontSize: "0.75rem" }}>
            {task.status === "completed" ? "Completed" : "Open"}
          </span>
        </div>

        {/* Title + Status */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <button
            onClick={toggleStatus}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: `2px solid ${priorityColors[task.priority] || "#d1d5db"}`,
              background: task.status === "completed" ? priorityColors[task.priority] || "#d1d5db" : "transparent",
              cursor: "pointer",
              flexShrink: 0,
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "0.7rem",
            }}
          >
            {task.status === "completed" ? "\u2713" : ""}
          </button>
          <div style={{ flex: 1 }}>
            {editingField === "title" ? (
              <input
                autoFocus
                defaultValue={task.title}
                onBlur={(e) => saveField("title", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                style={{ ...editInputStyle, fontSize: "1.25rem", fontWeight: 700 }}
              />
            ) : (
              <h3
                onClick={() => setEditingField("title")}
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  textDecoration: task.status === "completed" ? "line-through" : "none",
                  opacity: task.status === "completed" ? 0.6 : 1,
                }}
              >
                {task.title}
              </h3>
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: "1rem", marginLeft: "2.25rem" }}>
          {editingField === "description" ? (
            <textarea
              autoFocus
              defaultValue={task.description || ""}
              onBlur={(e) => saveField("description", e.target.value || null)}
              rows={2}
              style={{ ...editInputStyle, resize: "vertical" }}
            />
          ) : (
            <div
              onClick={() => setEditingField("description")}
              style={{ color: task.description ? "#333" : "#bbb", fontSize: "0.9rem", cursor: "pointer", minHeight: "1.5rem" }}
            >
              {task.description || "Add description..."}
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Metadata rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
          {/* Source */}
          <MetadataRow icon={"\u{1F4C2}"} label="Source" value={task.source} />

          {/* Due date */}
          <div style={metaRowStyle}>
            <span style={metaIconStyle}>{"\u{1F4C5}"}</span>
            <span style={metaLabelStyle}>Due</span>
            <div style={{ flex: 1 }}>
              <input
                type="date"
                value={task.due_date || ""}
                onChange={(e) => saveField("due_date", e.target.value || null)}
                style={{ ...metaValueStyle, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {/* Priority */}
          <div style={metaRowStyle}>
            <span style={{ ...metaIconStyle, color: priorityColors[task.priority] }}>{"\u{1F6A9}"}</span>
            <span style={metaLabelStyle}>Priority</span>
            <select
              value={task.priority}
              onChange={(e) => saveField("priority", e.target.value)}
              style={{ ...metaValueStyle, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Owner */}
          <div style={metaRowStyle}>
            <span style={metaIconStyle}>{"\u{1F464}"}</span>
            <span style={metaLabelStyle}>Owner</span>
            {editingField === "owner" ? (
              <input
                autoFocus
                defaultValue={task.owner || ""}
                onBlur={(e) => saveField("owner", e.target.value || null)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                style={{ ...editInputStyle, flex: 1, fontSize: "0.9rem" }}
              />
            ) : (
              <span
                onClick={() => setEditingField("owner")}
                style={{ ...metaValueStyle, cursor: "pointer", color: task.owner ? "#333" : "#bbb" }}
              >
                {task.owner || "Assign..."}
              </span>
            )}
          </div>

          {/* Labels */}
          <div style={metaRowStyle}>
            <span style={metaIconStyle}>{"\u{1F3F7}\uFE0F"}</span>
            <span style={metaLabelStyle}>Labels</span>
            <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}>
              {task.labels.map((label) => (
                <span
                  key={label}
                  style={{
                    background: "#f3f4f6",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "12px",
                    fontSize: "0.8rem",
                    color: "#555",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  {label}
                  <button
                    onClick={() => removeLabel(label)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "0.7rem", padding: 0 }}
                  >
                    x
                  </button>
                </span>
              ))}
              <input
                placeholder="Add label..."
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }}
                onBlur={() => { if (labelInput.trim()) addLabel(); }}
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: "0.8rem",
                  width: "80px",
                  padding: "0.15rem 0",
                  background: "transparent",
                  color: "#999",
                }}
              />
            </div>
          </div>

          {/* Reminder */}
          <div style={metaRowStyle}>
            <span style={metaIconStyle}>{"\u23F0"}</span>
            <span style={metaLabelStyle}>Reminder</span>
            <input
              type="datetime-local"
              value={task.reminder ? task.reminder.slice(0, 16) : ""}
              onChange={(e) => saveField("reminder", e.target.value ? new Date(e.target.value).toISOString() : null)}
              style={{ ...metaValueStyle, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
            />
          </div>

          {/* Location */}
          <div style={metaRowStyle}>
            <span style={metaIconStyle}>{"\u{1F4CD}"}</span>
            <span style={metaLabelStyle}>Location</span>
            {editingField === "location" ? (
              <input
                autoFocus
                defaultValue={task.location || ""}
                onBlur={(e) => saveField("location", e.target.value || null)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                style={{ ...editInputStyle, flex: 1, fontSize: "0.9rem" }}
              />
            ) : (
              <span
                onClick={() => setEditingField("location")}
                style={{ ...metaValueStyle, cursor: "pointer", color: task.location ? "#333" : "#bbb" }}
              >
                {task.location || "Add location..."}
              </span>
            )}
          </div>
        </div>

        {/* Blocked by */}
        <div style={dividerStyle} />
        <div style={metaRowStyle}>
          <span style={metaIconStyle}>{"\u{1F512}"}</span>
          <span style={metaLabelStyle}>Blocked by</span>
          <div style={{ flex: 1 }}>
            {task.blocked_by_workflow_name || task.blocked_by_task_title ? (
              <>
                <span style={{
                  background: task.is_blocked ? "#fef2f2" : "#dcfce7",
                  color: task.is_blocked ? "#dc2626" : "#166534",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.82rem",
                }}>
                  {task.is_blocked ? "\u{1F534}" : "\u{1F7E2}"} {task.blocked_by_workflow_name || task.blocked_by_task_title}
                </span>
                {!task.is_blocked && <span style={{ color: "#888", fontSize: "0.78rem", marginLeft: "0.5rem" }}>completed</span>}
                <button
                  onClick={() => saveField("blocked_by_workflow_id", "00000000-0000-0000-0000-000000000000")}
                  style={{ marginLeft: "0.5rem", background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  remove
                </button>
              </>
            ) : availableWorkflows.length > 0 ? (
              <select
                value=""
                onChange={(e) => { if (e.target.value) saveField("blocked_by_workflow_id", e.target.value); }}
                style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "0.2rem 0.4rem", fontSize: "0.82rem", color: "#888", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
              >
                <option value="">Add dependency...</option>
                {availableWorkflows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            ) : (
              <span style={{ color: "#ccc", fontSize: "0.82rem" }}>None</span>
            )}
          </div>
        </div>

        {/* Workflow info */}
        {task.workflow_name && (
          <>
            <div style={dividerStyle} />
            <div style={metaRowStyle}>
              <span style={metaIconStyle}>{"\u{1F4CB}"}</span>
              <span style={metaLabelStyle}>Workflow</span>
              <span style={metaValueStyle}>{task.workflow_name}</span>
            </div>
          </>
        )}

        <div style={dividerStyle} />

        {/* Notes */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.4rem" }}>Notes</div>
          <textarea
            value={task.notes || ""}
            onChange={(e) => setTask({ ...task, notes: e.target.value })}
            onBlur={(e) => saveField("notes", e.target.value || null)}
            placeholder="Add notes..."
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "0.5rem",
              fontSize: "0.9rem",
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
            }}
          />
        </div>

        <div style={dividerStyle} />

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#999", fontSize: "0.8rem" }}>
          <div>
            {task.capture_id ? (
              <Link to={`/captures/${task.capture_id}`} style={{ color: "#2563eb" }} onClick={onClose}>
                View capture
              </Link>
            ) : (
              <span style={{ color: "#ccc", fontStyle: "italic" }}>Source removed</span>
            )}
          </div>
          <div>Created {new Date(task.created_at).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}

function MetadataRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={metaRowStyle}>
      <span style={metaIconStyle}>{icon}</span>
      <span style={metaLabelStyle}>{label}</span>
      <span style={metaValueStyle}>{value}</span>
    </div>
  );
}

// --- Styles ---

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  zIndex: 1000,
  animation: "fadeIn 0.15s ease-out",
};

const modalStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "16px 16px 0 0",
  width: "100%",
  maxWidth: 520,
  maxHeight: "85vh",
  overflowY: "auto",
  padding: "1.25rem",
  boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
  animation: "slideUp 0.2s ease-out",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "1.1rem",
  cursor: "pointer",
  color: "#999",
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
};

const dividerStyle: React.CSSProperties = {
  borderTop: "1px solid #f0f0f0",
  margin: "0.75rem 0",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.5rem 0",
};

const metaIconStyle: React.CSSProperties = {
  width: "1.25rem",
  textAlign: "center",
  fontSize: "0.9rem",
  flexShrink: 0,
};

const metaLabelStyle: React.CSSProperties = {
  width: "5rem",
  fontSize: "0.85rem",
  color: "#888",
  flexShrink: 0,
};

const metaValueStyle: React.CSSProperties = {
  flex: 1,
  fontSize: "0.9rem",
  color: "#333",
};

const editInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  padding: "0.3rem 0.5rem",
  fontSize: "0.9rem",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
