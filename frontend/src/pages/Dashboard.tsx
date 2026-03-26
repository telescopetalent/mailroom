import { useEffect, useState } from "react";
import { api, getApiKey, setApiKey } from "../api/client";

export default function Dashboard() {
  const [connected, setConnected] = useState(!!getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (connected) {
      api<{ email: string; name: string }>("/users/me")
        .then(setUser)
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
    <div>
      <h2>Dashboard</h2>
      {user && (
        <p>
          Signed in as <strong>{user.name}</strong> ({user.email})
        </p>
      )}
      <p style={{ color: "#888" }}>Capture and review workflow coming in Phase 4.</p>
    </div>
  );
}
