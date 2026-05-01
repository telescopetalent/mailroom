import { useEffect, useState, useCallback, memo, useRef } from "react";
import { Link } from "react-router-dom";
import { Calendar, Link2, Trash2, RotateCcw, Check, FolderOpen, X } from "lucide-react";
import { api, getApiKey, setApiKey } from "../api/client";
import CaptureInput from "../components/CaptureInput";
import ReviewPanel from "../components/ReviewPanel";
import type { CaptureItem, CaptureList, Project, ProjectList } from "../types";

const CaptureCard = memo(function CaptureCard({
  cap,
  isExpanded,
  onToggleExpand,
  onTrash,
  onReopen,
  onReviewComplete,
  projectMap,
  projects,
  onAssign,
}: {
  cap: CaptureItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTrash: () => void;
  onReopen: () => void;
  onReviewComplete: () => void;
  projectMap: Map<string, Project>;
  projects: Project[];
  onAssign: (captureId: string, currentProjectId: string | null, newProjectId: string | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const statusColor = cap.status === "review" ? "#f59e0b" : cap.status === "approved" ? "#22c55e" : "#d1d5db";
  const workflowCount = (cap.extraction?.workflows || []).length;
  const taskCount = (cap.extraction?.tasks || []).length;
  const project = cap.project_id ? projectMap.get(cap.project_id) : null;

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

  const handleAssign = (newProjectId: string | null) => {
    setPickerOpen(false);
    onAssign(cap.id, cap.project_id, newProjectId);
  };

  return (
    <div className="mb-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors overflow-visible">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div
            className="w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
            style={{
              borderColor: statusColor,
              background: cap.status === "approved" ? statusColor : "transparent",
            }}
          >
            {cap.status === "approved" && <Check className="w-2.5 h-2.5 text-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <Link
              to={`/captures/${cap.id}`}
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 no-underline leading-snug hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              {cap.extraction?.summary || cap.normalized_text?.slice(0, 100) || "Capture"}
            </Link>

            <div className="flex items-center gap-2.5 mt-1.5 text-xs flex-wrap">
              <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                <Calendar className="w-3 h-3" />
                {new Date(cap.captured_at).toLocaleDateString()}
              </span>
              {cap.source !== "web" && <span className="text-zinc-400">{cap.source}</span>}
              {workflowCount > 0 && (
                <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                  <Link2 className="w-3 h-3" />
                  {workflowCount} workflow{workflowCount > 1 ? "s" : ""}
                </span>
              )}
              {taskCount > 0 && <span className="text-zinc-400">{taskCount} task{taskCount > 1 ? "s" : ""}</span>}
              {project && (
                <Link
                  to={`/projects/${project.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 no-underline"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color || "#7c3aed" }} />
                  <span style={{ color: project.color || "#7c3aed" }} className="font-medium">{project.name}</span>
                </Link>
              )}
            </div>

            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                cap.status === "review"
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  : cap.status === "approved"
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}>
                {cap.status}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                {cap.content_type}
              </span>
            </div>
          </div>

          <div className="flex gap-1.5 items-center shrink-0">
            {cap.status === "review" && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleExpand(); }}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-violet-600 hover:bg-violet-700 text-white transition-colors cursor-pointer border-0"
              >
                Review
              </button>
            )}
            {cap.status === "approved" && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReopen(); }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer bg-transparent"
              >
                <RotateCcw className="w-3 h-3" />
                Reopen
              </button>
            )}

            {/* Project picker */}
            <div ref={pickerRef} className="relative">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPickerOpen((v) => !v); }}
                title={project ? `In project: ${project.name}` : "Move to project"}
                style={project ? { borderColor: project.color || "#7c3aed", color: project.color || "#7c3aed" } : undefined}
                className={`flex items-center justify-center w-7 h-7 rounded-md border transition-colors cursor-pointer bg-transparent ${
                  project ? "" : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-violet-500 hover:border-violet-400"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>

              {pickerOpen && (
                <div className="absolute right-0 top-8 z-50 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1">
                  <p className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                    Move to project
                  </p>
                  {projects.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-400">No projects yet.</p>
                  )}
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={(e) => { e.stopPropagation(); handleAssign(p.id); }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-0 bg-transparent cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || "#7c3aed" }} />
                      <span className="truncate flex-1">{p.name}</span>
                      {cap.project_id === p.id && <Check className="w-3 h-3 text-violet-500 shrink-0" />}
                    </button>
                  ))}
                  {cap.project_id && (
                    <>
                      <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAssign(null); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-0 bg-transparent cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3 shrink-0" />
                        Remove from project
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTrash(); }}
              title="Move to trash"
              className="flex items-center justify-center w-7 h-7 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer bg-transparent"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && cap.status === "review" && cap.extraction && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50">
          <ReviewPanel
            captureId={cap.id}
            extraction={cap.extraction}
            onReviewComplete={onReviewComplete}
          />
        </div>
      )}
    </div>
  );
});

export default function Dashboard() {
  const [connected, setConnected] = useState(!!getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectMap, setProjectMap] = useState<Map<string, Project>>(new Map());
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingCaptures, setLoadingCaptures] = useState(false);

  const loadCaptures = useCallback(() => {
    setLoadingCaptures(true);
    Promise.all([
      api<CaptureList>("/captures"),
      api<ProjectList>("/projects"),
    ])
      .then(([caps, projs]) => {
        setCaptures(caps.items);
        setProjects(projs.items);
        setProjectMap(new Map(projs.items.map((p) => [p.id, p])));
      })
      .catch(() => {})
      .finally(() => setLoadingCaptures(false));
  }, []);

  useEffect(() => {
    if (connected) {
      api<{ email: string; name: string }>("/users/me")
        .then((u) => {
          setUser(u);
          loadCaptures();
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Connection failed");
          setConnected(false);
        });
    }
  }, [connected, loadCaptures]);

  const trashCapture = useCallback(async (id: string) => {
    await api(`/captures/${id}/trash`, { method: "POST" });
    loadCaptures();
  }, [loadCaptures]);

  const reopenCapture = useCallback(async (id: string) => {
    await api(`/captures/${id}/reopen`, { method: "POST" });
    loadCaptures();
  }, [loadCaptures]);

  const assignProject = useCallback(async (
    captureId: string,
    currentProjectId: string | null,
    newProjectId: string | null,
  ) => {
    if (newProjectId === null && currentProjectId) {
      await api(`/projects/${currentProjectId}/captures/${captureId}`, { method: "DELETE" });
    } else if (newProjectId) {
      await api(`/projects/${newProjectId}/captures/${captureId}`, { method: "POST" });
    }
    // Optimistic update — no full reload needed
    setCaptures((prev) =>
      prev.map((c) => c.id === captureId ? { ...c, project_id: newProjectId } : c)
    );
  }, []);

  if (!connected) {
    return (
      <div className="max-w-sm mx-auto mt-24">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Connect to Mailroom</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Enter your API key to get started.</p>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
        <input
          type="text"
          placeholder="mr_..."
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          className="w-full px-3 py-2 mb-3 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        <button
          onClick={() => {
            setApiKey(keyInput);
            setConnected(true);
            setError("");
          }}
          className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer border-0"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div>
      {user && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Signed in as <strong className="text-zinc-900 dark:text-zinc-100">{user.name}</strong> ({user.email})
        </p>
      )}

      <CaptureInput onCaptureCreated={loadCaptures} />

      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mt-8 mb-3">Recent Captures</h3>
      {loadingCaptures && <p className="text-sm text-zinc-400">Loading...</p>}
      {!loadingCaptures && captures.length === 0 && <p className="text-sm text-zinc-400">No captures yet. Paste some text above to get started.</p>}

      {captures.map((cap) => (
        <CaptureCard
          key={cap.id}
          cap={cap}
          isExpanded={expandedId === cap.id}
          onToggleExpand={() => setExpandedId(expandedId === cap.id ? null : cap.id)}
          onTrash={() => trashCapture(cap.id)}
          onReopen={() => reopenCapture(cap.id)}
          onReviewComplete={() => { setExpandedId(null); loadCaptures(); }}
          projectMap={projectMap}
          projects={projects}
          onAssign={assignProject}
        />
      ))}
    </div>
  );
}
