import { useEffect, useState } from "react";
import { api } from "../api/client";

interface TrashedCapture {
  id: string;
  source: string;
  content_type: string;
  status: string;
  captured_at: string;
  trashed_at: string | null;
  previous_status: string | null;
  normalized_text: string | null;
  extraction: { summary: string | null } | null;
}

interface TrashedList {
  items: TrashedCapture[];
  pagination: { total_count: number };
}

export default function Trash() {
  const [captures, setCaptures] = useState<TrashedCapture[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api<TrashedList>("/captures/trash")
      .then((data) => {
        setCaptures(data.items);
        setSelected(new Set());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === captures.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(captures.map((c) => c.id)));
    }
  };

  const restoreCapture = async (id: string) => {
    await api(`/captures/${id}/restore`, { method: "POST" });
    load();
  };

  const deleteCapture = async (id: string) => {
    await api(`/captures/${id}`, { method: "DELETE" });
    load();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Permanently delete ${selected.size} capture${selected.size > 1 ? "s" : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    if (selected.size === captures.length) {
      await api("/captures/trash/delete-all", { method: "POST" });
    } else {
      for (const id of selected) {
        await api(`/captures/${id}`, { method: "DELETE" });
      }
    }
    load();
  };

  const deleteAll = async () => {
    if (captures.length === 0) return;
    const confirmed = window.confirm(
      `Permanently delete all ${captures.length} trashed capture${captures.length > 1 ? "s" : ""}? This cannot be undone.`
    );
    if (!confirmed) return;
    await api("/captures/trash/delete-all", { method: "POST" });
    load();
  };

  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ maxWidth: 700 }}>
      <h2>Trash</h2>

      {loading ? (
        <p>Loading...</p>
      ) : captures.length === 0 ? (
        <p style={{ color: "#888" }}>Trash is empty.</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              padding: "0.5rem 0",
              borderBottom: "1px solid #e2e2e2",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selected.size === captures.length && captures.length > 0}
                onChange={selectAll}
              />
              Select all ({captures.length})
            </label>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {selected.size > 0 && (
                <button
                  onClick={deleteSelected}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Delete selected ({selected.size})
                </button>
              )}
              <button
                onClick={deleteAll}
                style={{
                  padding: "0.4rem 0.75rem",
                  background: "#991b1b",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Empty trash
              </button>
            </div>
          </div>

          {captures.map((cap) => (
            <div
              key={cap.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                marginBottom: "0.5rem",
                border: "1px solid #e2e2e2",
                borderRadius: "4px",
                background: selected.has(cap.id) ? "#fef2f2" : "white",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(cap.id)}
                onChange={() => toggleSelect(cap.id)}
              />
              <div style={{ flex: 1 }}>
                <strong>
                  {cap.extraction?.summary || cap.normalized_text?.slice(0, 80) || "Capture"}
                </strong>
                <div style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {cap.source} | {cap.content_type} |
                  Trashed {cap.trashed_at ? new Date(cap.trashed_at).toLocaleString() : ""}
                  {cap.previous_status && (
                    <span> | was: {cap.previous_status}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => restoreCapture(cap.id)}
                  style={{
                    padding: "0.3rem 0.6rem",
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Restore
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Permanently delete this capture?")) {
                      deleteCapture(cap.id);
                    }
                  }}
                  style={{
                    padding: "0.3rem 0.6rem",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    color: "#dc2626",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
