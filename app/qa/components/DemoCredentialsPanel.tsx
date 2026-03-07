// app/qa/components/DemoCredentialsPanel.tsx
"use client";

import { useEffect, useState } from "react";

type Credential = {
  role: string;
  email?: string;
  password?: string;
  joinCode?: string;
};

type ApiResponse = {
  data: { credentials: Credential[] } | null;
  error: { message: string } | null;
};

const COLORS = {
  bg: "#0d1018",
  border: "#1a2035",
  accent: "#6b82d4",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  amber: "#d97706",
  green: "#4ade80",
};

const FONT_MONO = "'DM Mono', monospace";
const FONT_BODY = "'DM Sans', system-ui, sans-serif";

export default function DemoCredentialsPanel() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/qa/demo-credentials", { cache: "no-store" });
        const json: ApiResponse = await res.json();
        if (cancelled) return;
        if (json.error) {
          setError(json.error.message);
        } else if (json.data?.credentials) {
          setCredentials(json.data.credentials);
        }
      } catch {
        if (!cancelled) setError("Failed to load demo credentials");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleCopy(index: number) {
    const cred = credentials[index];
    if (!cred) return;
    const text = cred.joinCode
      ? cred.joinCode
      : `${cred.email}:${cred.password ?? ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch { /* clipboard not available */ }
  }

  // Lock icon inline SVG
  const lockIcon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.textPrimary}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  // Chevron icon
  const chevron = (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.textSecondary}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 0.2s",
        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
        fontFamily: FONT_BODY,
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lockIcon}
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: COLORS.textPrimary,
            }}
          >
            Demo Credentials
          </span>
        </div>
        {chevron}
      </div>

      {/* Subtext */}
      <div
        style={{
          fontSize: 12,
          color: COLORS.amber,
          marginTop: 6,
        }}
      >
        For QA testing only — do not share
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 16 }}>
          {loading && (
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
              Loading...
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: "#f87171" }}>
              {error}
            </div>
          )}

          {!loading && !error && credentials.length === 0 && (
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
              No demo credentials configured.
            </div>
          )}

          {!loading && !error && credentials.length > 0 && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: FONT_MONO,
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: COLORS.textSecondary,
                      borderBottom: `1px solid ${COLORS.border}`,
                      fontFamily: FONT_BODY,
                    }}
                  >
                    Role
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: COLORS.textSecondary,
                      borderBottom: `1px solid ${COLORS.border}`,
                      fontFamily: FONT_BODY,
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: COLORS.textSecondary,
                      borderBottom: `1px solid ${COLORS.border}`,
                      fontFamily: FONT_BODY,
                    }}
                  >
                    Password
                  </th>
                  <th
                    style={{
                      padding: "6px 8px",
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        padding: "8px 8px",
                        color: COLORS.textPrimary,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cred.role}
                    </td>
                    <td
                      style={{
                        padding: "8px 8px",
                        color: COLORS.textSecondary,
                      }}
                    >
                      {cred.joinCode
                        ? `Join code: ${cred.joinCode}`
                        : cred.email ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "8px 8px",
                        color: COLORS.textSecondary,
                      }}
                    >
                      {cred.joinCode ? "—" : cred.password ?? "—"}
                    </td>
                    <td style={{ padding: "8px 8px", textAlign: "right" }}>
                      <button
                        onClick={() => handleCopy(i)}
                        style={{
                          border: `1px solid ${COLORS.border}`,
                          background: "transparent",
                          color:
                            copiedIndex === i ? COLORS.green : COLORS.accent,
                          fontSize: 11,
                          fontFamily: FONT_BODY,
                          padding: "2px 8px",
                          borderRadius: 4,
                          cursor: "pointer",
                          transition: "color 0.15s",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {copiedIndex === i ? "Copied!" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
