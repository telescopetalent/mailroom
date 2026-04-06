import { useState, useRef, useCallback } from "react";
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

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  fontSize: "0.9rem",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#666",
  marginBottom: "0.2rem",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "1rem",
  padding: "0.75rem",
  background: "#f9fafb",
  borderRadius: "6px",
  border: "1px solid #e5e7eb",
};

export default function CaptureInput({ onCaptureCreated }: CaptureInputProps) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // File upload state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = [
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

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
        // Use FormData upload for files
        const formData = new FormData();
        formData.append("metadata", JSON.stringify({
          source: "web",
          content_text: text || undefined,
          mode: "ai",
        }));
        for (const f of files) {
          formData.append("files", f);
        }
        await apiUpload("/captures/upload", formData);
      } else {
        // Text-only — use existing JSON endpoint
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
    const filteredTasks = tasks
      .filter((t) => t.title.trim())
      .map((t) => ({
        title: t.title,
        owner: t.owner || undefined,
        due_date: t.due_date || undefined,
        priority: t.priority,
      }));
    const filteredNextSteps = nextSteps.filter((s) => s.trim());
    const filteredBlockers = blockers.filter((b) => b.trim());
    const filteredFollowUps = followUps
      .filter((f) => f.description.trim())
      .map((f) => ({
        description: f.description,
        owner: f.owner || undefined,
        due_date: f.due_date || undefined,
      }));

    const filteredWorkflows = manualWorkflows
      .filter((w) => w.name.trim() && w.steps.some((s) => s.title.trim()))
      .map((w) => ({
        name: w.name,
        description: w.description || undefined,
        steps: w.steps.filter((s) => s.title.trim()).map((s) => ({
          title: s.title,
          owner: s.owner || undefined,
          depends_on_prior: s.depends_on_prior || undefined,
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
          source: "web",
          content_text: summary || "Manual capture",
          mode: "manual",
          manual_extraction: {
            summary: summary || undefined,
            tasks: filteredTasks,
            workflows: filteredWorkflows,
            next_steps: filteredNextSteps,
            blockers: filteredBlockers,
            follow_ups: filteredFollowUps,
            priority,
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
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0 }}>Capture</h3>
        <div
          style={{
            display: "flex",
            background: "#f3f4f6",
            borderRadius: "6px",
            padding: "2px",
          }}
        >
          <button
            onClick={() => setMode("ai")}
            style={{
              padding: "0.3rem 0.75rem",
              fontSize: "0.85rem",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: mode === "ai" ? "#111" : "transparent",
              color: mode === "ai" ? "white" : "#666",
              fontWeight: mode === "ai" ? 600 : 400,
            }}
          >
            AI
          </button>
          <button
            onClick={() => setMode("manual")}
            style={{
              padding: "0.3rem 0.75rem",
              fontSize: "0.85rem",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: mode === "manual" ? "#111" : "transparent",
              color: mode === "manual" ? "white" : "#666",
              fontWeight: mode === "manual" ? 600 : 400,
            }}
          >
            Manual
          </button>
        </div>
      </div>

      {mode === "ai" ? (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            style={{
              border: isDragOver ? "2px dashed #3b82f6" : "1px solid #ccc",
              borderRadius: "4px",
              background: isDragOver ? "#eff6ff" : "white",
              transition: "all 0.15s",
            }}
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
              rows={6}
              style={{
                width: "100%",
                padding: "0.75rem",
                fontFamily: "inherit",
                fontSize: "0.95rem",
                border: "none",
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
                background: "transparent",
              }}
            />

            {files.length === 0 && (
              <div style={{ padding: "0 0.75rem 0.5rem", color: "#aaa", fontSize: "0.8rem" }}>
                Drop images, PDFs, or DOCX files here
                <span
                  onClick={() => fileInputRef.current?.click()}
                  style={{ color: "#3b82f6", cursor: "pointer", marginLeft: "0.5rem" }}
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
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />

          {/* File previews */}
          {files.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {files.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.3rem 0.6rem",
                    background: "#f3f4f6",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {f.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "2px" }}
                    />
                  ) : (
                    <span style={{ fontSize: "1rem" }}>{f.type.includes("pdf") ? "\u{1F4C4}" : "\u{1F4DD}"}</span>
                  )}
                  <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </span>
                  <span style={{ color: "#999" }}>({(f.size / 1024).toFixed(0)}KB)</span>
                  <button
                    onClick={() => removeFile(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "0.9rem", padding: 0 }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ color: "red", margin: "0.5rem 0" }}>{error}</p>}
          <button
            onClick={handleSubmitAI}
            disabled={loading || (!text.trim() && files.length === 0)}
            style={{ marginTop: "0.5rem", padding: "0.5rem 1.5rem", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Processing..." : "Send to Mailroom"}
          </button>
        </>
      ) : (
        <div>
          {/* Summary */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Summary</div>
            <textarea
              placeholder="Brief summary of this capture..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>

          {/* Priority */}
          <div style={{ ...sectionStyle, display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={labelStyle}>Priority</div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={inputStyle}
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Tasks */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Tasks</div>
              <button
                onClick={() => setTasks((prev) => [...prev, emptyTask()])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add task
              </button>
            </div>
            {tasks.map((t, i) => (
              <div key={i} style={{ marginBottom: "0.5rem", padding: "0.5rem", background: "white", borderRadius: "4px", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  <input
                    placeholder="Task title"
                    value={t.title}
                    onChange={(e) => updateTask(i, "title", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {tasks.length > 1 && (
                    <button
                      onClick={() => setTasks((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    placeholder="Owner"
                    value={t.owner}
                    onChange={(e) => updateTask(i, "owner", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="date"
                    value={t.due_date}
                    onChange={(e) => updateTask(i, "due_date", e.target.value)}
                    style={{ ...inputStyle }}
                  />
                  <select
                    value={t.priority}
                    onChange={(e) => updateTask(i, "priority", e.target.value)}
                    style={{ ...inputStyle }}
                  >
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
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Workflows</div>
              <button
                onClick={() => setManualWorkflows((prev) => [...prev, emptyWorkflow()])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add workflow
              </button>
            </div>
            {manualWorkflows.length === 0 && (
              <div style={{ color: "#aaa", fontSize: "0.8rem" }}>No workflows. Add one to group sequential steps.</div>
            )}
            {manualWorkflows.map((w, wi) => (
              <div key={wi} style={{ marginBottom: "0.75rem", padding: "0.5rem", background: "white", borderRadius: "4px", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  <input
                    placeholder="Workflow name"
                    value={w.name}
                    onChange={(e) => setManualWorkflows((prev) => prev.map((wf, idx) => idx === wi ? { ...wf, name: e.target.value } : wf))}
                    style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
                  />
                  <button
                    onClick={() => setManualWorkflows((prev) => prev.filter((_, idx) => idx !== wi))}
                    style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Remove
                  </button>
                </div>
                <input
                  placeholder="Description (optional)"
                  value={w.description}
                  onChange={(e) => setManualWorkflows((prev) => prev.map((wf, idx) => idx === wi ? { ...wf, description: e.target.value } : wf))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: "0.4rem" }}
                />
                <div style={{ marginLeft: "0.5rem" }}>
                  <div style={{ ...labelStyle, fontSize: "0.75rem", marginBottom: "0.3rem" }}>Steps (in order):</div>
                  {w.steps.map((s, si) => (
                    <div key={si}>
                      {/* Divider for blocked steps */}
                      {s.depends_on_prior && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0 0.15rem", margin: "0.15rem 0" }}>
                          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                          <span style={{ fontSize: "0.65rem", color: "#999", whiteSpace: "nowrap" }}>{"\u{1F513}"} unlocks after above</span>
                          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.3rem", alignItems: "center", opacity: s.depends_on_prior ? 0.7 : 1 }}>
                        <span style={{ color: "#999", fontSize: "0.75rem", width: "1.2rem" }}>{si + 1}.</span>
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
                          style={{ ...inputStyle, flex: 1 }}
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
                          style={{ ...inputStyle, width: "80px" }}
                        />
                        {/* Lock toggle */}
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
                            style={{
                              fontSize: "0.75rem", padding: "0.15rem 0.3rem", cursor: "pointer",
                              background: s.depends_on_prior ? "#fef2f2" : "#f3f4f6",
                              color: s.depends_on_prior ? "#dc2626" : "#999",
                              border: s.depends_on_prior ? "1px solid #fca5a5" : "1px solid #e5e7eb",
                              borderRadius: "3px",
                            }}
                          >
                            {s.depends_on_prior ? "\u{1F512}" : "\u{1F513}"}
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
                            style={{ fontSize: "0.7rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                          >
                            x
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
                    style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", cursor: "pointer", marginTop: "0.2rem" }}
                  >
                    + Add step
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Next Steps */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Next Steps</div>
              <button
                onClick={() => setNextSteps((prev) => [...prev, ""])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            {nextSteps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input
                  placeholder="Next step..."
                  value={s}
                  onChange={(e) => setNextSteps((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {nextSteps.length > 1 && (
                  <button
                    onClick={() => setNextSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Blockers */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Blockers</div>
              <button
                onClick={() => setBlockers((prev) => [...prev, ""])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            {blockers.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input
                  placeholder="Blocker..."
                  value={b}
                  onChange={(e) => setBlockers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {blockers.length > 1 && (
                  <button
                    onClick={() => setBlockers((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Follow-ups */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ ...labelStyle, fontWeight: 600, margin: 0 }}>Follow-ups</div>
              <button
                onClick={() => setFollowUps((prev) => [...prev, emptyFollowUp()])}
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            {followUps.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <input
                  placeholder="Follow-up description"
                  value={f.description}
                  onChange={(e) => updateFollowUp(i, "description", e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  placeholder="Owner"
                  value={f.owner}
                  onChange={(e) => updateFollowUp(i, "owner", e.target.value)}
                  style={{ ...inputStyle, width: "120px" }}
                />
                <input
                  type="date"
                  value={f.due_date}
                  onChange={(e) => updateFollowUp(i, "due_date", e.target.value)}
                  style={inputStyle}
                />
                {followUps.length > 1 && (
                  <button
                    onClick={() => setFollowUps((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: "0.8rem", color: "#999", cursor: "pointer", background: "none", border: "none" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && <p style={{ color: "red", margin: "0.5rem 0" }}>{error}</p>}
          <button
            onClick={handleSubmitManual}
            disabled={loading}
            style={{ padding: "0.5rem 1.5rem", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Saving..." : "Save Capture"}
          </button>
        </div>
      )}
    </div>
  );
}
