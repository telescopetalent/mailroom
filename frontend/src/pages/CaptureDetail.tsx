import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Trash2, RotateCcw, FolderOpen, X, Check } from "lucide-react";
import { api } from "../api/client";
import ReviewPanel from "../components/ReviewPanel";
import MediaSection from "../components/MediaSection";
import type { Extraction, Attachment, Project, ProjectList } from "../types";

interface CaptureData {
  id: string;
  source: string;
  content_type: string;
  normalized_text: string | null;
  status: string;
  captured_at: string;
  project_id: string | null;
  extraction: Extraction | null;
  attachments?: Attachment[];
}

export default function CaptureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [capture, setCapture] = useState<CaptureData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    if (!id) return;
    Promise.all([
      api<CaptureData>(`/captures/${id}`),
      api<ProjectList>("/projects"),
    ])
      .then(([cap, projs]) => {
        setCapture(cap);
        setProjects(projs.items);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const assignProject = async (newProjectId: string | null) => {
    if (!capture) return;
    setPickerOpen(false);
    if (newProjectId === null && capture.project_id) {
      await api(`/projects/${capture.project_id}/captures/${capture.id}`, { method: "DELETE" });
      setCapture((c) => c ? { ...c, project_id: null } : c);
    } else if (newProjectId) {
      await api(`/projects/${newProjectId}/captures/${capture.id}`, { method: "POST" });
      setCapture((c) => c ? { ...c, project_id: newProjectId } : c);
    }
  };

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!capture) return <p className="text-sm text-zinc-400">Loading...</p>;

  const currentProject = projects.find((p) => p.id === capture.project_id) ?? null;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Link to="/" className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 no-underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Inbox
        </Link>
        {capture.status !== "trashed" && (
          <button
            onClick={async () => {
              await api(`/captures/${capture.id}/trash`, { method: "POST" });
              navigate("/");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Move to Trash
          </button>
        )}
      </div>

      {/* Title */}
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">Capture</h2>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-zinc-500 dark:text-zinc-400 mb-4">
        <span>Source: {capture.source}</span>
        <span>Type: {capture.content_type}</span>
        <span>Status: <strong className="text-zinc-700 dark:text-zinc-300">{capture.status}</strong></span>
        <span>{new Date(capture.captured_at).toLocaleString()}</span>

        {/* Project assignment */}
        <div ref={pickerRef} className="relative flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5" style={currentProject ? { color: currentProject.color || "#7c3aed" } : undefined} />
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0 text-xs transition-colors"
            style={currentProject ? { color: currentProject.color || "#7c3aed", fontWeight: 500 } : undefined}
          >
            {currentProject ? currentProject.name : (
              <span className="text-zinc-400 hover:text-violet-500 transition-colors">Add to project</span>
            )}
          </button>
          {currentProject && (
            <button
              onClick={() => assignProject(null)}
              className="ml-0.5 text-zinc-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 transition-colors"
              title="Remove from project"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {pickerOpen && (
            <div className="absolute left-0 top-6 z-50 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1">
              <p className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                Move to project
              </p>
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-zinc-400">No projects yet.</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => assignProject(p.id)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-0 bg-transparent cursor-pointer transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || "#7c3aed" }} />
                    <span className="truncate flex-1">{p.name}</span>
                    {capture.project_id === p.id && <Check className="w-3 h-3 text-violet-500 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Normalized text */}
      {capture.normalized_text && (
        <pre className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 rounded-lg whitespace-pre-wrap text-sm font-mono text-zinc-800 dark:text-zinc-200">
          {capture.normalized_text}
        </pre>
      )}

      {/* Media & Links */}
      <MediaSection
        captureId={capture.id}
        attachments={capture.attachments || []}
        normalizedText={capture.normalized_text}
      />

      {/* Review panel */}
      {capture.extraction && capture.status === "review" && (
        <>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-6 mb-3">Review Extraction</h3>
          <ReviewPanel captureId={capture.id} extraction={capture.extraction} onReviewComplete={load} />
        </>
      )}

      {/* Approved banner */}
      {capture.extraction && capture.status === "approved" && (
        <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex justify-between items-center">
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            <strong>Approved</strong> — items saved as tasks.{" "}
            <Link to="/tasks" className="text-violet-600 dark:text-violet-400 no-underline hover:underline">
              View tasks
            </Link>
          </div>
          <button
            onClick={async () => {
              await api(`/captures/${capture.id}/reopen`, { method: "POST" });
              load();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reopen for Review
          </button>
        </div>
      )}
    </div>
  );
}
