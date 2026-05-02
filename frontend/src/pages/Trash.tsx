import { useEffect, useState, useCallback } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";
import type { TrashedCapture, TrashedList } from "../types";

export default function Trash() {
  const [captures, setCaptures] = useState<TrashedCapture[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const load = useCallback(() => {
    api<TrashedList>("/captures/trash")
      .then((data) => {
        setCaptures(data.items);
        setSelected(new Set());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const deleteSelected = () => {
    if (selected.size === 0) return;
    setConfirmAction({
      title: "Delete selected captures",
      description: `Permanently delete ${selected.size} capture${selected.size > 1 ? "s" : ""}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmAction(null);
        if (selected.size === captures.length) {
          await api("/captures/trash/delete-all", { method: "POST" });
        } else {
          for (const id of selected) {
            await api(`/captures/${id}`, { method: "DELETE" });
          }
        }
        load();
      },
    });
  };

  const deleteAll = () => {
    if (captures.length === 0) return;
    setConfirmAction({
      title: "Empty trash",
      description: `Permanently delete all ${captures.length} trashed capture${captures.length > 1 ? "s" : ""}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmAction(null);
        await api("/captures/trash/delete-all", { method: "POST" });
        load();
      },
    });
  };

  const confirmDeleteOne = (id: string) => {
    setConfirmAction({
      title: "Delete capture",
      description: "Permanently delete this capture? This cannot be undone.",
      onConfirm: () => {
        setConfirmAction(null);
        deleteCapture(id);
      },
    });
  };

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Trash</h2>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading...</p>
      ) : captures.length === 0 ? (
        <p className="text-sm text-zinc-400">Trash is empty.</p>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected.size === captures.length && captures.length > 0}
                onChange={selectAll}
                className="accent-violet-600"
              />
              Select all ({captures.length})
            </label>

            <div className="flex gap-2">
              {selected.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white border-0 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete selected ({selected.size})
                </button>
              )}
              <button
                onClick={deleteAll}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-800 hover:bg-red-900 text-white border-0 cursor-pointer transition-colors"
              >
                Empty trash
              </button>
            </div>
          </div>

          {/* Capture list */}
          <div className="flex flex-col gap-2">
            {captures.map((cap) => (
              <div
                key={cap.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selected.has(cap.id)
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(cap.id)}
                  onChange={() => toggleSelect(cap.id)}
                  className="accent-violet-600 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {cap.extraction?.summary || cap.normalized_text?.slice(0, 80) || "Capture"}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {cap.source} | {cap.content_type} |{" "}
                    Trashed {cap.trashed_at ? new Date(cap.trashed_at).toLocaleString() : ""}
                    {cap.previous_status && <span> | was: {cap.previous_status}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => restoreCapture(cap.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                  <button
                    onClick={() => confirmDeleteOne(cap.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-0 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ""}
        description={confirmAction?.description || ""}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
