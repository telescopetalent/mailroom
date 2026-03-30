import { useState } from "react";
import { api } from "../api/client";

interface CaptureInputProps {
  onCaptureCreated: () => void;
}

interface ManualTask {
  title: string;
  owner: string;
  due_date: string;
  priority: string;
}

interface ManualFollowUp {
  description: string;
  owner: string;
  due_date: string;
}

const emptyTask = (): ManualTask => ({ title: "", owner: "", due_date: "", priority: "none" });
const emptyFollowUp = (): ManualFollowUp => ({ description: "", owner: "", due_date: "" });

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  fontSize: "0.9rem",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#666",
  marginBottom: "0.2rem",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "1rem",
  padding: "0.75rem",
  background: "#f9fafb",
  borderRadius: "6px",
  border: "1px solid #e5e7eb",
};

export default function CaptureInput({ onCaptureCreated }: CaptureInputProps) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Manual form state
  const [summary, setSummary] = useState("");
  const [tasks, setTasks] = useState<ManualTask[]>([emptyTask()]);
  const [nextSteps, setNextSteps] = useState<string[]>([""]);
  const [blockers, setBlockers] = useState<string[]>([""]);
  const [followUps, setFollowUps] = useState<ManualFollowUp[]>([emptyFollowUp()]);
  const [priority, setPriority] = useState("none");

  const resetManualForm = () => {
    setSummary("");
    setTasks([emptyTask()]);
    setNextSteps([""]);
    setBlockers([""]);
    setFollowUps([emptyFollowUp()]);
    setPriority("none");
  };

  const handleSubmitAI = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api("/captures", {
        method: "POST",
        body: JSON.stringify({ source: "web", content_text: text, mode: "ai" }),
      });
      setText("");
      onCaptureCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitManual = async () => {
    const filteredTasks = tasks
      .filter((t) => t.title.trim())
      .map((t) => ({
        title: t.title,
        owner: t.owner || undefined,
        due_date: t.due_date || undefined,
        priority: t.priority,
      }));
    const filteredNextSteps = nextSteps.filter((s) => s.trim());
    const filteredBlockers = blockers.filter((b) => b.trim());
    const filteredFollowUps = followUps
      .filter((f) => f.description.trim())
      .map((f) => ({
        description: f.description,
        owner: f.owner || undefined,
        due_date: f.due_date || undefined,
      }));

    if (!summary.trim() && filteredTasks.length === 0 && filteredNextSteps.length === 0) {
      setError("Add a summary, at least one task, or a next step.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api("/captures", {
        method: "POST",
        body: JSON.stringify({
          source: "web",
          content_text: summary || "Manual capture",
          mode: "manual",
          manual_extraction: {
            summary: summary || undefined,
            tasks: filteredTasks,
            next_steps: filteredNextSteps,
            blockers: filteredBlockers,
            follow_ups: filteredFollowUps,
            priority,
          },
        }),
      });
      resetManualForm();
      onCaptureCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateTask = (i: number, field: keyof ManualTask, value: string) => {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  };

  const updateFollowUp = (i: number, field: keyof ManualFollowUp, value: string) => {
    setFollowUps((prev) => prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0 }}>Capture</h3>
        <div
          style={{
            display: "flex",
            background: "#f3f4f6",
            borderRadius: "6px",
            padding: "2px",
          }}
        >
          <button
            onClick={() => setMode("ai")}
            style={{
              padding: "0.3rem 0.75rem",
              fontSize: "0.85rem",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: mode === "ai" ? "#111" : "transparent",
              color: mode === "ai" ? "white" : "#666",
              fontWeight: mode === "ai" ? 600 : 400,
            }}
          >
            AI
          </button>
          <button
            onClick={() => setMode("manual")}
            style={{
              padding: "0.3rem 0.75rem",
              fontSize: "0.85rem",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: mode === "manual" ? "#111" : "transparent",
              color: mode === "manual" ? "white" : "#666",
              fontWeight: mode === "manual" ? 600 : 400,
            }}
          >
            Manual
          </button>
        </div>
      </div>

      {mode === "ai" ? (
        <>
          <textarea
            placeholder="Paste meeting notes, emails, messages, or any text with action items..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontFamily: "inherit",
              fontSize: "0.95rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          {error && <p style={{ color: "red", margin: "0.5rem 0" }}>{error}</p>}
          <button
            onClick={handleSubmitAI}
            disabled={loading || !text.trim()}
            style={{ marginTop: "0.5rem", padding: "0.5rem 1.5rem", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Processing..." : "Send to Mailroom"}
          </button>
        </>
      ) : (
        <div>
          {/* Summary */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Summary</div>
            <textarea
              placeholder="Brief summary of this capture..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>

          {/* Priority */}
          <div style={{ ...sectionStyle, display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={labelStyle}>Priority</div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={inputStyle}
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Tasks */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Tasks</div>
              <button
                onClick={() => setTasks((prev) => [...prev, emptyTask()])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add task
              </button>
            </div>
            {tasks.map((t, i) => (
              <div key={i} style={{ marginBottom: "0.5rem", padding: "0.5rem", background: "white", borderRadius: "4px", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  <input
                    placeholder="Task title"
                    value={t.title}
                    onChange={(e) => updateTask(i, "title", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {tasks.length > 1 && (
                    <button
                      onClick={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    placeholder="Owner"
                    value={t.owner}
                    onChange={(e) => updateTask(i, "owner", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="date"
                    value={t.due_date}
                    onChange={(e) => updateTask(i, "due_date", e.target.value)}
                    style={{ ...inputStyle }}
                  />
                  <select
                    value={t.priority}
                    onChange={(e) => updateTask(i, "priority", e.target.value)}
                    style={{ ...inputStyle }}
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Next Steps */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Next Steps</div>
              <button
                onClick={() => setNextSteps((prev) => [...prev, ""])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            {nextSteps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input
                  placeholder="Next step..."
                  value={s}
                  onChange={(e) => setNextSteps((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {nextSteps.length > 1 && (
                  <button
                    onClick={() => setNextSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Blockers */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Blockers</div>
              <button
                onClick={() => setBlockers((prev) => [...prev, ""])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            {blockers.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input
                  placeholder="Blocker..."
                  value={b}
                  onChange={(e) => setBlockers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {blockers.length > 1 && (
                  <button
                    onClick={() => setBlockers((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Follow-ups */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Follow-ups</div>
              <button
                onClick={() => setFollowUps((prev) => [...prev, emptyFollowUp()])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            {followUps.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input
                  placeholder="Follow-up description"
                  value={f.description}
                  onChange={(e) => updateFollowUp(i, "description", e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  placeholder="Owner"
                  value={f.owner}
                  onChange={(e) => updateFollowUp(i, "owner", e.target.value)}
                  style={{ ...inputStyle, width: "120px" }}
                />
                <input
                  type="date"
                  value={f.due_date}
                  onChange={(e) => updateFollowUp(i, "due_date", e.target.value)}
                  style={inputStyle}
                />
                {followUps.length > 1 && (
                  <button
                    onClick={() => setFollowUps((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && <p style={{ color: "red", margin: "0.5rem 0" }}>{error}</p>}
          <button
            onClick={handleSubmitManual}
            disabled={loading}
            style={{ padding: "0.5rem 1.5rem", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Saving..." : "Save Capture"}
          </button>
        </div>
      )}
    </div>
  );
}
