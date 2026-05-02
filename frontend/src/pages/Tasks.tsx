import { useEffect, useState, useCallback, memo, useRef } from "react";
import { Link } from "react-router-dom";
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
import {
  GripVertical, Lock, Check, ChevronRight, Calendar,
  Link2, Unlock, Trash2, Pencil, Plus, X,
} from "lucide-react";
import { api } from "../api/client";
import TaskDetailModal from "../components/TaskDetailModal";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectPicker from "../components/ProjectPicker";
import { useDndSensors } from "../hooks/useDndSensors";
import { PRIORITY_COLORS } from "../constants";
import type {
  Task, TaskList, WorkflowTask, Workflow, WorkflowList, Project, ProjectList,
} from "../types";

// ---------------------------------------------------------------------------
// SortableStep — drag-handle row inside a workflow
// ---------------------------------------------------------------------------

const SortableStep = memo(function SortableStep({
  step, index, onToggle, onSelect, isLocked, showDivider, onToggleSubtask,
}: {
  step: WorkflowTask;
  index: number;
  onToggle: () => void;
  onSelect: () => void;
  isLocked?: boolean;
  showDivider?: boolean;
  onToggleSubtask?: (subtaskIndex: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  return (
    <>
      {showDivider && (
        <div className="flex items-center gap-2 py-1.5 my-0.5">
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-[10px] text-zinc-400 whitespace-nowrap flex items-center gap-1">
            <Unlock className="w-2.5 h-2.5" /> unlocks after above
          </span>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        </div>
      )}
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`flex items-center gap-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 ${
          isDragging ? "opacity-50 bg-blue-50 dark:bg-blue-950/20" : ""
        } ${isLocked ? "opacity-45" : step.status === "completed" ? "opacity-60" : ""}`}
        {...attributes}
      >
        <span {...listeners} className="cursor-grab text-zinc-300 dark:text-zinc-600 select-none touch-none" title="Drag to reorder">
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <button
          onClick={() => !isLocked && onToggle()}
          disabled={isLocked}
          className="w-4.5 h-4.5 rounded-full border-2 border-zinc-300 dark:border-zinc-600 shrink-0 p-0 flex items-center justify-center cursor-pointer disabled:cursor-default bg-transparent"
          style={{ background: step.status === "completed" ? "#d1d5db" : "transparent" }}
        >
          {isLocked ? (
            <Lock className="w-2 h-2 text-zinc-400" />
          ) : step.status === "completed" ? (
            <Check className="w-2.5 h-2.5 text-white" />
          ) : null}
        </button>
        <span className="text-xs text-zinc-400 w-4 text-center shrink-0">{index + 1}.</span>
        <span
          onClick={onSelect}
          className={`flex-1 text-sm cursor-pointer ${
            step.status === "completed" ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {step.title}
        </span>
        {step.owner && <span className="text-xs text-zinc-400">{step.owner}</span>}
      </div>
      {step.sub_tasks && step.sub_tasks.length > 0 && !isLocked && (
        <div className="ml-14 py-1">
          {step.sub_tasks.map((st, sti) => (
            <div key={sti} className="flex items-center gap-1.5 py-0.5 text-xs">
              <input
                type="checkbox"
                checked={st.completed}
                onChange={() => onToggleSubtask?.(sti)}
                className="w-3.5 h-3.5"
              />
              <span className={st.completed ? "line-through text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}>
                {st.title}
              </span>
            </div>
          ))}
          <div className="text-[10px] text-zinc-400 mt-0.5">
            {step.sub_tasks.filter((s) => s.completed).length}/{step.sub_tasks.length} done
          </div>
        </div>
      )}
    </>
  );
});

// ---------------------------------------------------------------------------
// TaskRow — a standalone (non-workflow) task row
// ---------------------------------------------------------------------------

const TaskRow = memo(function TaskRow({
  task,
  projects,
  onToggle,
  onSelect,
  onRequestDelete,
  onAssign,
}: {
  task: Task;
  projects: Project[];
  onToggle: (task: Task) => void;
  onSelect: (id: string) => void;
  onRequestDelete: (id: string, title: string) => void;
  onAssign: (itemId: string, currentProjectId: string | null, newProjectId: string | null) => void;
}) {
  const circleColor = PRIORITY_COLORS[task.priority] || "#d1d5db";
  const isCompleted = task.status === "completed";

  return (
    <div
      className={`flex items-start gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 ${task.is_blocked ? "opacity-55" : ""}`}
    >
      <button
        onClick={() => !task.is_blocked && onToggle(task)}
        disabled={task.is_blocked}
        className="w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 p-0 flex items-center justify-center cursor-pointer disabled:cursor-default bg-transparent"
        style={{
          borderColor: task.is_blocked ? "#e5e7eb" : circleColor,
          background: isCompleted ? circleColor : "transparent",
        }}
      >
        {task.is_blocked ? (
          <Lock className="w-2.5 h-2.5 text-zinc-400" />
        ) : isCompleted ? (
          <Check className="w-2.5 h-2.5 text-white" />
        ) : null}
      </button>

      <div className="flex-1 min-w-0">
        <div
          onClick={() => onSelect(task.id)}
          className={`text-sm font-medium cursor-pointer ${
            isCompleted ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {task.title}
        </div>
        {task.description && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{task.description}</div>
        )}
        <div className="flex items-center gap-2.5 mt-1 text-xs flex-wrap">
          {task.owner && <span className="text-zinc-400">{task.owner}</span>}
          {task.due_date && (
            <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
              <Calendar className="w-3 h-3" /> {task.due_date}
            </span>
          )}
          {task.capture_id && (
            <Link
              to={`/captures/${task.capture_id}`}
              className="flex items-center gap-1 text-violet-600 dark:text-violet-400 no-underline hover:underline"
            >
              <Link2 className="w-3 h-3" /> source
            </Link>
          )}
        </div>
        {(task.workflow_name || task.is_blocked) && (
          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
            {task.workflow_name && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                {task.workflow_name}
              </span>
            )}
            {task.is_blocked && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                <Lock className="w-2.5 h-2.5" /> Blocked by: {task.blocked_by_workflow_name || task.blocked_by_task_title || "dependency"}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 mt-1">
        <button
          onClick={() => onRequestDelete(task.id, task.title)}
          className="p-0 border-0 bg-transparent cursor-pointer text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <ProjectPicker
          projects={projects}
          currentProjectId={task.project_id}
          onAssign={(newId) => onAssign(task.id, task.project_id, newId)}
        />
        <button
          onClick={() => onSelect(task.id)}
          className="p-0 border-0 bg-transparent cursor-pointer text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// WorkflowCard — a workflow with its steps, edit mode, and project picker
// ---------------------------------------------------------------------------

type DraftStep = WorkflowTask & { isNew?: boolean };

const WorkflowCard = memo(function WorkflowCard({
  wf,
  projects,
  sensors,
  onToggleTask,
  onSelectTask,
  onToggleSubtask,
  onRequestDeleteWorkflow,
  onReorder,
  onRefresh,
  onAssign,
}: {
  wf: Workflow;
  projects: Project[];
  sensors: ReturnType<typeof useDndSensors>;
  onToggleTask: (task: WorkflowTask) => void;
  onSelectTask: (id: string) => void;
  onToggleSubtask: (taskId: string, index: number) => void;
  onRequestDeleteWorkflow: (id: string, name: string) => void;
  onReorder: (wfId: string, taskIds: string[]) => void;
  onRefresh: () => void;
  onAssign: (itemId: string, currentProjectId: string | null, newProjectId: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([]);
  const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);
  const [newStepInput, setNewStepInput] = useState("");
  const [saveError, setSaveError] = useState("");

  const completedCount = wf.tasks.filter((t) => t.status === "completed").length;
  const totalCount = wf.tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const enterEdit = () => {
    setIsEditing(true);
    setDraftSteps([...wf.tasks]);
    setDeletedStepIds([]);
    setNewStepInput("");
    setSaveError("");
  };

  const exitEdit = () => {
    setIsEditing(false);
    setDraftSteps([]);
    setDeletedStepIds([]);
    setNewStepInput("");
    setSaveError("");
  };

  const addStep = () => {
    const title = newStepInput.trim();
    if (!title) return;
    setDraftSteps((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, title, description: null, owner: null, status: "open", priority: "none", workflow_order: prev.length, isNew: true },
    ]);
    setNewStepInput("");
  };

  const removeStep = (step: DraftStep) => {
    if (!step.isNew) setDeletedStepIds((prev) => [...prev, step.id]);
    setDraftSteps((prev) => prev.filter((s) => s.id !== step.id));
  };

  const saveEdits = async () => {
    try {
      for (const id of deletedStepIds) {
        await api(`/tasks/${id}`, { method: "DELETE" });
      }
      for (const step of draftSteps) {
        if (step.isNew) continue;
        const original = wf.tasks.find((t) => t.id === step.id);
        if (original && original.title !== step.title && step.title.trim()) {
          await api(`/tasks/${step.id}`, {
            method: "PATCH",
            body: JSON.stringify({ title: step.title.trim() }),
          });
        }
      }
      for (const step of draftSteps) {
        if (!step.isNew || !step.title.trim()) continue;
        await api(`/workflows/${wf.id}/steps`, {
          method: "POST",
          body: JSON.stringify({ title: step.title.trim() }),
        });
      }
      exitEdit();
      onRefresh();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = wf.tasks.findIndex((t) => t.id === active.id);
    const newIndex = wf.tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...wf.tasks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(wf.id, reordered.map((t) => t.id));
  };

  return (
    <div
      className={`mb-3 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/50 ${
        wf.status === "completed" ? "opacity-60" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{wf.name}</div>
          {wf.description && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{wf.description}</div>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isEditing ? (
            <>
              <button
                onClick={exitEdit}
                className="px-2 py-0.5 text-xs rounded border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-transparent cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdits}
                className="px-2 py-0.5 text-xs rounded bg-violet-600 hover:bg-violet-700 text-white border-0 cursor-pointer transition-colors"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                <Link2 className="w-3 h-3" /> {completedCount}/{totalCount}
              </span>
              <ProjectPicker
                projects={projects}
                currentProjectId={wf.project_id}
                onAssign={(newId) => onAssign(wf.id, wf.project_id, newId)}
              />
              <button
                onClick={enterEdit}
                className="p-0 border-0 bg-transparent cursor-pointer text-zinc-300 dark:text-zinc-600 hover:text-violet-500 transition-colors"
                title="Edit workflow"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRequestDeleteWorkflow(wf.id, wf.name)}
                className="p-0 border-0 bg-transparent cursor-pointer text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors"
                title="Delete workflow"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{saveError}</p>}

      {/* Progress bar */}
      {!isEditing && (
        <div className="h-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? "bg-emerald-500" : "bg-violet-600"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Edit mode */}
      {isEditing ? (
        <div className="mt-1">
          {draftSteps.map((step, si) => (
            <div key={step.id} className="flex items-center gap-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs text-zinc-400 w-5 text-right shrink-0">{si + 1}.</span>
              <input
                type="text"
                value={step.title}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, title: val } : s));
                }}
                className="flex-1 text-sm bg-transparent border-0 border-b border-zinc-300 dark:border-zinc-600 focus:border-violet-500 focus:outline-none text-zinc-900 dark:text-zinc-100 py-0.5"
              />
              <button
                onClick={() => removeStep(step)}
                className="p-0 bg-transparent border-0 cursor-pointer text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <Plus className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={newStepInput}
              onChange={(e) => setNewStepInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addStep(); }}
              placeholder="Add a step…"
              className="flex-1 text-sm bg-transparent border-0 border-b border-zinc-200 dark:border-zinc-700 focus:border-violet-500 focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-0.5"
            />
            <button
              onClick={addStep}
              className="text-xs text-violet-600 dark:text-violet-400 bg-transparent border-0 cursor-pointer hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        /* View mode with drag-and-drop */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={wf.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {wf.tasks.map((step, si) => {
              const priorSteps = wf.tasks.slice(0, si);
              const isLocked = priorSteps.length > 0 && priorSteps.some((s) => s.status !== "completed");
              const isDependentStep = (step as WorkflowTask & { depends_on_prior?: boolean }).depends_on_prior === true;

              return (
                <SortableStep
                  key={step.id}
                  step={step}
                  index={si}
                  onToggle={() => onToggleTask(step)}
                  onSelect={() => onSelectTask(step.id)}
                  isLocked={isLocked}
                  showDivider={isDependentStep}
                  onToggleSubtask={(idx) => onToggleSubtask(step.id, idx)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {wf.capture_id && !isEditing && (
        <div className="mt-2 text-xs">
          <Link to={`/captures/${wf.capture_id}`} className="text-violet-600 dark:text-violet-400 no-underline hover:underline">
            View capture
          </Link>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Tasks page
// ---------------------------------------------------------------------------

export default function Tasks() {
  const [standaloneTasks, setStandaloneTasks] = useState<Task[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [completedWorkflows, setCompletedWorkflows] = useState<Workflow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [confirmDeleteWorkflow, setConfirmDeleteWorkflow] = useState<{ id: string; name: string } | null>(null);

  const showCompletedRef = useRef(showCompleted);
  useEffect(() => { showCompletedRef.current = showCompleted; }, [showCompleted]);

  const loadCompleted = useCallback(() => {
    Promise.all([
      api<TaskList>("/tasks?status=completed"),
      api<WorkflowList>("/workflows?status=completed"),
    ])
      .then(([taskData, wfData]) => {
        setCompletedTasks(taskData.items.filter((t) => !t.workflow_id));
        setCompletedWorkflows(wfData.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load completed items"));
  }, []);

  const loadAll = useCallback(() => {
    Promise.all([
      api<TaskList>("/tasks?status=open"),
      api<WorkflowList>("/workflows?status=open"),
      api<ProjectList>("/projects"),
    ])
      .then(([taskData, wfData, projData]) => {
        setStandaloneTasks(taskData.items.filter((t) => !t.workflow_id));
        setWorkflows(wfData.items);
        setProjects(projData.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const completedFetchedRef = useRef(false);
  useEffect(() => {
    if (showCompleted && !completedFetchedRef.current) {
      completedFetchedRef.current = true;
      loadCompleted();
    }
  }, [showCompleted, loadCompleted]);

  // Refresh open + completed lists (used by WorkflowCard after edits)
  const handleRefresh = useCallback(() => {
    loadAll();
    if (showCompletedRef.current) loadCompleted();
  }, [loadAll, loadCompleted]);

  const sensors = useDndSensors();

  const reorderSteps = useCallback(async (workflowId: string, taskIds: string[]) => {
    try {
      await api(`/workflows/${workflowId}/reorder`, {
        method: "POST",
        body: JSON.stringify({ task_ids: taskIds }),
      });
      loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    }
  }, [loadAll]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskIndex: number) => {
    try {
      await api(`/tasks/${taskId}/subtasks/${subtaskIndex}/toggle`, { method: "POST" });
      handleRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update subtask");
    }
  }, [handleRefresh]);

  const toggleTaskStatus = useCallback(async (task: Task | WorkflowTask) => {
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: task.status === "open" ? "completed" : "open" }),
      });
      handleRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  }, [handleRefresh]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await api(`/tasks/${id}`, { method: "DELETE" });
      handleRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete task");
    }
  }, [handleRefresh]);

  const deleteWorkflow = useCallback(async (id: string) => {
    try {
      await api(`/workflows/${id}`, { method: "DELETE" });
      handleRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete workflow");
    }
  }, [handleRefresh]);

  const assignItem = useCallback(async (
    type: "workflow" | "task",
    itemId: string,
    currentProjectId: string | null,
    newProjectId: string | null,
  ) => {
    const path = type === "workflow" ? "workflows" : "tasks";
    if (newProjectId === null && currentProjectId) {
      await api(`/projects/${currentProjectId}/${path}/${itemId}`, { method: "DELETE" });
    } else if (newProjectId) {
      await api(`/projects/${newProjectId}/${path}/${itemId}`, { method: "POST" });
    }
    // Optimistic local update
    if (type === "workflow") {
      setWorkflows((prev) => prev.map((w) => w.id === itemId ? { ...w, project_id: newProjectId } : w));
    } else {
      setStandaloneTasks((prev) => prev.map((t) => t.id === itemId ? { ...t, project_id: newProjectId } : t));
    }
  }, []);

  const completedCount = completedTasks.length + completedWorkflows.length;

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Tasks</h2>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading...</p>
      ) : workflows.length === 0 && standaloneTasks.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No open tasks. Capture content and approve extracted items to create tasks.
        </p>
      ) : (
        <>
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              wf={wf}
              projects={projects}
              sensors={sensors}
              onToggleTask={toggleTaskStatus}
              onSelectTask={setSelectedTaskId}
              onToggleSubtask={toggleSubtask}
              onRequestDeleteWorkflow={(id, name) => setConfirmDeleteWorkflow({ id, name })}
              onReorder={reorderSteps}
              onRefresh={handleRefresh}
              onAssign={(itemId, curr, next) => assignItem("workflow", itemId, curr, next)}
            />
          ))}
          {standaloneTasks.length > 0 && workflows.length > 0 && (
            <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mt-6 mb-2">
              Standalone Tasks
            </h4>
          )}
          {standaloneTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projects={projects}
              onToggle={toggleTaskStatus}
              onSelect={setSelectedTaskId}
              onRequestDelete={(id, title) => setConfirmDelete({ id, title })}
              onAssign={(itemId, curr, next) => assignItem("task", itemId, curr, next)}
            />
          ))}
        </>
      )}

      {/* Completed section */}
      <div className="mt-8">
        <button
          onClick={() => setShowCompleted((prev) => !prev)}
          className="flex items-center gap-2 py-2 bg-transparent border-0 cursor-pointer text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${showCompleted ? "rotate-90" : ""}`} />
          Completed
          {completedCount > 0 && ` (${completedCount})`}
        </button>

        {showCompleted && (
          <div className="ml-1">
            {completedCount === 0 ? (
              <p className="text-xs text-zinc-400 ml-5">No completed items yet.</p>
            ) : (
              <>
                {completedWorkflows.map((wf) => (
                  <WorkflowCard
                    key={wf.id}
                    wf={wf}
                    projects={projects}
                    sensors={sensors}
                    onToggleTask={toggleTaskStatus}
                    onSelectTask={setSelectedTaskId}
                    onToggleSubtask={toggleSubtask}
                    onRequestDeleteWorkflow={(id, name) => setConfirmDeleteWorkflow({ id, name })}
                    onReorder={reorderSteps}
                    onRefresh={handleRefresh}
                    onAssign={(itemId, curr, next) => assignItem("workflow", itemId, curr, next)}
                  />
                ))}
                {completedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projects={projects}
                    onToggle={toggleTaskStatus}
                    onSelect={setSelectedTaskId}
                    onRequestDelete={(id, title) => setConfirmDelete({ id, title })}
                    onAssign={(itemId, curr, next) => assignItem("task", itemId, curr, next)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleRefresh}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete task"
        description={`Permanently delete "${confirmDelete?.title || ""}"? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) { deleteTask(confirmDelete.id); setConfirmDelete(null); }
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmDeleteWorkflow}
        title="Delete workflow"
        description={`Permanently delete "${confirmDeleteWorkflow?.name || ""}" and all its steps? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDeleteWorkflow) { deleteWorkflow(confirmDeleteWorkflow.id); setConfirmDeleteWorkflow(null); }
        }}
        onCancel={() => setConfirmDeleteWorkflow(null)}
      />
    </div>
  );
}
