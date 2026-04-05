import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../api/client";
import TaskDetailModal from "../components/TaskDetailModal";

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
  blocked_by_workflow_id: string | null;
  blocked_by_workflow_name: string | null;
  blocked_by_task_id: string | null;
  blocked_by_task_title: string | null;
  is_blocked: boolean;
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

function SortableStep({ step, index, onToggle, onSelect, isLocked }: { step: WorkflowTask; index: number; onToggle: () => void; onSelect: () => void; isLocked?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.35rem 0",
    borderBottom: "1px solid #f3f4f6",
    opacity: isDragging ? 0.5 : isLocked ? 0.45 : step.status === "completed" ? 0.6 : 1,
    background: isDragging ? "#f0f4ff" : "transparent",
    cursor: "default",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* Drag handle */}
      <span
        {...listeners}
        style={{ cursor: "grab", color: "#d1d5db", fontSize: "0.85rem", padding: "0 0.15rem", userSelect: "none", touchAction: "none" }}
        title="Drag to reorder"
      >
        &#x2807;
      </span>
      {/* Circle — locked or normal */}
      <button
        onClick={() => !isLocked && onToggle()}
        disabled={isLocked}
        style={{
          width: 18, height: 18, borderRadius: "50%",
          border: `2px solid ${isLocked ? "#e5e7eb" : step.status === "completed" ? "#d1d5db" : "#d1d5db"}`,
          background: step.status === "completed" ? "#d1d5db" : "transparent",
          cursor: isLocked ? "default" : "pointer", flexShrink: 0, padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {isLocked ? (
          <span style={{ fontSize: "0.5rem", color: "#bbb" }}>{"\u{1F512}"}</span>
        ) : step.status === "completed" ? (
          <span style={{ color: "white", fontSize: "0.55rem" }}>{"\u2713"}</span>
        ) : null}
      </button>
      <span style={{ color: "#aaa", fontSize: "0.75rem", width: "1.2rem", textAlign: "center", flexShrink: 0 }}>{index + 1}.</span>
      <span
        onClick={onSelect}
        style={{
          flex: 1,
          textDecoration: step.status === "completed" ? "line-through" : "none",
          color: step.status === "completed" ? "#999" : "#1a1a1a",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        {step.title}
      </span>
      {step.owner && <span style={{ color: "#888", fontSize: "0.72rem" }}>{step.owner}</span>}
    </div>
  );
}

export default function Tasks() {
  const [standaloneTasks, setStandaloneTasks] = useState<Task[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [completedWorkflows, setCompletedWorkflows] = useState<Workflow[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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

  const reorderSteps = async (workflowId: string, taskIds: string[]) => {
    try {
      await api(`/workflows/${workflowId}/reorder`, {
        method: "POST",
        body: JSON.stringify({ task_ids: taskIds }),
      });
      loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (wf: Workflow) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = wf.tasks.findIndex((t) => t.id === active.id);
    const newIndex = wf.tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...wf.tasks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    reorderSteps(wf.id, reordered.map((t) => t.id));
  };

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

  const priorityCircleColor: Record<string, string> = {
    high: "#dc2626",
    medium: "#f59e0b",
    low: "#3b82f6",
    none: "#d1d5db",
  };

  const renderTask = (task: Task) => {
    const circleColor = priorityCircleColor[task.priority] || "#d1d5db";
    const isCompleted = task.status === "completed";

    return (
      <div
        key={task.id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "0.75rem 0",
          borderBottom: "1px solid #f0f0f0",
          opacity: task.is_blocked ? 0.55 : 1,
        }}
      >
        {/* Priority-colored circle (or lock if blocked) */}
        <button
          onClick={() => !task.is_blocked && toggleTaskStatus(task)}
          disabled={task.is_blocked}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: `2px solid ${task.is_blocked ? "#e5e7eb" : circleColor}`,
            background: isCompleted ? circleColor : "transparent",
            cursor: "pointer",
            flexShrink: 0,
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {task.is_blocked ? (
            <span style={{ fontSize: "0.6rem", color: "#999" }}>{"\u{1F512}"}</span>
          ) : isCompleted ? (
            <span style={{ color: "white", fontSize: "0.65rem", lineHeight: 1 }}>{"\u2713"}</span>
          ) : null}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div
            onClick={() => setSelectedTaskId(task.id)}
            style={{
              fontWeight: 500,
              fontSize: "0.95rem",
              cursor: "pointer",
              textDecoration: isCompleted ? "line-through" : "none",
              color: isCompleted ? "#999" : "#1a1a1a",
            }}
          >
            {task.title}
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ color: "#888", fontSize: "0.82rem", marginTop: "0.15rem" }}>{task.description}</div>
          )}

          {/* Inline metadata row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.3rem", fontSize: "0.78rem", color: "#7c3aed", flexWrap: "wrap" }}>
            {task.owner && (
              <span style={{ color: "#888" }}>{task.owner}</span>
            )}
            {task.due_date && (
              <span>{"\u{1F4C5}"} {task.due_date}</span>
            )}
            {task.capture_id && (
              <Link to={`/captures/${task.capture_id}`} style={{ color: "#7c3aed", textDecoration: "none" }}>
                {"\u{1F517}"} source
              </Link>
            )}
          </div>

          {/* Labels */}
          {/* Tags row */}
          {(task.workflow_name || task.is_blocked) && (
            <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.3rem", flexWrap: "wrap", alignItems: "center" }}>
              {task.workflow_name && (
                <span style={{
                  background: "#f3f0ff", color: "#7c3aed",
                  padding: "0.1rem 0.45rem", borderRadius: "4px", fontSize: "0.72rem",
                }}>
                  {task.workflow_name}
                </span>
              )}
              {task.is_blocked && (
                <span style={{
                  background: "#fef2f2", color: "#dc2626",
                  padding: "0.1rem 0.45rem", borderRadius: "4px", fontSize: "0.72rem",
                }}>
                  {"\u{1F512}"} Blocked by: {task.blocked_by_workflow_name || task.blocked_by_task_title || "dependency"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <span
          onClick={() => setSelectedTaskId(task.id)}
          style={{ color: "#ccc", cursor: "pointer", fontSize: "0.9rem", padding: "0.2rem", flexShrink: 0 }}
        >
          {"\u203A"}
        </span>
      </div>
    );
  };

  const renderWorkflow = (wf: Workflow) => {
    const completedCount = wf.tasks.filter((t) => t.status === "completed").length;
    const totalCount = wf.tasks.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
      <div
        key={wf.id}
        style={{
          marginBottom: "1rem",
          border: "1px solid #eee",
          borderRadius: "8px",
          padding: "0.85rem",
          opacity: wf.status === "completed" ? 0.6 : 1,
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1a1a1a" }}>{wf.name}</div>
            {wf.description && <div style={{ color: "#888", fontSize: "0.82rem", marginTop: "0.1rem" }}>{wf.description}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0, marginLeft: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#7c3aed" }}>{"\u{1F517}"} {completedCount}/{totalCount}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "#e5e7eb", borderRadius: 2, marginBottom: "0.6rem" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: progress === 100 ? "#22c55e" : "#7c3aed",
              borderRadius: 2,
              transition: "width 0.3s",
            }}
          />
        </div>

        {/* Steps — drag to reorder */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(wf)}>
          <SortableContext items={wf.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {wf.tasks.map((step, si) => {
              // A step is locked if any prior step is not completed
              const priorSteps = wf.tasks.slice(0, si);
              const isLocked = priorSteps.length > 0 && priorSteps.some((s) => s.status !== "completed");

              return (
                <SortableStep
                  key={step.id}
                  step={step}
                  index={si}
                  onToggle={() => toggleTaskStatus(step)}
                  onSelect={() => setSelectedTaskId(step.id)}
                  isLocked={isLocked}
                />
              );
            })}
          </SortableContext>
        </DndContext>

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

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => {
            loadAll();
            if (showCompleted) loadCompleted();
          }}
        />
      )}
    </div>
  );
}
