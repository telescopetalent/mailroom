import { Outlet, Link } from "react-router-dom";

export default function Layout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav
        style={{
          padding: "1rem 2rem",
          borderBottom: "1px solid #e2e2e2",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        <Link to="/" style={{ fontWeight: 700, fontSize: "1.2rem", textDecoration: "none", color: "#111" }}>
          Mailroom
        </Link>
        <Link to="/" style={{ textDecoration: "none", color: "#555" }}>
          Dashboard
        </Link>
      </nav>
      <main style={{ flex: 1, padding: "2rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
