import { useState, useRef, useCallback } from "react";
import { FileText, FileIcon, Lock, Unlock, X } from "lucide-react";
import { api, apiUpload } from "../api/client";

interface CaptureInputProps {
  onCaptureCreated: () => void;
}

interface ManualTask {
  title: string;
  owner: string;
  due_date: string;
  priority: string;
}

interface ManualFollowUp {
  description: string;
  owner: string;
  due_date: string;
}

interface ManualWorkflow {
  name: string;
  description: string;
  steps: { title: string; owner: string; depends_on_prior: boolean }[];
}

const emptyTask = (): ManualTask => ({ title: "", owner: "", due_date: "", priority: "none" });
const emptyFollowUp = (): ManualFollowUp => ({ description: "", owner: "", due_date: "" });
const emptyWorkflow = (): ManualWorkflow => ({ name: "", description: "", steps: [{ title: "", owner: "", depends_on_prior: false }] });

const inputCls = "w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-transparent text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent";
const labelCls = "text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1";
const sectionCls = "mb-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800";
const addBtnCls = "text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-transparent border-0 cursor-pointer transition-colors";
const removeBtnCls = "text-xs text-zinc-400 hover:text-red-500 bg-transparent border-0 cursor-pointer transition-colors";

const ACCEPTED_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function CaptureInput({ onCaptureCreated }: CaptureInputProps) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // File upload state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`File type not supported: ${f.name}`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError(`File too large (max 10MB): ${f.name}`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Manual form state
  const [summary, setSummary] = useState("");
  const [tasks, setTasks] = useState<ManualTask[]>([emptyTask()]);
  const [nextSteps, setNextSteps] = useState<string[]>([""]);
  const [blockers, setBlockers] = useState<string[]>([""]);
  const [followUps, setFollowUps] = useState<ManualFollowUp[]>([emptyFollowUp()]);
  const [manualWorkflows, setManualWorkflows] = useState<ManualWorkflow[]>([]);
  const [priority, setPriority] = useState("none");

  const resetManualForm = () => {
    setSummary("");
    setTasks([emptyTask()]);
    setNextSteps([""]);
    setBlockers([""]);
    setFollowUps([emptyFollowUp()]);
    setManualWorkflows([]);
    setPriority("none");
  };

  const handleSubmitAI = async () => {
    if (!text.trim() && files.length === 0) return;
    setLoading(true);
    setError("");
    try {
      if (files.length > 0) {
        const formData = new FormData();
        formData.append("metadata", JSON.stringify({
          source: "web",
          content_text: text || undefined,
          mode: "ai",
        }));
        for (const f of files) formData.append("files", f);
        await apiUpload("/captures/upload", formData);
      } else {
        await api("/captures", {
          method: "POST",
          body: JSON.stringify({ source: "web", content_text: text, mode: "ai" }),
        });
      }
      setText("");
      setFiles([]);
      onCaptureCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitManual = async () => {
    const filteredTasks = tasks.filter((t) => t.title.trim()).map((t) => ({
      title: t.title, owner: t.owner || undefined, due_date: t.due_date || undefined, priority: t.priority,
    }));
    const filteredNextSteps = nextSteps.filter((s) => s.trim());
    const filteredBlockers = blockers.filter((b) => b.trim());
    const filteredFollowUps = followUps.filter((f) => f.description.trim()).map((f) => ({
      description: f.description, owner: f.owner || undefined, due_date: f.due_date || undefined,
    }));
    const filteredWorkflows = manualWorkflows
      .filter((w) => w.name.trim() && w.steps.some((s) => s.title.trim()))
      .map((w) => ({
        name: w.name, description: w.description || undefined,
        steps: w.steps.filter((s) => s.title.trim()).map((s) => ({
          title: s.title, owner: s.owner || undefined, depends_on_prior: s.depends_on_prior || undefined,
        })),
      }));

    if (!summary.trim() && filteredTasks.length === 0 && filteredNextSteps.length === 0 && filteredWorkflows.length === 0) {
      setError("Add a summary, at least one task, workflow, or next step.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api("/captures", {
        method: "POST",
        body: JSON.stringify({
          source: "web", content_text: summary || "Manual capture", mode: "manual",
          manual_extraction: {
            summary: summary || undefined, tasks: filteredTasks, workflows: filteredWorkflows,
            next_steps: filteredNextSteps, blockers: filteredBlockers, follow_ups: filteredFollowUps, priority,
          },
        }),
      });
      resetManualForm();
      onCaptureCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const updateTask = (i: number, field: keyof ManualTask, value: string) => {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  };

  const updateFollowUp = (i: number, field: keyof ManualFollowUp, value: string) => {
    setFollowUps((prev) => prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));
  };

  return (
    <div className="mb-6">
      {/* Header with mode toggle */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide m-0">Capture</h3>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5">
          <button
            onClick={() => setMode("ai")}
            className={`px-3 py-1 text-xs font-medium rounded cursor-pointer border-0 transition-colors ${
              mode === "ai"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            AI
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`px-3 py-1 text-xs font-medium rounded cursor-pointer border-0 transition-colors ${
              mode === "manual"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {mode === "ai" ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed transition-all ${
              isDragOver
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            }`}
          >
            <textarea
              placeholder="Paste text, or drag and drop images, PDFs, or documents..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.startsWith("image/")) {
                    const file = items[i].getAsFile();
                    if (file) addFiles([file]);
                  }
                }
              }}
              rows={5}
              className="w-full px-3 py-3 text-sm bg-transparent border-0 outline-none resize-y text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            {files.length === 0 && (
              <div className="px-3 pb-2 text-xs text-zinc-400">
                Drop images, PDFs, or DOCX files here
                <span
                  onClick={() => fileInputRef.current?.click()}
                  className="text-violet-500 cursor-pointer ml-1 hover:text-violet-400"
                >
                  or browse
                </span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.docx"
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />

          {/* File previews */}
          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs border border-zinc-200 dark:border-zinc-700">
                  {f.type.startsWith("image/") ? (
                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-5 h-5 object-cover rounded-sm" />
                  ) : (
                    f.type.includes("pdf") ? <FileText className="w-4 h-4 text-zinc-500" /> : <FileIcon className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-zinc-700 dark:text-zinc-300">{f.name}</span>
                  <span className="text-zinc-400">({(f.size / 1024).toFixed(0)}KB)</span>
                  <button onClick={() => removeFile(i)} className="p-0 bg-transparent border-0 cursor-pointer text-zinc-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2 mb-0">{error}</p>}
          <button
            onClick={handleSubmitAI}
            disabled={loading || (!text.trim() && files.length === 0)}
            className="mt-3 px-4 py-2 text-sm font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors cursor-pointer border-0"
          >
            {loading ? "Processing..." : "Send to Mailroom"}
          </button>
        </>
      ) : (
        <div>
          {/* Summary */}
          <div className={sectionCls}>
            <div className={labelCls}>Summary</div>
            <textarea
              placeholder="Brief summary of this capture..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className={inputCls + " resize-y"}
            />
          </div>

          {/* Priority */}
          <div className={sectionCls + " flex items-center gap-3"}>
            <div className={labelCls + " mb-0"}>Priority</div>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls + " w-auto"}>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Tasks */}
          <div className={sectionCls}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Tasks</div>
              <button onClick={() => setTasks((prev) => [...prev, emptyTask()])} className={addBtnCls}>+ Add task</button>
            </div>
            {tasks.map((t, i) => (
              <div key={i} className="mb-2 p-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                <div className="flex gap-2 mb-1.5">
                  <input placeholder="Task title" value={t.title} onChange={(e) => updateTask(i, "title", e.target.value)} className={inputCls} />
                  {tasks.length > 1 && <button onClick={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))} className={removeBtnCls}>Remove</button>}
                </div>
                <div className="flex gap-2">
                  <input placeholder="Owner" value={t.owner} onChange={(e) => updateTask(i, "owner", e.target.value)} className={inputCls} />
                  <input type="date" value={t.due_date} onChange={(e) => updateTask(i, "due_date", e.target.value)} className={inputCls + " w-auto"} />
                  <select value={t.priority} onChange={(e) => updateTask(i, "priority", e.target.value)} className={inputCls + " w-auto"}>
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Workflows */}
          <div className={sectionCls}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Workflows</div>
              <button onClick={() => setManualWorkflows((prev) => [...prev, emptyWorkflow()])} className={addBtnCls}>+ Add workflow</button>
            </div>
            {manualWorkflows.length === 0 && (
              <div className="text-xs text-zinc-400">No workflows. Add one to group sequential steps.</div>
            )}
            {manualWorkflows.map((w, wi) => (
              <div key={wi} className="mb-3 p-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                <div className="flex gap-2 mb-1.5">
                  <input
                    placeholder="Workflow name"
                    value={w.name}
                    onChange={(e) => setManualWorkflows((prev) => prev.map((wf, idx) => idx === wi ? { ...wf, name: e.target.value } : wf))}
                    className={inputCls + " font-semibold"}
                  />
                  <button onClick={() => setManualWorkflows((prev) => prev.filter((_, idx) => idx !== wi))} className={removeBtnCls}>Remove</button>
                </div>
                <input
                  placeholder="Description (optional)"
                  value={w.description}
                  onChange={(e) => setManualWorkflows((prev) => prev.map((wf, idx) => idx === wi ? { ...wf, description: e.target.value } : wf))}
                  className={inputCls + " mb-2"}
                />
                <div className="ml-2">
                  <div className="text-[11px] text-zinc-400 mb-1">Steps (in order):</div>
                  {w.steps.map((s, si) => (
                    <div key={si}>
                      {s.depends_on_prior && (
                        <div className="flex items-center gap-2 py-1 my-0.5">
                          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                          <span className="text-[10px] text-zinc-400 whitespace-nowrap flex items-center gap-1">
                            <Unlock className="w-2.5 h-2.5" /> unlocks after above
                          </span>
                          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                      )}
                      <div className={`flex gap-1.5 mb-1 items-center ${s.depends_on_prior ? "opacity-70" : ""}`}>
                        <span className="text-[11px] text-zinc-400 w-4">{si + 1}.</span>
                        <input
                          placeholder="Step title"
                          value={s.title}
                          onChange={(e) => {
                            setManualWorkflows((prev) => prev.map((wf, idx) => {
                              if (idx !== wi) return wf;
                              const steps = [...wf.steps];
                              steps[si] = { ...steps[si], title: e.target.value };
                              return { ...wf, steps };
                            }));
                          }}
                          className={inputCls}
                        />
                        <input
                          placeholder="Owner"
                          value={s.owner}
                          onChange={(e) => {
                            setManualWorkflows((prev) => prev.map((wf, idx) => {
                              if (idx !== wi) return wf;
                              const steps = [...wf.steps];
                              steps[si] = { ...steps[si], owner: e.target.value };
                              return { ...wf, steps };
                            }));
                          }}
                          className={inputCls + " w-20"}
                        />
                        {si > 0 && (
                          <button
                            onClick={() => {
                              setManualWorkflows((prev) => prev.map((wf, idx) => {
                                if (idx !== wi) return wf;
                                const steps = [...wf.steps];
                                steps[si] = { ...steps[si], depends_on_prior: !steps[si].depends_on_prior };
                                return { ...wf, steps };
                              }));
                            }}
                            title={s.depends_on_prior ? "Remove lock (allow anytime)" : "Lock until prior steps complete"}
                            className={`p-1 rounded cursor-pointer border transition-colors ${
                              s.depends_on_prior
                                ? "bg-red-50 dark:bg-red-950/30 text-red-500 border-red-200 dark:border-red-800"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700"
                            }`}
                          >
                            {s.depends_on_prior ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                        )}
                        {w.steps.length > 1 && (
                          <button
                            onClick={() => {
                              setManualWorkflows((prev) => prev.map((wf, idx) => {
                                if (idx !== wi) return wf;
                                return { ...wf, steps: wf.steps.filter((_, i) => i !== si) };
                              }));
                            }}
                            className="p-0 bg-transparent border-0 cursor-pointer text-zinc-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setManualWorkflows((prev) => prev.map((wf, idx) => {
                        if (idx !== wi) return wf;
                        return { ...wf, steps: [...wf.steps, { title: "", owner: "", depends_on_prior: false }] };
                      }));
                    }}
                    className={addBtnCls + " mt-1"}
                  >
                    + Add step
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Next Steps */}
          <div className={sectionCls}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Next Steps</div>
              <button onClick={() => setNextSteps((prev) => [...prev, ""])} className={addBtnCls}>+ Add</button>
            </div>
            {nextSteps.map((s, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input placeholder="Next step..." value={s} onChange={(e) => setNextSteps((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))} className={inputCls} />
                {nextSteps.length > 1 && <button onClick={() => setNextSteps((prev) => prev.filter((_, idx) => idx !== i))} className={removeBtnCls}>Remove</button>}
              </div>
            ))}
          </div>

          {/* Blockers */}
          <div className={sectionCls}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Blockers</div>
              <button onClick={() => setBlockers((prev) => [...prev, ""])} className={addBtnCls}>+ Add</button>
            </div>
            {blockers.map((b, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input placeholder="Blocker..." value={b} onChange={(e) => setBlockers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))} className={inputCls} />
                {blockers.length > 1 && <button onClick={() => setBlockers((prev) => prev.filter((_, idx) => idx !== i))} className={removeBtnCls}>Remove</button>}
              </div>
            ))}
          </div>

          {/* Follow-ups */}
          <div className={sectionCls}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Follow-ups</div>
              <button onClick={() => setFollowUps((prev) => [...prev, emptyFollowUp()])} className={addBtnCls}>+ Add</button>
            </div>
            {followUps.map((f, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input placeholder="Follow-up description" value={f.description} onChange={(e) => updateFollowUp(i, "description", e.target.value)} className={inputCls} />
                <input placeholder="Owner" value={f.owner} onChange={(e) => updateFollowUp(i, "owner", e.target.value)} className={inputCls + " w-28"} />
                <input type="date" value={f.due_date} onChange={(e) => updateFollowUp(i, "due_date", e.target.value)} className={inputCls + " w-auto"} />
                {followUps.length > 1 && <button onClick={() => setFollowUps((prev) => prev.filter((_, idx) => idx !== i))} className={removeBtnCls}>Remove</button>}
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2 mb-0">{error}</p>}
          <button
            onClick={handleSubmitManual}
            disabled={loading}
            className="mt-1 px-4 py-2 text-sm font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors cursor-pointer border-0"
          >
            {loading ? "Saving..." : "Save Capture"}
          </button>
        </div>
      )}
    </div>
  );
}
