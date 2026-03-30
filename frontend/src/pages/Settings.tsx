import { useEffect, useState } from "react";
import { api } from "../api/client";

interface WorkspaceSettings {
  id: string;
  name: string;
  trash_retention_days: number;
}

export default function Settings() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<WorkspaceSettings>("/workspaces/current")
      .then((data) => {
        setSettings(data);
        setRetentionDays(data.trash_retention_days);
      })
      .catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await api<WorkspaceSettings>("/workspaces/current/settings", {
        method: "PATCH",
        body: JSON.stringify({ trash_retention_days: retentionDays }),
      });
      setSettings(updated);
      setRetentionDays(updated.trash_retention_days);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !error) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 500 }}>
      <h2>Settings</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #e2e2e2",
          borderRadius: "6px",
          background: "white",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Trash</h3>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          Captures in the trash will be automatically deleted after the retention period.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
          <label style={{ fontWeight: 500 }}>Retention period:</label>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            style={{ padding: "0.4rem 0.5rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={save}
            disabled={saving || (settings && retentionDays === settings.trash_retention_days)}
            style={{
              padding: "0.5rem 1rem",
              background:
                saving || (settings && retentionDays === settings.trash_retention_days)
                  ? "#e5e7eb"
                  : "#111",
              color:
                saving || (settings && retentionDays === settings.trash_retention_days)
                  ? "#9ca3af"
                  : "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                saving || (settings && retentionDays === settings.trash_retention_days)
                  ? "default"
                  : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && <span style={{ color: "#16a34a", fontSize: "0.85rem" }}>Saved!</span>}
        </div>
      </div>
    </div>
  );
}
