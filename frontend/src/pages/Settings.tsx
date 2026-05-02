import { useEffect, useState, useCallback } from "react";
import { Check, Plus, X } from "lucide-react";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";
import type { WorkspaceSettings, SurfaceConnection, SurfaceConnectionList } from "../types";

const cardCls = "p-5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 mb-5";
const sectionTitleCls = "text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1";
const sectionDescCls = "text-sm text-zinc-500 dark:text-zinc-400 mb-4";
const selectCls = "px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none cursor-pointer text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent";
const inputCls = "flex-1 px-2.5 py-1.5 text-sm bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-md outline-none text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent";

export default function Settings() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [connections, setConnections] = useState<SurfaceConnection[]>([]);
  const [newSurface, setNewSurface] = useState("email");
  const [newExternalId, setNewExternalId] = useState("");
  const [addingConnection, setAddingConnection] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const loadConnections = useCallback(() => {
    api<SurfaceConnectionList>("/surface-connections")
      .then((data) => setConnections(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api<WorkspaceSettings>("/workspaces/current")
      .then((data) => {
        setSettings(data);
        setRetentionDays(data.trash_retention_days);
      })
      .catch((e) => setError(e.message));

    loadConnections();
  }, [loadConnections]);

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
    try {
      await api(`/surface-connections/${id}`, { method: "DELETE" });
      loadConnections();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const isDirty = settings && retentionDays !== settings.trash_retention_days;

  if (!settings && !error) return <p className="text-sm text-zinc-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Settings</h2>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {/* Trash settings */}
      <div className={cardCls}>
        <h3 className={sectionTitleCls}>Trash</h3>
        <p className={sectionDescCls}>
          Captures in the trash will be automatically deleted after the retention period.
        </p>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Retention period:</label>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className={selectCls}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={save}
            disabled={saving || !isDirty}
            className={`px-4 py-1.5 text-sm font-medium rounded-md border-0 cursor-pointer transition-colors ${
              saving || !isDirty
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            }`}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              Saved!
            </span>
          )}
        </div>
      </div>

      {/* Connected Surfaces */}
      <div className={cardCls}>
        <h3 className={sectionTitleCls}>Connected Surfaces</h3>
        <p className={sectionDescCls}>
          Connect email addresses and Slack workspaces to capture content from external surfaces.
        </p>

        {/* Existing connections */}
        {connections.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  conn.is_active
                    ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
                    : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 opacity-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    conn.surface === "email"
                      ? "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                      : "bg-pink-100 dark:bg-pink-950/30 text-pink-700 dark:text-pink-400"
                  }`}>
                    {conn.surface}
                  </span>
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{conn.external_id}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => toggleConnection(conn)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-transparent border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {conn.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => setRemoveTarget(conn.id)}
                    className="p-1 rounded-md bg-transparent border-0 text-zinc-400 hover:text-red-500 cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add connection form */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Add Connection</div>
          <div className="flex gap-2">
            <select
              value={newSurface}
              onChange={(e) => setNewSurface(e.target.value)}
              className={selectCls}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
            </select>
            <input
              type="text"
              placeholder={newSurface === "email" ? "user@example.com" : "Slack Team ID (e.g. T01ABC)"}
              value={newExternalId}
              onChange={(e) => setNewExternalId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addConnection(); }}
              className={inputCls}
            />
            <button
              onClick={addConnection}
              disabled={addingConnection || !newExternalId.trim()}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border-0 cursor-pointer transition-colors ${
                addingConnection || !newExternalId.trim()
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                  : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {addingConnection ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove connection"
        description="Remove this surface connection? You can re-add it later."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeTarget) removeConnection(removeTarget);
          setRemoveTarget(null);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
