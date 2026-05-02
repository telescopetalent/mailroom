// ---------------------------------------------------------------------------
// Shared constants for the Mailroom frontend
// ---------------------------------------------------------------------------

/** Priority → color mapping used in task circles and badges. */
export const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
  none: "#d1d5db",
};

/** Default project color when none is chosen. */
export const DEFAULT_PROJECT_COLOR = "#7c3aed";

/** Color swatch options for project creation and editing. */
export const COLOR_OPTIONS = [
  { label: "Violet", value: "#7c3aed" },
  { label: "Blue",   value: "#2563eb" },
  { label: "Green",  value: "#16a34a" },
  { label: "Red",    value: "#dc2626" },
  { label: "Amber",  value: "#d97706" },
  { label: "Cyan",   value: "#0891b2" },
  { label: "Pink",   value: "#db2777" },
  { label: "Lime",   value: "#65a30d" },
] as const;
