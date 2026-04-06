import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import ReviewPanel from "../components/ReviewPanel";

interface CaptureData {
  id: string;
  source: string;
  content_type: string;
  normalized_text: string | null;
  status: string;
  captured_at: string;
  extraction: {
    id: string;
    summary: string | null;
    tasks: { title: string; description?: string; owner?: string; due_date?: string; priority?: string }[];
    workflows: { name: string; description?: string; steps: { title: string; description?: string; owner?: string; due_date?: string; priority?: string }[] }[];
    next_steps: string[];
    blockers: string[];
    follow_ups: { description: string; owner?: string; due_date?: string }[];
    priority: string;
  } | null;
}

export default function CaptureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [capture, setCapture] = useState<CaptureData | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    if (!id) return;
    api<CaptureData>(`/captures/${id}`)
      .then(setCapture)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!capture) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/" style={{ color: "#555" }}>Back to Dashboard</Link>
        {capture.status !== "trashed" && (
          <button
            onClick={async () => {
              await api(`/captures/${capture.id}/trash`, { method: "POST" });
              navigate("/");
            }}
            style={{
              padding: "0.3rem 0.7rem",
              background: "transparent",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "#999",
            }}
          >
            Move to Trash
          </button>
        )}
      </div>

      <h2 style={{ marginTop: "1rem" }}>Capture</h2>

      <div style={{ display: "flex", gap: "1rem", color: "#666", fontSize: "0.85rem", marginBottom: "1rem" }}>
        <span>Source: {capture.source}</span>
        <span>Type: {capture.content_type}</span>
        <span>Status: <strong>{capture.status}</strong></span>
        <span>{new Date(capture.captured_at).toLocaleString()}</span>
      </div>

      {capture.normalized_text && (
        <pre style={{ background: "#f8f9fa", padding: "1rem", borderRadius: "4px", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
          {capture.normalized_text}
        </pre>
      )}

      {capture.extraction && capture.status === "review" && (
        <>
          <h3 style={{ marginTop: "1.5rem" }}>Review Extraction</h3>
          <ReviewPanel captureId={capture.id} extraction={capture.extraction} onReviewComplete={load} />
        </>
      )}

      {capture.extraction && capture.status === "approved" && (
        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f0fdf4", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Approved</strong> — items saved as tasks.{" "}
            <Link to="/tasks">View tasks</Link>
          </div>
          <button
            onClick={async () => {
              await api(`/captures/${capture.id}/reopen`, { method: "POST" });
              load();
            }}
            style={{
              padding: "0.3rem 0.7rem",
              background: "transparent",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "#666",
            }}
          >
            Reopen for Review
          </button>
        </div>
      )}
    </div>
  );
}
