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

      {captures.map((cap) => (
        <div
          key={cap.id}
          style={{
            marginBottom: "0.5rem",
            border: "1px solid #e2e2e2",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem",
            }}
          >
            {/* Content - clickable link */}
            <Link
              to={`/captures/${cap.id}`}
              style={{ flex: 1, textDecoration: "none", color: "inherit", minWidth: 0 }}
            >
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                <strong>{cap.extraction?.summary || cap.normalized_text?.slice(0, 80) || "Capture"}</strong>
              </div>
              <div style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                {cap.source} | {cap.content_type} | {new Date(cap.captured_at).toLocaleString()}
              </div>
            </Link>

            {/* Action buttons — always aligned right */}
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 }}>
              {/* Status badge */}
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "3px",
                  background: cap.status === "review" ? "#fef3c7" : cap.status === "approved" ? "#dcfce7" : "#f3f4f6",
                  color: cap.status === "review" ? "#92400e" : cap.status === "approved" ? "#166534" : "#555",
                }}
              >
                {cap.status}
              </span>

              {/* Review toggle for review captures */}
              {cap.status === "review" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(expandedId === cap.id ? null : cap.id);
                  }}
                  style={{ ...btnStyle, background: "#3b82f6", color: "white" }}
                >
                  Review
                </button>
              )}

              {/* Reopen for approved captures */}
              {cap.status === "approved" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reopenCapture(cap.id);
                  }}
                  style={{ ...btnStyle, background: "transparent", border: "1px solid #d1d5db", color: "#666" }}
                >
                  Reopen
                </button>
              )}

              {/* Trash */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  trashCapture(cap.id);
                }}
                title="Move to trash"
                style={{ ...btnStyle, background: "transparent", border: "1px solid #d1d5db", color: "#999" }}
              >
                Trash
              </button>
            </div>
          </div>

          {/* Inline review panel — expanded */}
          {expandedId === cap.id && cap.status === "review" && cap.extraction && (
            <div
              style={{
                borderTop: "1px solid #e2e2e2",
                padding: "0.75rem",
                background: "#fafafa",
              }}
            >
              <ReviewPanel
                captureId={cap.id}
                extraction={cap.extraction}
                onReviewComplete={() => {
                  setExpandedId(null);
                  loadCaptures();
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
