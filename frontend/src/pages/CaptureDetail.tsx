import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Trash2, RotateCcw } from "lucide-react";
import { api } from "../api/client";
import ReviewPanel from "../components/ReviewPanel";
import MediaSection from "../components/MediaSection";
import ProjectPicker from "../components/ProjectPicker";
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

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      api<CaptureData>(`/captures/${id}`),
      api<ProjectList>("/projects"),
    ])
      .then(([cap, projs]) => {
        setCapture(cap);
        setProjects(projs.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const assignProject = useCallback(async (newProjectId: string | null) => {
    if (!capture) return;
    if (newProjectId === null && capture.project_id) {
      await api(`/projects/${capture.project_id}/captures/${capture.id}`, { method: "DELETE" });
      setCapture((c) => c ? { ...c, project_id: null } : c);
    } else if (newProjectId) {
      await api(`/projects/${newProjectId}/captures/${capture.id}`, { method: "POST" });
      setCapture((c) => c ? { ...c, project_id: newProjectId } : c);
    }
  }, [capture]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!capture) return <p className="text-sm text-zinc-400">Loading...</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 no-underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
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

      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3">Capture</h2>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-zinc-500 dark:text-zinc-400 mb-4">
        <span>Source: {capture.source}</span>
        <span>Type: {capture.content_type}</span>
        <span>Status: <strong className="text-zinc-700 dark:text-zinc-300">{capture.status}</strong></span>
        <span>{new Date(capture.captured_at).toLocaleString()}</span>

        {/* Project assignment */}
        <ProjectPicker
          projects={projects}
          currentProjectId={capture.project_id}
          onAssign={assignProject}
          align="left"
          variant="inline"
        />
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
