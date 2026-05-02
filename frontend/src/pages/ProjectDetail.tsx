import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FolderOpen, ArrowLeft, Pencil, Trash2, Plus, X, Check, Calendar, Link2, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";
import { COLOR_OPTIONS } from "../constants";
import type { Project, CaptureItem, CaptureList, Workflow, WorkflowList, Task, TaskList } from "../types";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  // Add captures picker
  const [showPicker, setShowPicker] = useState(false);
  const [allCaptures, setAllCaptures] = useState<CaptureItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      api<Project>(`/projects/${id}`),
      api<CaptureList>(`/captures?project_id=${id}&page_size=100`),
      api<WorkflowList>(`/workflows?project_id=${id}&page_size=100`),
      api<TaskList>(`/tasks?project_id=${id}&page_size=100`),
    ])
      .then(([proj, caps, wfs, ts]) => {
        setProject(proj);
        setCaptures(caps.items);
        setWorkflows(wfs.items);
        setTasks(ts.items.filter((t) => !t.workflow_id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description || "");
    setEditColor(project.color || COLOR_OPTIONS[0].value);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!project || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await api<Project>(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null, color: editColor }),
      });
      setProject(updated);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!project) return;
    await api(`/projects/${project.id}`, { method: "DELETE" });
    navigate("/projects");
  };

  const removeCapture = async (captureId: string) => {
    if (!project) return;
    await api(`/projects/${project.id}/captures/${captureId}`, { method: "DELETE" });
    setCaptures((prev) => prev.filter((c) => c.id !== captureId));
    setProject((prev) => prev ? { ...prev, capture_count: Math.max(0, prev.capture_count - 1) } : prev);
  };

  const removeWorkflow = async (wfId: string) => {
    if (!project) return;
    await api(`/projects/${project.id}/workflows/${wfId}`, { method: "DELETE" });
    setWorkflows((prev) => prev.filter((w) => w.id !== wfId));
    setProject((prev) => prev ? { ...prev, workflow_count: Math.max(0, prev.workflow_count - 1) } : prev);
  };

  const removeTask = async (taskId: string) => {
    if (!project) return;
    await api(`/projects/${project.id}/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setProject((prev) => prev ? { ...prev, task_count: Math.max(0, prev.task_count - 1) } : prev);
  };

  const openPicker = async () => {
    setShowPicker(true);
    setPickerLoading(true);
    try {
      const data = await api<CaptureList>("/captures?page_size=100");
      const inProject = new Set(captures.map((c) => c.id));
      setAllCaptures(data.items.filter((c) => !inProject.has(c.id)));
    } finally {
      setPickerLoading(false);
    }
  };

  const addCapture = async (captureId: string) => {
    if (!project) return;
    await api(`/projects/${project.id}/captures/${captureId}`, { method: "POST" });
    const added = allCaptures.find((c) => c.id === captureId);
    if (added) {
      setCaptures((prev) => [{ ...added, project_id: project.id }, ...prev]);
      setAllCaptures((prev) => prev.filter((c) => c.id !== captureId));
      setProject((prev) => prev ? { ...prev, capture_count: prev.capture_count + 1 } : prev);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!project) return null;

  const totalItems = captures.length + workflows.length + tasks.length;

  return (
    <div>
      {/* Back */}
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 no-underline mb-5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Projects
      </Link>

      {/* Header */}
      {editing ? (
        <div className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <div className="flex flex-col gap-3">
            <input autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-semibold"
              placeholder="Project name" />
            <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Description (optional)" />
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button key={c.value} type="button" title={c.label} onClick={() => setEditColor(c.value)}
                    className="w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                    style={{ background: c.value, borderColor: editColor === c.value ? "white" : "transparent", outline: editColor === c.value ? `2px solid ${c.value}` : "none" }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={saving || !editName.trim()} className="px-3 py-1.5 text-sm font-medium rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white border-0 cursor-pointer transition-colors">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center mt-0.5" style={{ background: project.color || "#7c3aed" }}>
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{project.name}</h2>
            {project.description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{project.description}</p>}
            <p className="text-xs text-zinc-400 mt-1">{totalItems} item{totalItems !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={startEdit} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-0 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Workflows ─────────────────────────────────── */}
      {workflows.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Workflows · {workflows.length}
          </h3>
          <div className="flex flex-col gap-2">
            {workflows.map((wf) => {
              const done = wf.tasks.filter((t) => t.status === "completed").length;
              const total = wf.tasks.length;
              const pct = total > 0 ? (done / total) * 100 : 0;
              return (
                <div key={wf.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <Link to="/tasks" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 no-underline hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate">{wf.name}</Link>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full max-w-32">
                        <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-zinc-400 flex items-center gap-1 shrink-0">
                        <Link2 className="w-3 h-3" /> {done}/{total}
                      </span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${wf.status === "completed" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>
                        {wf.status}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => removeWorkflow(wf.id)} title="Remove from project" className="shrink-0 p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 bg-transparent border-0 cursor-pointer transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Tasks ─────────────────────────────────────── */}
      {tasks.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Tasks · {tasks.length}
          </h3>
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: task.status === "completed" ? "#22c55e" : "#d1d5db", background: task.status === "completed" ? "#22c55e" : "transparent" }}>
                  {task.status === "completed" && <Check className="w-2 h-2 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.status === "completed" ? "line-through text-zinc-400" : "text-zinc-900 dark:text-zinc-100"}`}>{task.title}</p>
                  {task.due_date && (
                    <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                      <Calendar className="w-3 h-3" /> {task.due_date}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => removeTask(task.id)} title="Remove from project" className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 bg-transparent border-0 cursor-pointer transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <Link to="/tasks" className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Captures ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Captures · {captures.length}
          </h3>
          <button onClick={openPicker} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {/* Picker */}
        {showPicker && (
          <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Select captures to add</span>
              <button onClick={() => setShowPicker(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-transparent border-0 cursor-pointer p-0"><X className="w-3.5 h-3.5" /></button>
            </div>
            {pickerLoading ? (
              <p className="text-xs text-zinc-400 py-2">Loading…</p>
            ) : allCaptures.length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">All inbox captures are already in this project.</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                {allCaptures.map((cap) => (
                  <button key={cap.id} onClick={() => addCapture(cap.id)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-0 bg-transparent cursor-pointer transition-colors w-full">
                    <Plus className="w-3 h-3 text-violet-500 shrink-0" />
                    <span className="truncate">{cap.extraction?.summary || cap.normalized_text?.slice(0, 80) || "Capture"}</span>
                    <span className="ml-auto text-zinc-400 shrink-0">{new Date(cap.captured_at).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {captures.length === 0 ? (
          <p className="text-sm text-zinc-400 py-2">No captures in this project.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {captures.map((cap) => (
              <div key={cap.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <Link to={`/captures/${cap.id}`} className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 no-underline hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate">
                    {cap.extraction?.summary || cap.normalized_text?.slice(0, 100) || "Capture"}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                    <Calendar className="w-3 h-3" />
                    {new Date(cap.captured_at).toLocaleDateString()}
                    <span className={`px-1.5 py-0.5 rounded font-medium ${cap.status === "review" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : cap.status === "approved" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>
                      {cap.status}
                    </span>
                  </div>
                </div>
                <button onClick={() => removeCapture(cap.id)} title="Remove from project" className="shrink-0 p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 bg-transparent border-0 cursor-pointer transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {workflows.length === 0 && tasks.length === 0 && captures.length === 0 && (
        <p className="text-sm text-zinc-400 mt-4">Nothing in this project yet. Assign workflows, tasks, or captures from their respective pages.</p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete project"
        description={`Delete "${project.name}"? All items will be unassigned but not deleted.`}
        onConfirm={deleteProject}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
