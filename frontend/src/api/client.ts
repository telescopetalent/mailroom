const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

let apiKey: string | null = localStorage.getItem("mailroom_api_key");

export function setApiKey(key: string) {
  apiKey = key;
  localStorage.setItem("mailroom_api_key", key);
}

export function getApiKey(): string | null {
  return apiKey;
}

export function clearApiKey() {
  apiKey = null;
  localStorage.removeItem("mailroom_api_key");
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }

  return res.json();
}
