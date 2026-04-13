import { useState } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { api } from "../api/client";
import { useDndSensors } from "../hooks/useDndSensors";
import type { Extraction, ReviewDecision, WorkflowStep, ExtractedWorkflow } from "../types";

interface ReviewPanelProps {
  captureId: string;
  extraction: Extraction;
  onReviewComplete: () => void;
}

function SortableReviewStep({ id, index, step, isLast, onEditTitle }: {
  id: number;
  index: number;
  step: WorkflowStep;
  isLast: boolean;
  onEditTitle: (title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 py-1.5 ${!isLast ? "border-b border-zinc-100 dark:border-zinc-800" : ""} ${isDragging ? "opacity-50 bg-blue-50 dark:bg-blue-950/20" : ""}`}
      {...attributes}
    >
      <span {...listeners} className="cursor-grab text-zinc-300 dark:text-zinc-600 select-none touch-none" title="Drag to reorder">
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <span className="text-xs text-zinc-400 w-5 text-center">{index + 1}.</span>
      <input
        type="text"
        value={step.title}
        onChange={(e) => onEditTitle(e.target.value)}
        className="flex-1 border-0 border-b border-transparent bg-transparent text-sm text-zinc-900 dark:text-zinc-100 py-0.5 outline-none focus:border-b-violet-500"
      />
      {step.owner && <span className="text-xs text-zinc-400">{step.owner}</span>}
    </div>
  );
}

export default function ReviewPanel({ captureId, extraction, onReviewComplete }: ReviewPanelProps) {
  const [decisions, setDecisions] = useState<Record<string, "approve" | "reject">>({});
  const [workflowEdits, setWorkflowEdits] = useState<Record<number, ExtractedWorkflow>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggle = (key: string, action: "approve" | "reject") => {
    setDecisions((prev) => ({ ...prev, [key]: prev[key] === action ? undefined! : action }));
  };

  const getWorkflow = (index: number): ExtractedWorkflow => {
    return workflowEdits[index] || (extraction.workflows || [])[index];
  };

  const reviewSensors = useDndSensors();

  const handleStepDragEnd = (wfIndex: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const wf = getWorkflow(wfIndex);
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (oldIndex === newIndex) return;
    const steps = [...wf.steps];
    const [moved] = steps.splice(oldIndex, 1);
    steps.splice(newIndex, 0, moved);
    setWorkflowEdits((prev) => ({ ...prev, [wfIndex]: { ...wf, steps } }));
  };

  const editStepTitle = (wfIndex: number, stepIndex: number, title: string) => {
    const wf = { ...getWorkflow(wfIndex), steps: [...getWorkflow(wfIndex).steps] };
    wf.steps[stepIndex] = { ...wf.steps[stepIndex], title };
    setWorkflowEdits((prev) => ({ ...prev, [wfIndex]: wf }));
  };

  const handleSubmit = async () => {
    const items: ReviewDecision[] = [];
    for (const [key, action] of Object.entries(decisions)) {
      if (!action) continue;
      const [type, indexStr] = key.split("-");
      const index = parseInt(indexStr);
      if (type === "workflow" && action === "approve" && workflowEdits[index]) {
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
    (extraction.workflows || []).forEach((_, i) => (all[`workflow-${i}`] = "approve"));
    extraction.next_steps.forEach((_, i) => (all[`next_step-${i}`] = "approve"));
    extraction.follow_ups.forEach((_, i) => (all[`follow_up-${i}`] = "approve"));
    setDecisions(all);
  };

  const actionBtnCls = (active: boolean, color: "green" | "red") => {
    if (active) {
      return color === "green"
        ? "px-2 py-1 text-xs font-medium rounded bg-emerald-600 text-white border-0 cursor-pointer transition-colors"
        : "px-2 py-1 text-xs font-medium rounded bg-red-600 text-white border-0 cursor-pointer transition-colors";
    }
    return "px-2 py-1 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors";
  };

  const renderItem = (type: string, index: number, label: string, detail?: string) => {
    const key = `${type}-${index}`;
    const decision = decisions[key];

    return (
      <div key={key} className={`flex items-start gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 ${decision === "reject" ? "opacity-50" : ""}`}>
        <div className="flex-1 min-w-0">
          <strong className="text-sm text-zinc-900 dark:text-zinc-100">{label}</strong>
          {detail && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{detail}</div>}
        </div>
        <button onClick={() => toggle(key, "approve")} className={actionBtnCls(decision === "approve", "green")}>Approve</button>
        <button onClick={() => toggle(key, "reject")} className={actionBtnCls(decision === "reject", "red")}>Reject</button>
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
        className={`mb-3 p-3 rounded-lg border-2 transition-colors ${
          decision === "approve"
            ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
            : decision === "reject"
            ? "border-red-500 dark:border-red-600 opacity-50"
            : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <strong className="text-sm text-zinc-900 dark:text-zinc-100">{wf.name}</strong>
            {wf.description && <div className="text-xs text-zinc-500 dark:text-zinc-400">{wf.description}</div>}
            <div className="text-xs text-zinc-400">{wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => toggle(key, "approve")} className={actionBtnCls(decision === "approve", "green")}>Approve</button>
            <button onClick={() => toggle(key, "reject")} className={actionBtnCls(decision === "reject", "red")}>Reject</button>
          </div>
        </div>

        <div className="ml-2">
          <DndContext sensors={reviewSensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd(wfIndex)}>
            <SortableContext items={wf.steps.map((_: WorkflowStep, i: number) => i)} strategy={verticalListSortingStrategy}>
              {wf.steps.map((step: WorkflowStep, si: number) => (
                <SortableReviewStep
                  key={si}
                  id={si}
                  index={si}
                  step={step}
                  isLast={si === wf.steps.length - 1}
                  onEditTitle={(title) => editStepTitle(wfIndex, si, title)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    );
  };

  const workflows = extraction.workflows || [];
  const hasItems = extraction.tasks.length > 0 || workflows.length > 0 || extraction.next_steps.length > 0 || extraction.follow_ups.length > 0;

  return (
    <div>
      {extraction.summary && (
        <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
          <strong className="text-sm text-zinc-900 dark:text-zinc-100">Summary:</strong>{" "}
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{extraction.summary}</span>
        </div>
      )}

      {extraction.blockers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Blockers</h4>
          {extraction.blockers.map((b, i) => (
            <div key={i} className="text-sm text-red-600 dark:text-red-400 py-1">{b}</div>
          ))}
        </div>
      )}

      {workflows.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Workflows</h4>
          {workflows.map((_, i) => renderWorkflow(i))}
        </div>
      )}

      {extraction.tasks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Tasks</h4>
          {extraction.tasks.map((t, i) =>
            renderItem("task", i, t.title, [t.owner && `Owner: ${t.owner}`, t.due_date && `Due: ${t.due_date}`, t.priority && t.priority !== "none" && `Priority: ${t.priority}`].filter(Boolean).join(" | "))
          )}
        </div>
      )}

      {extraction.next_steps.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Next Steps</h4>
          {extraction.next_steps.map((s, i) => renderItem("next_step", i, s))}
        </div>
      )}

      {extraction.follow_ups.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Follow-ups</h4>
          {extraction.follow_ups.map((f, i) =>
            renderItem("follow_up", i, f.description, f.owner ? `Owner: ${f.owner}` : undefined)
          )}
        </div>
      )}

      {hasItems ? (
        <div className="flex gap-2 mt-4">
          <button onClick={approveAll} className="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-0 cursor-pointer transition-colors">
            Approve All
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(decisions).length === 0}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed border-0 cursor-pointer transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-zinc-400 mb-2">No actionable items extracted. You can mark this capture as reviewed.</p>
          <button
            onClick={async () => {
              setSubmitting(true);
              setError("");
              try {
                await api(`/captures/${captureId}/review`, {
                  method: "PATCH",
                  body: JSON.stringify({ decisions: [{ item_type: "summary", item_index: 0, action: "approve" }] }),
                });
                onReviewComplete();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Unknown error");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-zinc-300 disabled:cursor-not-allowed border-0 cursor-pointer transition-colors"
          >
            {submitting ? "Marking..." : "Mark as Reviewed"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
    </div>
  );
}
