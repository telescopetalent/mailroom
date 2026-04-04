import { useState } from "react";
import { api } from "../api/client";

interface WorkflowStep {
  title: string;
  description?: string;
  owner?: string;
  due_date?: string;
  priority?: string;
}

interface Workflow {
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

interface Extraction {
  id: string;
  summary: string | null;
  next_steps: string[];
  tasks: { title: string; description?: string; owner?: string; due_date?: string; priority?: string }[];
  workflows: Workflow[];
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
  action: "approve" | "reject" | "edit";
  edited_value?: Record<string, unknown>;
}

export default function ReviewPanel({ captureId, extraction, onReviewComplete }: ReviewPanelProps) {
  const [decisions, setDecisions] = useState<Record<string, "approve" | "reject">>({});
  const [workflowEdits, setWorkflowEdits] = useState<Record<number, Workflow>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggle = (key: string, action: "approve" | "reject") => {
    setDecisions((prev) => ({ ...prev, [key]: prev[key] === action ? undefined! : action }));
  };

  const getWorkflow = (index: number): Workflow => {
    return workflowEdits[index] || extraction.workflows[index];
  };

  const moveStep = (wfIndex: number, stepIndex: number, direction: "up" | "down") => {
    const wf = { ...getWorkflow(wfIndex), steps: [...getWorkflow(wfIndex).steps] };
    const newIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1;
    if (newIndex < 0 || newIndex >= wf.steps.length) return;
    [wf.steps[stepIndex], wf.steps[newIndex]] = [wf.steps[newIndex], wf.steps[stepIndex]];
    setWorkflowEdits((prev) => ({ ...prev, [wfIndex]: wf }));
  };

  const editStepTitle = (wfIndex: number, stepIndex: number, title: string) => {
    const wf = { ...getWorkflow(wfIndex), steps: [...getWorkflow(wfIndex).steps] };
    wf.steps[stepIndex] = { ...wf.steps[stepIndex], title };
    setWorkflowEdits((prev) => ({ ...prev, [wfIndex]: wf }));
  };

  const handleSubmit = async () => {
    const items: Decision[] = [];
    for (const [key, action] of Object.entries(decisions)) {
      if (!action) continue;
      const [type, indexStr] = key.split("-");
      const index = parseInt(indexStr);

      if (type === "workflow" && action === "approve" && workflowEdits[index]) {
        // Send edited workflow data
        items.push({ item_type: "workflow", item_index: index, action: "edit", edited_value: workflowEdits[index] as unknown as Record<string, unknown> });
      } else {
        items.push({ item_type: type, item_index: index, action });
      }
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const approveAll = () => {
    const all: Record<string, "approve"> = {};
    extraction.tasks.forEach((_, i) => (all[`task-${i}`] = "approve"));
    extraction.workflows.forEach((_, i) => (all[`workflow-${i}`] = "approve"));
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

  const renderWorkflow = (wfIndex: number) => {
    const wf = getWorkflow(wfIndex);
    const key = `workflow-${wfIndex}`;
    const decision = decisions[key];

    return (
      <div
        key={key}
        style={{
          marginBottom: "0.75rem",
          padding: "0.75rem",
          border: decision === "approve" ? "2px solid #22c55e" : decision === "reject" ? "2px solid #ef4444" : "1px solid #ddd",
          borderRadius: "6px",
          opacity: decision === "reject" ? 0.5 : 1,
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div>
            <strong style={{ fontSize: "1rem" }}>{wf.name}</strong>
            {wf.description && <div style={{ color: "#666", fontSize: "0.85rem" }}>{wf.description}</div>}
            <div style={{ color: "#999", fontSize: "0.8rem" }}>{wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
            <button
              onClick={() => toggle(key, "approve")}
              style={{
                padding: "0.3rem 0.6rem",
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
                padding: "0.3rem 0.6rem",
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
        </div>

        {/* Steps list */}
        <div style={{ marginLeft: "0.5rem" }}>
          {wf.steps.map((step, si) => (
            <div
              key={si}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.35rem 0",
                borderBottom: si < wf.steps.length - 1 ? "1px solid #eee" : "none",
              }}
            >
              <span style={{ color: "#999", fontSize: "0.8rem", width: "1.5rem", textAlign: "center" }}>{si + 1}.</span>
              <input
                type="text"
                value={step.title}
                onChange={(e) => editStepTitle(wfIndex, si, e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  borderBottom: "1px solid transparent",
                  background: "transparent",
                  fontSize: "0.9rem",
                  padding: "0.2rem 0",
                }}
                onFocus={(e) => (e.target.style.borderBottomColor = "#2563eb")}
                onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
              />
              {step.owner && <span style={{ color: "#888", fontSize: "0.75rem" }}>{step.owner}</span>}
              <button
                onClick={() => moveStep(wfIndex, si, "up")}
                disabled={si === 0}
                style={{ fontSize: "0.7rem", padding: "0.15rem 0.3rem", cursor: si === 0 ? "default" : "pointer", opacity: si === 0 ? 0.3 : 1, border: "1px solid #ddd", borderRadius: "2px", background: "#fff" }}
              >
                ↑
              </button>
              <button
                onClick={() => moveStep(wfIndex, si, "down")}
                disabled={si === wf.steps.length - 1}
                style={{ fontSize: "0.7rem", padding: "0.15rem 0.3rem", cursor: si === wf.steps.length - 1 ? "default" : "pointer", opacity: si === wf.steps.length - 1 ? 0.3 : 1, border: "1px solid #ddd", borderRadius: "2px", background: "#fff" }}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasItems =
    extraction.tasks.length > 0 ||
    extraction.workflows.length > 0 ||
    extraction.next_steps.length > 0 ||
    extraction.follow_ups.length > 0;

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

      {extraction.workflows.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem" }}>Workflows</h4>
          {extraction.workflows.map((_, i) => renderWorkflow(i))}
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
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Unknown error");
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
