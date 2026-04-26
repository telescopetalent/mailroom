import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FolderOpen, ArrowLeft, Pencil, Trash2, Plus, X, Check, Calendar } from "lucide-react";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";
import type { Project, CaptureItem, CaptureList } from "../types";

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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit project state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  // Add captures picker
  const [showPicker, setShowPicker] = useState(false);
  const [allCaptures, setAllCaptures] = useState<CaptureItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Confirm delete project
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      api<Project>(`/projects/${id}`),
      api<CaptureList>(`/captures?project_id=${id}&page_size=100`),
    ])
      .then(([proj, caps]) => {
        setProject(proj);
        setCaptures(caps.items);
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
    setProject((prev) => prev ? { ...prev, capture_count: prev.capture_count - 1 } : prev);
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

  return (
    <div>
      {/* Back link */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 no-underline mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Projects
      </Link>

      {/* Project header */}
      {editing ? (
        <div className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-semibold"
              placeholder="Project name"
            />
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Description (optional)"
            />
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setEditColor(c.value)}
                    className="w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                    style={{
                      background: c.value,
                      borderColor: editColor === c.value ? "white" : "transparent",
                      outline: editColor === c.value ? `2px solid ${c.value}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-sm font-medium rounded-md text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editName.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white border-0 cursor-pointer transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: project.color || "#7c3aed" }}
          >
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{project.name}</h2>
            {project.description && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{project.description}</p>
            )}
            <p className="text-xs text-zinc-400 mt-1">
              {project.capture_count} capture{project.capture_count !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={startEdit}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-0 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Captures section */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Captures</h3>
        <button
          onClick={openPicker}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add captures
        </button>
      </div>

      {/* Capture picker */}
      {showPicker && (
        <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Select captures to add
            </span>
            <button
              onClick={() => setShowPicker(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-transparent border-0 cursor-pointer p-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {pickerLoading ? (
            <p className="text-xs text-zinc-400 py-2">Loading…</p>
          ) : allCaptures.length === 0 ? (
            <p className="text-xs text-zinc-400 py-2">All inbox captures are already in this project.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {allCaptures.map((cap) => (
                <button
                  key={cap.id}
                  onClick={() => addCapture(cap.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-0 bg-transparent cursor-pointer transition-colors w-full"
                >
                  <Plus className="w-3 h-3 text-violet-500 shrink-0" />
                  <span className="truncate">
                    {cap.extraction?.summary || cap.normalized_text?.slice(0, 80) || "Capture"}
                  </span>
                  <span className="ml-auto text-zinc-400 shrink-0">
                    {new Date(cap.captured_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Captures list */}
      {captures.length === 0 ? (
        <p className="text-sm text-zinc-400 py-4">No captures in this project yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {captures.map((cap) => (
            <div
              key={cap.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to={`/captures/${cap.id}`}
                  className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 no-underline hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate"
                >
                  {cap.extraction?.summary || cap.normalized_text?.slice(0, 100) || "Capture"}
                </Link>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  <Calendar className="w-3 h-3" />
                  {new Date(cap.captured_at).toLocaleDateString()}
                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                    cap.status === "review"
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      : cap.status === "approved"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                  }`}>
                    {cap.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeCapture(cap.id)}
                title="Remove from project"
                className="shrink-0 p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 bg-transparent border-0 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Done indicator — closes picker */}
      {showPicker && allCaptures.length > 0 && (
        <button
          onClick={() => setShowPicker(false)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-transparent border-0 cursor-pointer hover:underline"
        >
          <Check className="w-3 h-3" />
          Done adding
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete project"
        description={`Delete "${project.name}"? Captures will be unassigned but not deleted.`}
        onConfirm={deleteProject}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
