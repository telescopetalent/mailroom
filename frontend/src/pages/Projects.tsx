import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Plus, X } from "lucide-react";
import { api } from "../api/client";
import type { Project, ProjectList } from "../types";

const COLOR_OPTIONS = [
  { label: "Violet", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Red", value: "#dc2626" },
  { label: "Amber", value: "#d97706" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Pink", value: "#db2777" },
  { label: "Lime", value: "#65a30d" },
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<ProjectList>("/projects")
      .then((data) => setProjects(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Projects</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-violet-600 hover:bg-violet-700 text-white border-0 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New project
        </button>
      </div>

      {/* Create form */}
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

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No projects yet.</p>
          <p className="text-xs text-zinc-400 mt-1">Create a project to organize your captures.</p>
        </div>
      ) : (
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
                {project.capture_count} capture{project.capture_count !== 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
