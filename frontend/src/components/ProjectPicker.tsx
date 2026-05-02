import { useState, useRef, useEffect } from "react";
import { FolderOpen, Check, X } from "lucide-react";
import type { Project } from "../types";

interface ProjectPickerProps {
  /** Full list of available projects. */
  projects: Project[];
  /** Currently assigned project ID, or null. */
  currentProjectId: string | null;
  /** Called with the new project ID, or null to remove the assignment. */
  onAssign: (projectId: string | null) => void;
  /** Dropdown alignment relative to the trigger. Default "right". */
  align?: "left" | "right";
  /**
   * "icon"   – square bordered icon button; for use in card action rows (Dashboard, Tasks).
   * "inline" – folder icon + text label; for use in meta rows (CaptureDetail).
   */
  variant?: "icon" | "inline";
}

/**
 * Self-contained project assignment picker.
 * Handles its own open/close state and click-outside dismissal.
 */
export default function ProjectPicker({
  projects,
  currentProjectId,
  onAssign,
  align = "right",
  variant = "icon",
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAssign = (projectId: string | null) => {
    setOpen(false);
    onAssign(projectId);
  };

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ────────────────────────────────────── */}
      {variant === "icon" ? (
        <button
          onClick={() => setOpen((v) => !v)}
          title={currentProject ? `Project: ${currentProject.name}` : "Move to project"}
          className={`flex items-center justify-center w-7 h-7 rounded-md border transition-colors cursor-pointer bg-transparent ${
            currentProject
              ? ""
              : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-violet-500 hover:border-violet-400"
          }`}
          style={
            currentProject
              ? { borderColor: currentProject.color || "#7c3aed", color: currentProject.color || "#7c3aed" }
              : undefined
          }
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <FolderOpen
            className="w-3.5 h-3.5"
            style={currentProject ? { color: currentProject.color || "#7c3aed" } : undefined}
          />
          <button
            onClick={() => setOpen((v) => !v)}
            className="border-0 bg-transparent cursor-pointer p-0 text-xs transition-colors"
            style={currentProject ? { color: currentProject.color || "#7c3aed", fontWeight: 500 } : undefined}
          >
            {currentProject ? (
              currentProject.name
            ) : (
              <span className="text-zinc-400 hover:text-violet-500 transition-colors">Add to project</span>
            )}
          </button>
          {currentProject && (
            <button
              onClick={() => handleAssign(null)}
              title="Remove from project"
              className="ml-0.5 text-zinc-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* ── Dropdown ───────────────────────────────────── */}
      {open && (
        <div
          className={`absolute z-50 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 top-full mt-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <p className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
            Move to project
          </p>
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-400">No projects yet.</p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleAssign(p.id)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-0 bg-transparent cursor-pointer transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || "#7c3aed" }} />
                <span className="truncate flex-1">{p.name}</span>
                {currentProjectId === p.id && <Check className="w-3 h-3 text-violet-500 shrink-0" />}
              </button>
            ))
          )}
          {currentProjectId && (
            <>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <button
                onClick={() => handleAssign(null)}
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
  );
}
