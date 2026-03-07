// app/status/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/demoMode";

// ── Types ─────────────────────────────────────────────────────────────────────

type ComponentStatus = "operational" | "degraded" | "partial" | "down" | "unknown";
type OverallStatus = "operational" | "degraded" | "outage" | "unknown";

type StatusItem = {
  name: string;
  status: ComponentStatus;
  totalCalls?: number;
};

type StatusComponent = {
  id: string;
  name: string;
  description: string;
  status: ComponentStatus;
  uptime: number | null;
  items: StatusItem[];
  totalCalls?: number;
};

type StatusResponse = {
  overall: OverallStatus;
  last_checked: string;
  components: StatusComponent[];
  error?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOT_COLORS: Record<ComponentStatus, string> = {
  operational: "#4ade80",
  degraded: "#fbbf24",
  partial: "#d97706",
  down: "#f87171",
  unknown: "#6b7280",
};

const STATUS_LABELS: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  partial: "Partial Outage",
  down: "Major Outage",
  unknown: "Unknown",
};

const OVERALL_CONFIG: Record<OverallStatus, {
  label: string;
  bg: string;
  border: string;
  fg: string;
  dot: string;
}> = {
  operational: {
    label: "All Systems Operational",
    bg: "#061a0b",
    border: "#0e2e1a",
    fg: "#16a34a",
    dot: "#16a34a",
  },
  degraded: {
    label: "Partial Disruption \u2014 some features may be affected",
    bg: "#1a1000",
    border: "#3d2800",
    fg: "#d97706",
    dot: "#d97706",
  },
  outage: {
    label: "Major Outage \u2014 some features are unavailable",
    bg: "#1a0808",
    border: "#3d1a1a",
    fg: "#dc2626",
    dot: "#dc2626",
  },
  unknown: {
    label: "Status Unknown \u2014 checking...",
    bg: "#111318",
    border: "#1a1e2a",
    fg: "#6b7280",
    dot: "#6b7280",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  return `${mins} minutes ago`;
}

const FALLBACK_STATE: StatusResponse = {
  overall: "unknown",
  last_checked: new Date().toISOString(),
  components: [],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0); // force re-render for "time ago"

  const demoParam = isDemoMode() ? "&demo=true" : "";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/status?_t=${Date.now()}${demoParam}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setData(FALLBACK_STATE);
        return;
      }
      const json = await res.json();
      if (json.overall) {
        setData(json as StatusResponse);
      } else {
        setData(FALLBACK_STATE);
      }
    } catch {
      setData(FALLBACK_STATE);
    }
  }, [demoParam]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Re-render every 30s to keep "time ago" fresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLoading = data === null;
  const overall = data?.overall ?? "unknown";
  const cfg = OVERALL_CONFIG[overall];

  return (
    <div style={{ minHeight: "100vh", background: "#080c12", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @media (max-width: 767px) {
          .status-main { padding: 48px 16px 60px !important; }
        }
      `}</style>

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid #1a1e2a",
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#f1f3f8",
            letterSpacing: -0.5,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          EmpathAI
        </div>
        <a
          href="/"
          style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
        >
          &larr; Back to app
        </a>
      </header>

      <main
        className="status-main"
        style={{ padding: "48px 24px 80px", maxWidth: 720, margin: "0 auto" }}
      >
        {/* Overall status banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "18px 22px",
            borderRadius: 12,
            background: isLoading ? OVERALL_CONFIG.unknown.bg : cfg.bg,
            border: `1px solid ${isLoading ? OVERALL_CONFIG.unknown.border : cfg.border}`,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: isLoading ? OVERALL_CONFIG.unknown.dot : cfg.dot,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: isLoading ? OVERALL_CONFIG.unknown.fg : cfg.fg,
            }}
          >
            {isLoading ? OVERALL_CONFIG.unknown.label : cfg.label}
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: "#0d1018",
                  border: "1px solid #1a1e2a",
                  borderRadius: 12,
                  padding: "16px 20px",
                  animation: "pulse 1.8s ease-in-out infinite",
                  animationDelay: `${i * 0.12}s`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#1a1e2a",
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      width: "40%",
                      height: 14,
                      borderRadius: 4,
                      background: "#1a1e2a",
                    }}
                  />
                  <div style={{ flex: 1 }} />
                  <div
                    style={{
                      width: 72,
                      height: 14,
                      borderRadius: 4,
                      background: "#1a1e2a",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: "60%",
                    height: 10,
                    borderRadius: 4,
                    background: "#1a1e2a",
                    marginTop: 8,
                    marginLeft: 20,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Component list */}
        {!isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data!.components.map((comp) => {
              const isExpanded = expanded.has(comp.id);
              const dot = DOT_COLORS[comp.status];
              const label = STATUS_LABELS[comp.status];

              return (
                <div
                  key={comp.id}
                  style={{
                    background: "#0d1018",
                    border: "1px solid #1a1e2a",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {/* Collapsed row (always visible) */}
                  <div
                    onClick={() => toggleExpand(comp.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "16px 20px",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: dot,
                        flexShrink: 0,
                        marginTop: 5,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#e2e8f0",
                          }}
                        >
                          {comp.name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: dot,
                            }}
                          >
                            {label}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              transition: "transform 0.2s",
                              display: "inline-block",
                              transform: isExpanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                            }}
                          >
                            &#9662;
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 2,
                        }}
                      >
                        {comp.description}
                      </div>
                      {comp.totalCalls !== undefined && comp.totalCalls > 0 && (
                        <div style={{
                          fontFamily: "'DM Mono', monospace",
                          color: "#94a3b8",
                          fontSize: 12,
                          marginTop: 6,
                        }}>
                          {comp.totalCalls} calls in last 60 min
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded items */}
                  {isExpanded && comp.items.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid #1a1e2a",
                        padding: "8px 20px 12px",
                      }}
                    >
                      {comp.items.map((item) => (
                        <div
                          key={item.name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 0 8px 20px",
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: DOT_COLORS[item.status],
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: "#e2e8f0",
                            }}
                          >
                            {item.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color:
                                comp.uptime === null
                                  ? "#6b7280"
                                  : DOT_COLORS[item.status],
                            }}
                          >
                            {comp.uptime === null
                              ? "Insufficient data"
                              : STATUS_LABELS[item.status]}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!isLoading && (
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
              Last checked: {timeAgo(data!.last_checked)} &middot; Auto-refresh
              every 60s
            </div>
            <div style={{ fontSize: 12, color: "#374151" }}>
              For support contact your practice admin
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
