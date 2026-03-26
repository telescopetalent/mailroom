import { useState } from "react";
import { api } from "../api/client";

interface CaptureInputProps {
  onCaptureCreated: () => void;
}

export default function CaptureInput({ onCaptureCreated }: CaptureInputProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) return;

    setLoading(true);
    setError("");

    try {
      await api("/captures", {
        method: "POST",
        body: JSON.stringify({
          source: "web",
          content_text: text,
        }),
      });
      setText("");
      onCaptureCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      <h3>Capture</h3>
      <textarea
        placeholder="Paste meeting notes, emails, messages, or any text with action items..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{
          width: "100%",
          padding: "0.75rem",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          border: "1px solid #ccc",
          borderRadius: "4px",
          boxSizing: "border-box",
          resize: "vertical",
        }}
      />
      {error && <p style={{ color: "red", margin: "0.5rem 0" }}>{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading || !text.trim()}
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1.5rem",
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Processing..." : "Send to Mailroom"}
      </button>
    </div>
  );
}
