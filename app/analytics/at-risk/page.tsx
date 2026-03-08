// app/analytics/at-risk/page.tsx
// Module 3: At-Risk Pattern Detection — stub page (coming soon)
import Link from "next/link";

function StatusBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const,
      color: "#d97706", opacity: 0.95,
      background: "rgba(217,119,6,0.1)",
      border: "1px solid rgba(217,119,6,0.3)",
      padding: "2px 8px", borderRadius: 999,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "#d97706",
        display: "inline-block",
      }} />
      Coming soon
    </span>
  );
}

export default function AtRiskPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#080c12", color: "#f1f5f9", fontFamily: "'DM Sans', system-ui" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>

        <Link href="/analytics" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 24, transition: "color 0.2s" }}>
          ← Back to Analytics
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: "#f1f5f9" }}>
            At-Risk Pattern Detection
          </h1>
          <StatusBadge />
        </div>

        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 32 }}>
          Surface caseload and engagement patterns that precede patient disengagement — before it happens.
        </div>

        <div style={{
          border: "1px solid #1a2035",
          borderRadius: 14,
          padding: "48px 24px",
          background: "#0d1018",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
            This module is in development
          </div>
          <div style={{ fontSize: 13, color: "#64748b", maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
            It will surface caseload and engagement patterns that precede patient disengagement.
          </div>
        </div>
      </div>
    </div>
  );
}
