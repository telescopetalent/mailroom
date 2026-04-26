import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FolderOpen, Calendar, Flag, User, Tag, Bell, MapPin, Lock, GitBranch } from "lucide-react";
import { api } from "../api/client";
import { PRIORITY_COLORS } from "../constants";
import type { TaskDetail } from "../types";

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const metaRowCls = "flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors";
const metaIconCls = "w-4 h-4 text-zinc-400 shrink-0";
const metaLabelCls = "w-20 text-sm text-zinc-500 dark:text-zinc-400 shrink-0";
const metaValueCls = "flex-1 text-sm text-zinc-900 dark:text-zinc-100";
const editInputCls = "w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent";

export default function TaskDetailModal({ taskId, onClose, onUpdate }: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [availableWorkflows, setAvailableWorkflows] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<TaskDetail>(`/tasks/${taskId}`),
      api<{ items: { id: string; name: string; status: string }[] }>("/workflows"),
    ])
      .then(([taskData, wfData]) => {
        if (cancelled) return;
        setTask(taskData);
        setAvailableWorkflows(wfData.items.filter((w) => w.status === "open"));
      })
      .catch(() => { if (!cancelled) onClose(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const saveField = useCallback(async (field: string, value: unknown) => {
    if (!task) return;
    try {
      const updated = await api<TaskDetail>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      setTask(updated);
      onUpdate();
    } catch {
      // field reverts on next fetch
    }
    setEditingField(null);
  }, [task, onUpdate]);

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

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-50 animate-slide-in-right outline-none overflow-y-auto">
          {loading || !task ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm text-zinc-400">Loading...</span>
            </div>
          ) : (
            <div className="p-5">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <Dialog.Close asChild>
                  <button className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors bg-transparent border-0 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </Dialog.Close>
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">
                  {task.status === "completed" ? "Completed" : "Open"}
                </span>
              </div>

              {/* Title + Status */}
              <div className="flex items-start gap-3 mb-3">
                <button
                  onClick={toggleStatus}
                  className="w-6 h-6 rounded-full border-2 shrink-0 mt-0.5 p-0 flex items-center justify-center cursor-pointer bg-transparent text-white text-xs"
                  style={{
                    borderColor: PRIORITY_COLORS[task.priority] || "#d1d5db",
                    background: task.status === "completed" ? PRIORITY_COLORS[task.priority] || "#d1d5db" : "transparent",
                  }}
                >
                  {task.status === "completed" ? "\u2713" : ""}
                </button>
                <div className="flex-1">
                  {editingField === "title" ? (
                    <input
                      autoFocus
                      defaultValue={task.title}
                      onBlur={(e) => saveField("title", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={editInputCls + " text-lg font-bold"}
                    />
                  ) : (
                    <h3
                      onClick={() => setEditingField("title")}
                      className={`m-0 text-lg font-bold cursor-pointer text-zinc-900 dark:text-zinc-100 ${
                        task.status === "completed" ? "line-through opacity-60" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="mb-4 ml-9">
                {editingField === "description" ? (
                  <textarea
                    autoFocus
                    defaultValue={task.description || ""}
                    onBlur={(e) => saveField("description", e.target.value || null)}
                    rows={2}
                    className={editInputCls + " resize-y"}
                  />
                ) : (
                  <div
                    onClick={() => setEditingField("description")}
                    className={`text-sm cursor-pointer min-h-[1.5rem] ${task.description ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}`}
                  >
                    {task.description || "Add description..."}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 my-3" />

              {/* Metadata rows */}
              <div className="flex flex-col gap-0.5">
                {/* Source */}
                <div className={metaRowCls}>
                  <FolderOpen className={metaIconCls} />
                  <span className={metaLabelCls}>Source</span>
                  <span className={metaValueCls}>{task.source}</span>
                </div>

                {/* Due date */}
                <div className={metaRowCls}>
                  <Calendar className={metaIconCls} />
                  <span className={metaLabelCls}>Due</span>
                  <input
                    type="date"
                    value={task.due_date || ""}
                    onChange={(e) => saveField("due_date", e.target.value || null)}
                    className="flex-1 text-sm bg-transparent border-0 outline-none cursor-pointer text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Priority */}
                <div className={metaRowCls}>
                  <Flag className={metaIconCls} style={{ color: PRIORITY_COLORS[task.priority] }} />
                  <span className={metaLabelCls}>Priority</span>
                  <select
                    value={task.priority}
                    onChange={(e) => saveField("priority", e.target.value)}
                    className="flex-1 text-sm bg-transparent border-0 outline-none cursor-pointer text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                {/* Owner */}
                <div className={metaRowCls}>
                  <User className={metaIconCls} />
                  <span className={metaLabelCls}>Owner</span>
                  {editingField === "owner" ? (
                    <input
                      autoFocus
                      defaultValue={task.owner || ""}
                      onBlur={(e) => saveField("owner", e.target.value || null)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={editInputCls + " flex-1"}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingField("owner")}
                      className={`flex-1 text-sm cursor-pointer ${task.owner ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}
                    >
                      {task.owner || "Assign..."}
                    </span>
                  )}
                </div>

                {/* Labels */}
                <div className={metaRowCls}>
                  <Tag className={metaIconCls} />
                  <span className={metaLabelCls}>Labels</span>
                  <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                    {task.labels.map((label) => (
                      <span
                        key={label}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                      >
                        {label}
                        <button
                          onClick={() => removeLabel(label)}
                          className="p-0 bg-transparent border-0 cursor-pointer text-zinc-400 hover:text-red-500 text-[10px]"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    <input
                      placeholder="Add label..."
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }}
                      onBlur={() => { if (labelInput.trim()) addLabel(); }}
                      className="border-0 outline-none text-xs w-20 py-0.5 bg-transparent text-zinc-400 placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                {/* Reminder */}
                <div className={metaRowCls}>
                  <Bell className={metaIconCls} />
                  <span className={metaLabelCls}>Reminder</span>
                  <input
                    type="datetime-local"
                    value={task.reminder ? task.reminder.slice(0, 16) : ""}
                    onChange={(e) => saveField("reminder", e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="flex-1 text-sm bg-transparent border-0 outline-none cursor-pointer text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Location */}
                <div className={metaRowCls}>
                  <MapPin className={metaIconCls} />
                  <span className={metaLabelCls}>Location</span>
                  {editingField === "location" ? (
                    <input
                      autoFocus
                      defaultValue={task.location || ""}
                      onBlur={(e) => saveField("location", e.target.value || null)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={editInputCls + " flex-1"}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingField("location")}
                      className={`flex-1 text-sm cursor-pointer ${task.location ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}
                    >
                      {task.location || "Add location..."}
                    </span>
                  )}
                </div>
              </div>

              {/* Blocked by */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 my-3" />
              <div className={metaRowCls}>
                <Lock className={metaIconCls} />
                <span className={metaLabelCls}>Blocked by</span>
                <div className="flex-1">
                  {task.blocked_by_workflow_name || task.blocked_by_task_title ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        task.is_blocked
                          ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                          : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {task.blocked_by_workflow_name || task.blocked_by_task_title}
                      </span>
                      {!task.is_blocked && <span className="text-xs text-zinc-400">completed</span>}
                      <button
                        onClick={() => saveField("blocked_by_workflow_id", "00000000-0000-0000-0000-000000000000")}
                        className="text-xs text-zinc-400 hover:text-red-500 bg-transparent border-0 cursor-pointer transition-colors"
                      >
                        remove
                      </button>
                    </div>
                  ) : availableWorkflows.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) saveField("blocked_by_workflow_id", e.target.value); }}
                      className="text-sm bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 outline-none cursor-pointer text-zinc-500 dark:text-zinc-400"
                    >
                      <option value="">Add dependency...</option>
                      {availableWorkflows.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-zinc-400">None</span>
                  )}
                </div>
              </div>

              {/* Workflow info */}
              {task.workflow_name && (
                <>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 my-3" />
                  <div className={metaRowCls}>
                    <GitBranch className={metaIconCls} />
                    <span className={metaLabelCls}>Workflow</span>
                    <span className={metaValueCls}>{task.workflow_name}</span>
                  </div>
                </>
              )}

              <div className="border-t border-zinc-100 dark:border-zinc-800 my-3" />

              {/* Notes */}
              <div className="mb-4">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Notes</div>
                <textarea
                  value={task.notes || ""}
                  onChange={(e) => setTask({ ...task, notes: e.target.value })}
                  onBlur={(e) => saveField("notes", e.target.value || null)}
                  placeholder="Add notes..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-transparent text-zinc-900 dark:text-zinc-100 outline-none resize-y focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-zinc-400"
                />
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 my-3" />

              {/* Footer */}
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <div>
                  {task.capture_id ? (
                    <Link to={`/captures/${task.capture_id}`} className="text-violet-600 dark:text-violet-400 no-underline hover:underline" onClick={onClose}>
                      View capture
                    </Link>
                  ) : (
                    <span className="text-zinc-400 italic">Source removed</span>
                  )}
                </div>
                <div>Created {new Date(task.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
