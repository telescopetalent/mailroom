import { useEffect, useState } from "react";
import { api } from "../api/client";

interface WorkspaceSettings {
  id: string;
  name: string;
  trash_retention_days: number;
}

interface SurfaceConnection {
  id: string;
  surface: string;
  external_id: string;
  config: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
}

interface SurfaceConnectionList {
  items: SurfaceConnection[];
}

const cardStyle: React.CSSProperties = {
  padding: "1.5rem",
  border: "1px solid #e2e2e2",
  borderRadius: "6px",
  background: "white",
  marginBottom: "1.5rem",
};

export default function Settings() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Surface connections state
  const [connections, setConnections] = useState<SurfaceConnection[]>([]);
  const [newSurface, setNewSurface] = useState("email");
  const [newExternalId, setNewExternalId] = useState("");
  const [addingConnection, setAddingConnection] = useState(false);

  useEffect(() => {
    api<WorkspaceSettings>("/workspaces/current")
      .then((data) => {
        setSettings(data);
        setRetentionDays(data.trash_retention_days);
      })
      .catch((e) => setError(e.message));

    loadConnections();
  }, []);

  const loadConnections = () => {
    api<SurfaceConnectionList>("/surface-connections")
      .then((data) => setConnections(data.items))
      .catch(() => {});
  };

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const addConnection = async () => {
    if (!newExternalId.trim()) return;
    setAddingConnection(true);
    setError("");
    try {
      await api("/surface-connections", {
        method: "POST",
        body: JSON.stringify({ surface: newSurface, external_id: newExternalId.trim() }),
      });
      setNewExternalId("");
      loadConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAddingConnection(false);
    }
  };

  const toggleConnection = async (conn: SurfaceConnection) => {
    try {
      await api(`/surface-connections/${conn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !conn.is_active }),
      });
      loadConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const removeConnection = async (id: string) => {
    if (!window.confirm("Remove this connection?")) return;
    try {
      await api(`/surface-connections/${id}`, { method: "DELETE" });
      loadConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  if (!settings && !error) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 500 }}>
      <h2>Settings</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Trash settings */}
      <div style={cardStyle}>
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
            disabled={saving || !!(settings && retentionDays === settings.trash_retention_days)}
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

      {/* Connected Surfaces */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Connected Surfaces</h3>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          Connect email addresses and Slack workspaces to capture content from external surfaces.
        </p>

        {/* Existing connections */}
        {connections.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            {connections.map((conn) => (
              <div
                key={conn.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.75rem",
                  marginBottom: "0.5rem",
                  background: "#f9fafb",
                  borderRadius: "4px",
                  border: "1px solid #e5e7eb",
                  opacity: conn.is_active ? 1 : 0.5,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "3px",
                      background: conn.surface === "email" ? "#dbeafe" : "#fce7f3",
                      color: conn.surface === "email" ? "#1e40af" : "#9d174d",
                      marginRight: "0.5rem",
                      fontWeight: 600,
                    }}
                  >
                    {conn.surface}
                  </span>
                  <span style={{ fontSize: "0.9rem" }}>{conn.external_id}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    onClick={() => toggleConnection(conn)}
                    style={{
                      fontSize: "0.8rem",
                      padding: "0.2rem 0.5rem",
                      background: "transparent",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      cursor: "pointer",
                      color: "#666",
                    }}
                  >
                    {conn.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => removeConnection(conn.id)}
                    style={{
                      fontSize: "0.8rem",
                      padding: "0.2rem 0.5rem",
                      background: "transparent",
                      border: "1px solid #fca5a5",
                      borderRadius: "4px",
                      cursor: "pointer",
                      color: "#dc2626",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add connection form */}
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "#f9fafb",
            borderRadius: "4px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "#444" }}>
            Add Connection
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select
              value={newSurface}
              onChange={(e) => setNewSurface(e.target.value)}
              style={{ padding: "0.4rem 0.5rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
            </select>
            <input
              type="text"
              placeholder={newSurface === "email" ? "user@example.com" : "Slack Team ID (e.g. T01ABC)"}
              value={newExternalId}
              onChange={(e) => setNewExternalId(e.target.value)}
              style={{
                flex: 1,
                padding: "0.4rem 0.5rem",
                borderRadius: "4px",
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
              }}
            />
            <button
              onClick={addConnection}
              disabled={addingConnection || !newExternalId.trim()}
              style={{
                padding: "0.4rem 0.75rem",
                background: addingConnection || !newExternalId.trim() ? "#e5e7eb" : "#111",
                color: addingConnection || !newExternalId.trim() ? "#9ca3af" : "white",
                border: "none",
                borderRadius: "4px",
                cursor: addingConnection || !newExternalId.trim() ? "default" : "pointer",
                fontSize: "0.85rem",
              }}
            >
              {addingConnection ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
