// app/status/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus = {
  service: string;
  status: "healthy" | "degraded" | "inactive" | "unknown";
  callsToday: number;
  errorsToday: number;
};

type StatusData = {
  services: ServiceStatus[];
  summary: {
    lastUpdated: string;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISPLAY_SERVICES: Record<string, string> = {
  "session-prep": "Session Prep",
  redaction: "PHI Redaction",
  "risk-classification": "Risk Signals",
  "ths-scoring": "Health Score Narrative",
};

const PORTAL_SERVICE = "Patient Portal";

function deriveErrorRate(svc: ServiceStatus): number {
  if (svc.callsToday === 0) return 0;
  return svc.errorsToday / svc.callsToday;
}

function deriveOverall(rows: { errorRate: number }[]): "operational" | "degraded" | "outage" {
  if (rows.some(r => r.errorRate > 0.2)) return "outage";
  if (rows.some(r => r.errorRate >= 0.05)) return "degraded";
  return "operational";
}

const OVERALL_CONFIG = {
  operational: { label: "All Systems Operational", bg: "#061a0b", border: "#0e2e1a", fg: "#4ade80", dot: "#22c55e" },
  degraded: { label: "Partial Disruption", bg: "#1a1000", border: "#3d2800", fg: "#fb923c", dot: "#f59e0b" },
  outage: { label: "Major Outage", bg: "#1a0808", border: "#3d1a1a", fg: "#f87171", dot: "#ef4444" },
};

function dotColor(errorRate: number): string {
  if (errorRate > 0.2) return "#ef4444";
  if (errorRate >= 0.05) return "#f59e0b";
  return "#22c55e";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const demoParam =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "true"
      ? "&demo=true"
      : "";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/status?_t=${Date.now()}${demoParam}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error)
        throw new Error(typeof json.error === "string" ? json.error : json.error?.message ?? "API error");
      setData(json.data);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [demoParam]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Build service rows
  const serviceRows = useMemo(() => {
    if (!data) return [];
    const mapped = Object.entries(DISPLAY_SERVICES).map(([key, label]) => {
      const svc = data.services.find(s => s.service === key);
      const errorRate = svc ? deriveErrorRate(svc) : 0;
      const uptime = ((1 - errorRate) * 100).toFixed(1);
      return { label, errorRate, uptime };
    });
    // Patient Portal — always operational (no API service for it)
    mapped.push({ label: PORTAL_SERVICE, errorRate: 0, uptime: "100.0" });
    return mapped;
  }, [data]);

  const overall = useMemo(() => deriveOverall(serviceRows), [serviceRows]);
  const cfg = OVERALL_CONFIG[overall];

  return (
    <div style={{ minHeight: "100vh", background: "#080c12", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @media (max-width: 767px) {
          .status-main { padding: 64px 16px 60px !important; }
        }
      `}</style>

      {/* Minimal public header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: "1px solid #1a1e2a",
        maxWidth: 720, margin: "0 auto",
      }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#f1f3f8", letterSpacing: -0.5, fontFamily: "'DM Sans', sans-serif" }}>
          EmpathAI
        </div>
        <a href="/" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>
          &larr; Back to app
        </a>
      </header>

      <main className="status-main" style={{ padding: "48px 24px 80px", maxWidth: 720, margin: "0 auto" }}>
        {/* Page heading */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: "#f1f3f8", lineHeight: 1, fontFamily: "'DM Sans', sans-serif" }}>
            Product Health
          </h1>
          <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>
            Current status of EmpathAI services
          </div>
        </div>

        {error && (
          <div style={{ background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#f87171" }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <div style={{ fontSize: 13, color: "#4b5563", padding: "40px 0", textAlign: "center" }}>
            Checking system status...
          </div>
        )}

        {data && (
          <>
            {/* Overall status banner */}
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "18px 22px", borderRadius: 12,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              marginBottom: 24,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
              <div style={{ fontSize: 17, fontWeight: 800, color: cfg.fg }}>{cfg.label}</div>
            </div>

            {/* Service list */}
            <div style={{
              background: "#0d1018", border: "1px solid #1a1e2a", borderRadius: 12,
              overflow: "hidden", marginBottom: 24,
            }}>
              {serviceRows.map((row, i) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 20px",
                    borderTop: i > 0 ? "1px solid #1a1e2a" : "none",
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: dotColor(row.errorRate), flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
                    {row.uptime}%
                  </div>
                </div>
              ))}
            </div>

            {/* Last checked */}
            <div style={{ fontSize: 12, color: "#4b5563", textAlign: "center", marginBottom: 40 }}>
              Last checked {new Date(data.summary.lastUpdated).toLocaleTimeString()} &middot; Auto-refresh every 60s
            </div>

            {/* Footer */}
            <div style={{ fontSize: 12, color: "#374151", textAlign: "center" }}>
              For support contact your practice admin
            </div>
          </>
        )}
      </main>
    </div>
  );
}
