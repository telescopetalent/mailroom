import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiKey, setApiKey } from "../api/client";
import CaptureInput from "../components/CaptureInput";
import ReviewPanel from "../components/ReviewPanel";

interface Extraction {
  id: string;
  summary: string | null;
  next_steps: string[];
  tasks: { title: string; description?: string; owner?: string; due_date?: string; priority?: string }[];
  workflows: { name: string; description?: string; steps: { title: string; owner?: string; due_date?: string; priority?: string }[] }[];
  blockers: string[];
  follow_ups: { description: string; owner?: string; due_date?: string }[];
  priority: string;
}

interface CaptureItem {
  id: string;
  source: string;
  content_type: string;
  status: string;
  captured_at: string;
  normalized_text: string | null;
  extraction: Extraction | null;
}

interface CaptureList {
  items: CaptureItem[];
  pagination: { total_count: number };
}

const btnStyle: React.CSSProperties = {
  padding: "0.3rem 0.6rem",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "0.8rem",
  flexShrink: 0,
  border: "none",
};

export default function Dashboard() {
  const [connected, setConnected] = useState(!!getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingCaptures, setLoadingCaptures] = useState(false);

  const loadCaptures = () => {
    setLoadingCaptures(true);
    api<CaptureList>("/captures")
      .then((data) => setCaptures(data.items))
      .catch(() => {})
      .finally(() => setLoadingCaptures(false));
  };

  useEffect(() => {
    if (connected) {
      api<{ email: string; name: string }>("/users/me")
        .then((u) => {
          setUser(u);
          loadCaptures();
        })
        .catch((e) => {
          setError(e.message);
          setConnected(false);
        });
    }
  }, [connected]);

  const trashCapture = async (id: string) => {
    await api(`/captures/${id}/trash`, { method: "POST" });
    loadCaptures();
  };

  const reopenCapture = async (id: string) => {
    await api(`/captures/${id}/reopen`, { method: "POST" });
    loadCaptures();
  };

  if (!connected) {
    return (
      <div style={{ maxWidth: 400, margin: "4rem auto" }}>
        <h2>Connect to Mailroom</h2>
        <p style={{ color: "#666" }}>Enter your API key to get started.</p>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <input
          type="text"
          placeholder="mr_..."
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem", boxSizing: "border-box" }}
        />
        <button
          onClick={() => {
            setApiKey(keyInput);
            setConnected(true);
            setError("");
          }}
          style={{ padding: "0.5rem 1rem" }}
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {user && (
        <p style={{ color: "#666" }}>
          Signed in as <strong>{user.name}</strong> ({user.email})
        </p>
      )}

      <CaptureInput onCaptureCreated={loadCaptures} />

      <h3>Recent Captures</h3>
      {loadingCaptures && <p style={{ color: "#888" }}>Loading...</p>}
      {!loadingCaptures && captures.length === 0 && <p style={{ color: "#888" }}>No captures yet. Paste some text above to get started.</p>}

      {captures.map((cap) => {
        const statusColor = cap.status === "review" ? "#f59e0b" : cap.status === "approved" ? "#22c55e" : "#d1d5db";
        const workflowCount = (cap.extraction?.workflows || []).length;
        const taskCount = (cap.extraction?.tasks || []).length;

        return (
          <div
            key={cap.id}
            style={{
              marginBottom: "0.75rem",
              background: "white",
              borderRadius: "10px",
              border: "1px solid #f0f0f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            {/* Card body */}
            <div style={{ padding: "0.85rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                {/* Status circle */}
                <div
                  style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: `2px solid ${statusColor}`,
                    background: cap.status === "approved" ? statusColor : "transparent",
                    flexShrink: 0, marginTop: 2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {cap.status === "approved" && <span style={{ color: "white", fontSize: "0.6rem" }}>{"\u2713"}</span>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title */}
                  <Link
                    to={`/captures/${cap.id}`}
                    style={{
                      textDecoration: "none",
                      color: "#1a1a1a",
                      fontWeight: 500,
                      fontSize: "0.95rem",
                      display: "block",
                      lineHeight: 1.35,
                    }}
                  >
                    {cap.extraction?.summary || cap.normalized_text?.slice(0, 100) || "Capture"}
                  </Link>

                  {/* Metadata row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.35rem", fontSize: "0.78rem", flexWrap: "wrap" }}>
                    <span style={{ color: "#7c3aed" }}>{"\u{1F4C5}"} {new Date(cap.captured_at).toLocaleDateString()}</span>
                    {cap.source !== "web" && <span style={{ color: "#888" }}>{cap.source}</span>}
                    {workflowCount > 0 && <span style={{ color: "#7c3aed" }}>{"\u{1F517}"} {workflowCount} workflow{workflowCount > 1 ? "s" : ""}</span>}
                    {taskCount > 0 && <span style={{ color: "#888" }}>{taskCount} task{taskCount > 1 ? "s" : ""}</span>}
                  </div>

                  {/* Tags */}
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                    <span style={{
                      background: cap.status === "review" ? "#fef3c7" : cap.status === "approved" ? "#dcfce7" : "#f3f4f6",
                      color: cap.status === "review" ? "#92400e" : cap.status === "approved" ? "#166534" : "#555",
                      padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.72rem",
                    }}>
                      {cap.status}
                    </span>
                    <span style={{ background: "#f3f4f6", color: "#666", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.72rem" }}>
                      {cap.content_type}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexShrink: 0 }}>
                  {cap.status === "review" && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedId(expandedId === cap.id ? null : cap.id); }}
                      style={{ ...btnStyle, background: "#7c3aed", color: "white", borderRadius: "6px" }}
                    >
                      Review
                    </button>
                  )}
                  {cap.status === "approved" && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); reopenCapture(cap.id); }}
                      style={{ ...btnStyle, background: "transparent", border: "1px solid #e5e7eb", color: "#888", borderRadius: "6px" }}
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); trashCapture(cap.id); }}
                    title="Move to trash"
                    style={{ ...btnStyle, background: "transparent", border: "1px solid #e5e7eb", color: "#bbb", borderRadius: "6px", fontSize: "0.75rem" }}
                  >
                    {"\u{1F5D1}"}
                  </button>
                </div>
              </div>
            </div>

            {/* Inline review panel — expanded */}
            {expandedId === cap.id && cap.status === "review" && cap.extraction && (
              <div style={{ borderTop: "1px solid #f0f0f0", padding: "0.85rem 1rem", background: "#fafafa" }}>
                <ReviewPanel
                  captureId={cap.id}
                  extraction={cap.extraction}
                  onReviewComplete={() => { setExpandedId(null); loadCaptures(); }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
