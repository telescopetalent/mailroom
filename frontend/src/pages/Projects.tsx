import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen, Plus, X, ChevronRight,
  List, LayoutList, Check, Link2, Calendar,
} from "lucide-react";
import { api } from "../api/client";
import { COLOR_OPTIONS } from "../constants";
import type {
  Project, ProjectList,
  Workflow, WorkflowList,
  Task, TaskList,
  CaptureItem, CaptureList,
} from "../types";

type ViewMode = "compact" | "expanded";

interface ExpandedData {
  workflows: Workflow[];
  tasks: Task[];
  captures: CaptureItem[];
  loading: boolean;
  loaded: boolean;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("projects_view") as ViewMode | null) ?? "compact",
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedData, setExpandedData] = useState<Record<string, ExpandedData>>({});

  const load = useCallback(() => {
    api<ProjectList>("/projects")
      .then((data) => setProjects(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("projects_view", mode);
  };

  const toggleExpand = async (projectId: string) => {
    const next = new Set(expandedIds);
    if (next.has(projectId)) {
      next.delete(projectId);
      setExpandedIds(next);
      return;
    }
    next.add(projectId);
    setExpandedIds(next);

    if (!expandedData[projectId]?.loaded) {
      setExpandedData((prev) => ({
        ...prev,
        [projectId]: { workflows: [], tasks: [], captures: [], loading: true, loaded: false },
      }));
      try {
        const [caps, wfs, ts] = await Promise.all([
          api<CaptureList>(`/captures?project_id=${projectId}&page_size=100`),
          api<WorkflowList>(`/workflows?project_id=${projectId}&page_size=100`),
          api<TaskList>(`/tasks?project_id=${projectId}&page_size=100`),
        ]);
        setExpandedData((prev) => ({
          ...prev,
          [projectId]: {
            captures: caps.items,
            workflows: wfs.items,
            tasks: ts.items.filter((t) => !t.workflow_id),
            loading: false,
            loaded: true,
          },
        }));
      } catch {
        setExpandedData((prev) => ({
          ...prev,
          [projectId]: { workflows: [], tasks: [], captures: [], loading: false, loaded: true },
        }));
      }
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await api<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null, color: formColor }),
      });
      setFormName("");
      setFormDesc("");
      setFormColor(COLOR_OPTIONS[0].value);
      setShowForm(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div>
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Projects</h2>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5">
            <button
              onClick={() => switchView("compact")}
              title="Compact list"
              className={`p-1.5 rounded transition-colors border-0 cursor-pointer ${
                viewMode === "compact"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => switchView("expanded")}
              title="Expanded view"
              className={`p-1.5 rounded transition-colors border-0 cursor-pointer ${
                viewMode === "expanded"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-violet-600 hover:bg-violet-700 text-white border-0 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New project
          </button>
        </div>
      </div>

      {/* ── Create form ───────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={submitCreate}
          className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">New project</span>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-transparent border-0 cursor-pointer p-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Project name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              required
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setFormColor(c.value)}
                    className="w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                    style={{
                      background: c.value,
                      borderColor: formColor === c.value ? "white" : "transparent",
                      outline: formColor === c.value ? `2px solid ${c.value}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !formName.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white border-0 cursor-pointer transition-colors"
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Content ───────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No projects yet.</p>
          <p className="text-xs text-zinc-400 mt-1">Create a project to organize your captures.</p>
        </div>
      ) : viewMode === "compact" ? (

        /* ── Compact view ──────────────────────────────────── */
        <div className="grid grid-cols-1 gap-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 no-underline transition-colors group"
            >
              <div
                className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                style={{ background: project.color || "#7c3aed" }}
              >
                <FolderOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  {project.name}
                </p>
                {project.description && (
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">{project.description}</p>
                )}
              </div>
              <span className="text-xs text-zinc-400 shrink-0">
                {[
                  project.capture_count > 0 && `${project.capture_count} capture${project.capture_count !== 1 ? "s" : ""}`,
                  project.workflow_count > 0 && `${project.workflow_count} workflow${project.workflow_count !== 1 ? "s" : ""}`,
                  project.task_count > 0 && `${project.task_count} task${project.task_count !== 1 ? "s" : ""}`,
                ].filter(Boolean).join(" · ") || "Empty"}
              </span>
            </Link>
          ))}
        </div>

      ) : (

        /* ── Expanded (accordion) view ─────────────────────── */
        <div className="flex flex-col gap-2">
          {projects.map((project) => {
            const isOpen = expandedIds.has(project.id);
            const data = expandedData[project.id];
            const itemSummary = [
              project.capture_count > 0 && `${project.capture_count} capture${project.capture_count !== 1 ? "s" : ""}`,
              project.workflow_count > 0 && `${project.workflow_count} workflow${project.workflow_count !== 1 ? "s" : ""}`,
              project.task_count > 0 && `${project.task_count} task${project.task_count !== 1 ? "s" : ""}`,
            ].filter(Boolean).join(" · ") || "Empty";

            return (
              <div
                key={project.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
              >
                {/* Accordion header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(project.id)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 bg-transparent border-0 cursor-pointer p-0 shrink-0 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                    />
                  </button>

                  <div
                    className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center"
                    style={{ background: project.color || "#7c3aed" }}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-white" />
                  </div>

                  <button
                    onClick={() => toggleExpand(project.id)}
                    className="flex-1 min-w-0 text-left bg-transparent border-0 cursor-pointer p-0"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {project.name}
                    </p>
                    {!isOpen && (
                      <p className="text-xs text-zinc-400 mt-0.5">{itemSummary}</p>
                    )}
                  </button>

                  <Link
                    to={`/projects/${project.id}`}
                    className="shrink-0 p-1 rounded text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors no-underline"
                    title="Open project detail"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pb-3 pt-2">
                    {data?.loading ? (
                      <p className="text-xs text-zinc-400 py-3 text-center">Loading…</p>
                    ) : !data?.loaded ? null : (
                      <>
                        {/* Workflows */}
                        {data.workflows.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                              Workflows · {data.workflows.length}
                            </p>
                            <div className="flex flex-col">
                              {data.workflows.map((wf) => {
                                const done = wf.tasks.filter((t) => t.status === "completed").length;
                                const total = wf.tasks.length;
                                const pct = total > 0 ? (done / total) * 100 : 0;
                                return (
                                  <div key={wf.id} className="flex items-center gap-3 py-1.5">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{wf.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full max-w-28">
                                          <div
                                            className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-violet-500"}`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-zinc-400 flex items-center gap-1 shrink-0">
                                          <Link2 className="w-3 h-3" /> {done}/{total}
                                        </span>
                                      </div>
                                    </div>
                                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                      wf.status === "completed"
                                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                    }`}>
                                      {wf.status}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tasks */}
                        {data.tasks.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                              Tasks · {data.tasks.length}
                            </p>
                            <div className="flex flex-col">
                              {data.tasks.map((task) => (
                                <div key={task.id} className="flex items-center gap-2.5 py-1.5">
                                  <div
                                    className="w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center"
                                    style={{
                                      borderColor: task.status === "completed" ? "#22c55e" : "#d1d5db",
                                      background: task.status === "completed" ? "#22c55e" : "transparent",
                                    }}
                                  >
                                    {task.status === "completed" && <Check className="w-2 h-2 text-white" />}
                                  </div>
                                  <p className={`text-sm flex-1 truncate ${
                                    task.status === "completed"
                                      ? "line-through text-zinc-400"
                                      : "text-zinc-800 dark:text-zinc-200"
                                  }`}>
                                    {task.title}
                                  </p>
                                  {task.due_date && (
                                    <span className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
                                      <Calendar className="w-3 h-3" /> {task.due_date}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Captures */}
                        {data.captures.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                              Captures · {data.captures.length}
                            </p>
                            <div className="flex flex-col">
                              {data.captures.map((cap) => (
                                <Link
                                  key={cap.id}
                                  to={`/captures/${cap.id}`}
                                  className="flex items-center gap-2.5 py-1.5 no-underline group"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-px"
                                    style={{ background: project.color || "#7c3aed" }}
                                  />
                                  <p className="text-sm text-zinc-800 dark:text-zinc-200 group-hover:text-violet-600 dark:group-hover:text-violet-400 truncate flex-1 transition-colors">
                                    {cap.extraction?.summary || cap.normalized_text?.slice(0, 80) || "Capture"}
                                  </p>
                                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                    cap.status === "review"
                                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                      : cap.status === "approved"
                                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                  }`}>
                                    {cap.status}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {data.workflows.length === 0 && data.tasks.length === 0 && data.captures.length === 0 && (
                          <p className="text-xs text-zinc-400 py-3 text-center">Nothing in this project yet.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
