import { useState } from "react";
import { api } from "../api/client";

interface Extraction {
  id: string;
  summary: string | null;
  next_steps: string[];
  tasks: { title: string; description?: string; owner?: string; due_date?: string; priority?: string }[];
  blockers: string[];
  follow_ups: { description: string; owner?: string; due_date?: string }[];
  priority: string;
}

interface ReviewPanelProps {
  captureId: string;
  extraction: Extraction;
  onReviewComplete: () => void;
}

interface Decision {
  item_type: string;
  item_index: number;
  action: "approve" | "reject";
}

export default function ReviewPanel({ captureId, extraction, onReviewComplete }: ReviewPanelProps) {
  const [decisions, setDecisions] = useState<Record<string, "approve" | "reject">>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggle = (key: string, action: "approve" | "reject") => {
    setDecisions((prev) => ({ ...prev, [key]: prev[key] === action ? undefined! : action }));
  };

  const handleSubmit = async () => {
    const items: Decision[] = [];
    for (const [key, action] of Object.entries(decisions)) {
      if (!action) continue;
      const [type, indexStr] = key.split("-");
      items.push({ item_type: type, item_index: parseInt(indexStr), action });
    }

    if (items.length === 0) return;

    setSubmitting(true);
    setError("");
    try {
      await api(`/captures/${captureId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decisions: items }),
      });
      onReviewComplete();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const approveAll = () => {
    const all: Record<string, "approve"> = {};
    extraction.tasks.forEach((_, i) => (all[`task-${i}`] = "approve"));
    extraction.next_steps.forEach((_, i) => (all[`next_step-${i}`] = "approve"));
    extraction.follow_ups.forEach((_, i) => (all[`follow_up-${i}`] = "approve"));
    setDecisions(all);
  };

  const renderItem = (type: string, index: number, label: string, detail?: string) => {
    const key = `${type}-${index}`;
    const decision = decisions[key];

    return (
      <div
        key={key}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "0.5rem 0",
          borderBottom: "1px solid #eee",
          opacity: decision === "reject" ? 0.5 : 1,
        }}
      >
        <div style={{ flex: 1 }}>
          <strong>{label}</strong>
          {detail && <div style={{ color: "#666", fontSize: "0.85rem" }}>{detail}</div>}
        </div>
        <button
          onClick={() => toggle(key, "approve")}
          style={{
            padding: "0.25rem 0.5rem",
            fontSize: "0.8rem",
            background: decision === "approve" ? "#22c55e" : "#f0f0f0",
            color: decision === "approve" ? "white" : "#333",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Approve
        </button>
        <button
          onClick={() => toggle(key, "reject")}
          style={{
            padding: "0.25rem 0.5rem",
            fontSize: "0.8rem",
            background: decision === "reject" ? "#ef4444" : "#f0f0f0",
            color: decision === "reject" ? "white" : "#333",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Reject
        </button>
      </div>
    );
  };

  const hasItems = extraction.tasks.length > 0 || extraction.next_steps.length > 0 || extraction.follow_ups.length > 0;

  return (
    <div>
      {extraction.summary && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f8f9fa", borderRadius: "4px" }}>
          <strong>Summary:</strong> {extraction.summary}
        </div>
      )}

      {extraction.blockers.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem" }}>Blockers</h4>
          {extraction.blockers.map((b, i) => (
            <div key={i} style={{ color: "#dc2626", padding: "0.25rem 0" }}>{b}</div>
          ))}
        </div>
      )}

      {extraction.tasks.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem" }}>Tasks</h4>
          {extraction.tasks.map((t, i) =>
            renderItem("task", i, t.title, [t.owner && `Owner: ${t.owner}`, t.due_date && `Due: ${t.due_date}`, t.priority && t.priority !== "none" && `Priority: ${t.priority}`].filter(Boolean).join(" | "))
          )}
        </div>
      )}

      {extraction.next_steps.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem" }}>Next Steps</h4>
          {extraction.next_steps.map((s, i) => renderItem("next_step", i, s))}
        </div>
      )}

      {extraction.follow_ups.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem" }}>Follow-ups</h4>
          {extraction.follow_ups.map((f, i) =>
            renderItem("follow_up", i, f.description, f.owner ? `Owner: ${f.owner}` : undefined)
          )}
        </div>
      )}

      {hasItems ? (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button onClick={approveAll} style={{ padding: "0.5rem 1rem" }}>
            Approve All
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(decisions).length === 0}
            style={{ padding: "0.5rem 1rem", cursor: submitting ? "wait" : "pointer" }}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            No actionable items extracted. You can mark this capture as reviewed.
          </p>
          <button
            onClick={async () => {
              setSubmitting(true);
              setError("");
              try {
                await api(`/captures/${captureId}/review`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    decisions: [{ item_type: "summary", item_index: 0, action: "approve" }],
                  }),
                });
                onReviewComplete();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            style={{
              padding: "0.5rem 1rem",
              background: "#22c55e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Marking..." : "Mark as Reviewed"}
          </button>
        </div>
      )}

      {error && <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
