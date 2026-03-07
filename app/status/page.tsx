// app/status/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus = {
  service: string;
  status: "healthy" | "degraded" | "inactive" | "unknown";
  lastCallAt: string | null;
  callsToday: number;
  avgTokensToday: number;
  blockedToday: number;
  errorsToday: number;
  lastError: string | null;
};

type ActivityEntry = {
  time: string;
  service: string;
  case_code: string | null;
  tokens: number | null;
  blocked: boolean;
};

type RedactionStats = {
  totalPromptsScrubbed: number;
  totalOutputsScrubbed: number;
  mostCommonFlag: string;
  byDay: Array<{ date: string; count: number }>;
};

type CostTracking = {
  costToday: number;
  projectedMonthly: number;
  dailyAvg: number;
  costByService: Record<string, number>;
  budgetCeiling: number;
  alertThreshold: number;
  overBudget: boolean;
};

type StatusData = {
  services: ServiceStatus[];
  summary: {
    totalCallsToday: number;
    totalBlockedToday: number;
    totalErrorsToday: number;
    lastUpdated: string;
  };
  costTracking?: CostTracking;
  recentActivity: ActivityEntry[];
  redactionStats: RedactionStats;
  riskSummary: Record<string, number>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

const STATUS_DOT: Record<string, string> = {
  healthy: "#22c55e",
  degraded: "#f59e0b",
  inactive: "#6b7280",
  unknown: "#374151",
};

const SERVICE_LABELS: Record<string, string> = {
  briefing: "Briefing Service",
  "session-prep": "Session Prep",
  "ths-scoring": "Health Score Narrative",
  "task-generation": "Task Generation",
  redaction: "PHI Redaction",
  "risk-classification": "Risk Signals",
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  briefing: "Generates practice-level AI briefings for managers",
  "session-prep": "Generates pre-session briefings for therapists",
  "ths-scoring": "Produces narrative summaries of health score components",
  "task-generation": "Creates suggested tasks from session context",
  redaction: "Scrubs personally identifiable information from prompts and outputs",
  "risk-classification": "Classifies patient risk levels from check-in patterns",
};

// ── Pilot Launch Gate ─────────────────────────────────────────────────────────

type ChecklistItem = { label: string; done: boolean };

const CHECKLIST: ChecklistItem[] = [
  { label: "RLS policies validated", done: false },
  { label: "Redaction blocking live", done: true },
  { label: "Crisis language detection active", done: true },
  { label: "Audit log active", done: true },
  { label: "Session prep < 10 seconds p95", done: true },
  { label: "Patient onboarding < 2 minutes", done: false },
  { label: "THS formula unit tested", done: true },
  { label: "Regression suite passing (43 tests)", done: true },
  { label: "MFA enabled for manager accounts", done: false },
  { label: "Backup policy confirmed", done: false },
  { label: "Monthly cost < $150", done: false },
  { label: "Support triage documented", done: false },
];

const DONE_COUNT = CHECKLIST.filter(i => i.done).length;
const PILOT_PCT = Math.round((DONE_COUNT / CHECKLIST.length) * 100);

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const demoParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "true"
    ? "&demo=true" : "";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/status?_t=${Date.now()}${demoParam}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(typeof json.error === "string" ? json.error : json.error?.message ?? "API error");
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
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div style={{ background: "#060a10", color: "#c8d1dc", minHeight: "100vh", fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 900px) { .status-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .status-grid { grid-template-columns: 1fr; } }
      `}</style>

      <header style={{ borderBottom: "1px solid #111827", padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#22c55e", fontSize: 11, animation: "blink 2s infinite" }}>&#9679;</span>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", letterSpacing: 0.5 }}>AI Services</span>
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>How AI features are performing this month</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#4b5563" }}>
          {data ? `Updated ${timeAgo(data.summary.lastUpdated)}` : "Loading..."}
          {" | "}
          <span style={{ color: "#6b7280" }}>Auto-refresh 30s</span>
        </div>
      </header>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.3s ease" }}>

        {error && (
          <div style={{ background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* ── Summary bar ── */}
        {data && (
          <div style={{ display: "flex", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
            {[
              { label: "Calls today", value: data.summary.totalCallsToday, color: "#60a5fa" },
              { label: "Blocked (PII)", value: data.summary.totalBlockedToday, color: data.summary.totalBlockedToday > 0 ? "#f59e0b" : "#22c55e" },
              { label: "Errors", value: data.summary.totalErrorsToday, color: data.summary.totalErrorsToday > 0 ? "#ef4444" : "#22c55e" },
              { label: "Services healthy", value: data.services.filter(s => s.status === "healthy").length + "/" + data.services.length, color: "#22c55e" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ minWidth: 120 }}>
                <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cost tracking ── */}
        {data?.costTracking && <CostPanel cost={data.costTracking} />}

        {/* ── Service cards ── */}
        {loading && !data && (
          <div style={{ fontSize: 13, color: "#4b5563", padding: "40px 0", textAlign: "center" }}>Loading agent status...</div>
        )}

        {data && (
          <>
            <SectionTitle>Services</SectionTitle>
            <div className="status-grid" style={{ marginBottom: 32 }}>
              {data.services.map(svc => (
                <ServiceCard key={svc.service} svc={svc} />
              ))}
            </div>

            {/* ── Recent activity ── */}
            <SectionTitle>Recent Activity (last 20)</SectionTitle>
            <ActivityTable entries={data.recentActivity} />

            {/* ── Redaction & Risk side by side ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 32 }}>
              <div>
                <SectionTitle>Redaction Stats (7d)</SectionTitle>
                <RedactionPanel stats={data.redactionStats} />
              </div>
              <div>
                <SectionTitle>Risk Classification (7d)</SectionTitle>
                <RiskPanel summary={data.riskSummary} />
              </div>
            </div>

            {/* ── Pilot checklist ── */}
            <div style={{ marginTop: 32 }}>
              <SectionTitle>Pilot Launch Gate</SectionTitle>
              <PilotChecklist />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: "#4b5563", textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </div>
  );
}

function ServiceCard({ svc }: { svc: ServiceStatus }) {
  const dotColor = STATUS_DOT[svc.status] ?? "#374151";
  const neverUsed = svc.callsToday === 0 && !svc.lastCallAt;

  return (
    <div style={{
      background: "#0b0f18",
      border: "1px solid #111827",
      borderRadius: 8,
      padding: "16px 18px",
      fontSize: 12,
      lineHeight: 1.8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>
          {SERVICE_LABELS[svc.service] ?? svc.service}
        </span>
      </div>
      {SERVICE_DESCRIPTIONS[svc.service] && (
        <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 8, lineHeight: 1.4 }}>
          {SERVICE_DESCRIPTIONS[svc.service]}
        </div>
      )}
      {neverUsed ? (
        <div style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic", marginTop: 4 }}>Not yet used</div>
      ) : (
        <>
          <Row label="Status" value={svc.status.charAt(0).toUpperCase() + svc.status.slice(1)} color={dotColor} />
          <Row label="Last call" value={svc.lastCallAt ? timeAgo(svc.lastCallAt) : "Never"} />
          <Row label="Calls today" value={svc.callsToday > 0 ? String(svc.callsToday) : "Not yet used"} color={svc.callsToday === 0 ? "#4b5563" : undefined} />
          <Row label="Avg tokens" value={svc.avgTokensToday ? String(svc.avgTokensToday) : "n/a"} />
          <Row label="Blocked (PII)" value={String(svc.blockedToday)} color={svc.blockedToday > 0 ? "#f59e0b" : undefined} />
          <Row label="Last error" value={svc.lastError ?? "None"} color={svc.lastError ? "#ef4444" : "#22c55e"} />
        </>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#6b7280" }}>{label}:</span>
      <span style={{ color: color ?? "#94a3b8", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ActivityTable({ entries }: { entries: ActivityEntry[] }) {
  return (
    <div style={{ background: "#0b0f18", border: "1px solid #111827", borderRadius: 8, overflow: "hidden", marginBottom: 16, fontSize: 11 }}>
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px 80px 70px", padding: "8px 14px", background: "#0d1220", color: "#4b5563", fontWeight: 700, letterSpacing: 0.5 }}>
        <span>Time</span><span>Service</span><span>Case Code</span><span>Tokens</span><span>Blocked</span>
      </div>
      {entries.map((e, i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr 130px 80px 70px",
          padding: "6px 14px",
          borderTop: "1px solid #111827",
          color: "#94a3b8",
        }}>
          <span style={{ color: "#6b7280" }}>{new Date(e.time).toLocaleTimeString()}</span>
          <span>{e.service}</span>
          <span style={{ color: "#64748b", fontFamily: "monospace" }}>{e.case_code ?? "-"}</span>
          <span>{e.tokens ?? "-"}</span>
          <span style={{ color: e.blocked ? "#f59e0b" : "#22c55e" }}>{e.blocked ? "yes" : "no"}</span>
        </div>
      ))}
    </div>
  );
}

function RedactionPanel({ stats }: { stats: RedactionStats }) {
  const maxCount = Math.max(1, ...stats.byDay.map(d => d.count));

  return (
    <div style={{ background: "#0b0f18", border: "1px solid #111827", borderRadius: 8, padding: "16px 18px", fontSize: 12 }}>
      <Row label="Prompts scrubbed" value={String(stats.totalPromptsScrubbed)} />
      <Row label="Outputs scrubbed" value={String(stats.totalOutputsScrubbed)} />
      <Row label="Most common flag" value={stats.mostCommonFlag} color="#f59e0b" />

      <div style={{ marginTop: 14, display: "flex", gap: 4, alignItems: "flex-end", height: 48 }}>
        {stats.byDay.map((d) => (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{
              width: "100%",
              height: Math.max(2, (d.count / maxCount) * 40),
              background: "#f59e0b",
              borderRadius: 2,
              opacity: 0.7,
            }} />
            <span style={{ fontSize: 8, color: "#4b5563" }}>{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskPanel({ summary }: { summary: Record<string, number> }) {
  const levels: Array<{ key: string; label: string; color: string }> = [
    { key: "critical", label: "Critical", color: "#ef4444" },
    { key: "declining", label: "Declining", color: "#f59e0b" },
    { key: "stable", label: "Stable", color: "#22c55e" },
    { key: "improving", label: "Improving", color: "#60a5fa" },
  ];

  return (
    <div style={{ background: "#0b0f18", border: "1px solid #111827", borderRadius: 8, padding: "16px 18px", fontSize: 12 }}>
      {levels.map(({ key, label, color }) => {
        const count = summary[key] ?? 0;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: "#94a3b8" }}>{label}</span>
            <span style={{ fontWeight: 700, color, minWidth: 30, textAlign: "right" }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function CostPanel({ cost }: { cost: CostTracking }) {
  const pct = Math.min(100, (cost.projectedMonthly / cost.budgetCeiling) * 100);
  const barColor = cost.overBudget ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e";
  const topServices = Object.entries(cost.costByService)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>AI Cost Tracking</SectionTitle>
      <div style={{ background: "#0b0f18", border: "1px solid #111827", borderRadius: 8, padding: "16px 18px", fontSize: 12 }}>
        {cost.overBudget && (
          <div style={{ background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 4, padding: "6px 10px", marginBottom: 12, color: "#f87171", fontSize: 11, fontWeight: 700 }}>
            ALERT: Projected monthly cost ${`$${cost.projectedMonthly.toFixed(2)}`} exceeds $20 warning threshold
          </div>
        )}
        <div style={{ display: "flex", gap: 32, marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Today</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#60a5fa" }}>${cost.costToday.toFixed(4)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Daily avg (7d)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#94a3b8" }}>${cost.dailyAvg.toFixed(4)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Projected monthly</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: barColor }}>${cost.projectedMonthly.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Budget ceiling</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#4b5563" }}>${cost.budgetCeiling.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3 }} />
        </div>
        {topServices.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Cost by service (7d)</div>
            {topServices.map(([svc, val]) => (
              <div key={svc} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ color: "#6b7280" }}>{svc}</span>
                <span style={{ color: "#94a3b8", fontWeight: 500 }}>${val.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PilotChecklist() {
  return (
    <div style={{ background: "#0b0f18", border: "1px solid #111827", borderRadius: 8, padding: "18px 20px", fontSize: 12 }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontWeight: 600 }}>Pilot Readiness</span>
          <span style={{ color: PILOT_PCT >= 80 ? "#22c55e" : PILOT_PCT >= 50 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>{PILOT_PCT}%</span>
        </div>
        <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${PILOT_PCT}%`,
            height: "100%",
            background: PILOT_PCT >= 80 ? "#22c55e" : PILOT_PCT >= 50 ? "#f59e0b" : "#ef4444",
            borderRadius: 3,
            transition: "width 0.4s",
          }} />
        </div>
      </div>

      {/* Items */}
      {CHECKLIST.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: "1px solid #111827" }}>
          <span style={{
            width: 16, height: 16, borderRadius: 3, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700,
            background: item.done ? "#052e16" : "#1e293b",
            border: item.done ? "1px solid #166534" : "1px solid #334155",
            color: item.done ? "#22c55e" : "#4b5563",
          }}>
            {item.done ? "\u2713" : ""}
          </span>
          <span style={{ color: item.done ? "#94a3b8" : "#4b5563" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
