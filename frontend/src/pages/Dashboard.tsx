import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiKey, setApiKey } from "../api/client";
import CaptureInput from "../components/CaptureInput";

interface CaptureItem {
  id: string;
  source: string;
  content_type: string;
  status: string;
  captured_at: string;
  normalized_text: string | null;
  extraction: { summary: string | null } | null;
}

interface CaptureList {
  items: CaptureItem[];
  pagination: { total_count: number };
}

export default function Dashboard() {
  const [connected, setConnected] = useState(!!getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [error, setError] = useState("");

  const loadCaptures = () => {
    api<CaptureList>("/captures")
      .then((data) => setCaptures(data.items))
      .catch(() => {});
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
      {captures.length === 0 && <p style={{ color: "#888" }}>No captures yet. Paste some text above to get started.</p>}

      {captures.map((cap) => (
        <Link
          key={cap.id}
          to={`/captures/${cap.id}`}
          style={{
            display: "block",
            padding: "0.75rem",
            marginBottom: "0.5rem",
            border: "1px solid #e2e2e2",
            borderRadius: "4px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{cap.extraction?.summary || cap.normalized_text?.slice(0, 80) || "Capture"}</strong>
            </div>
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
          </div>
          <div style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.25rem" }}>
            {cap.source} | {cap.content_type} | {new Date(cap.captured_at).toLocaleString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
