// app/admin/dev/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NavSidebar } from "@/app/components/NavSidebar";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "api" | "debug";

type Severity = "critical" | "warning" | "info" | "empty";
type CheckState = "idle" | "running" | "done";

type CheckDef = {
  id: string;
  label: string;
  desc: string;
  url: string;
  validate: (json: any, status: number) => { severity: Severity; summary: string; rca?: string };
};

type CheckResult = {
  state: CheckState;
  severity?: Severity;
  ms?: number;
  summary?: string;
  rca?: string;
};

// ── Utilities ─────────────────────────────────────────────────────────────────
async function fetchRaw(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(s: string) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}

// ── Design tokens (from docs/ui-specs/design-system-tokens.ts) ────────────────
const SEVERITY_STYLE: Record<Severity, {
  borderLeft: string;
  bg: string;
  fg: string;
  dotColor: string;
  label: string;
}> = {
  critical: {
    borderLeft: "3px solid #f87171",
    bg: "#1a0808",
    fg: "#f87171",
    dotColor: "#f87171",
    label: "CRITICAL",
  },
  warning: {
    borderLeft: "3px solid #fb923c",
    bg: "rgba(251,146,60,0.04)",
    fg: "#fb923c",
    dotColor: "#fb923c",
    label: "WARNING",
  },
  info: {
    borderLeft: "3px solid rgba(165,180,252,0.3)",
    bg: "transparent",
    fg: "#a5b4fc",
    dotColor: "#a5b4fc",
    label: "INFO",
  },
  empty: {
    borderLeft: "3px solid transparent",
    bg: "transparent",
    fg: "rgba(255,255,255,0.35)",
    dotColor: "rgba(255,255,255,0.15)",
    label: "",
  },
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Badge({ children, tone = "neutral" }: { children: any; tone?: "neutral" | "warn" | "bad" | "good" }) {
  const s = {
    bad:     { bg: "#1a0808", bd: "#3d1a1a", tx: "#f87171" },
    warn:    { bg: "#1a1000", bd: "#3d2800", tx: "#fb923c" },
    good:    { bg: "#061a0b", bd: "#0e2e1a", tx: "#4ade80" },
    neutral: { bg: "#0d1018", bd: "#1a1e2a", tx: "#9ca3af" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, border: `1px solid ${s.bd}`, background: s.bg, color: s.tx, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "api",   label: "API Reference",  icon: "\u2301" },
  { id: "debug", label: "Diagnostics",    icon: "\u25CE" },
];

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #1a1e2a" }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "11px 20px",
            borderRadius: "10px 10px 0 0",
            border: "1px solid " + (active === t.id ? "#1a1e2a" : "transparent"),
            borderBottom: active === t.id ? "1px solid #080c12" : "1px solid transparent",
            background: active === t.id ? "#080c12" : "transparent",
            color: active === t.id ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
            fontWeight: 800, fontSize: 13, cursor: "pointer", marginBottom: -1,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span style={{ fontSize: 14 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── API Reference ─────────────────────────────────────────────────────────────
const API_GROUPS = [
  {
    label: "Admin",
    endpoints: [
      { method: "GET",  path: "/api/admin/overview",                    desc: "System-wide totals + per-practice metrics.",              params: "range=7d|1d|30d|this_week|last_week" },
      { method: "GET",  path: "/api/admin/stats",                       desc: "Lightweight aggregate counts.",                           params: "" },
      { method: "POST", path: "/api/admin/seed/check-ins",              desc: "Seed synthetic check-in data for dev/demo.",              params: "body: { practice_id, weeks }" },
    ],
  },
  {
    label: "Practices",
    endpoints: [
      { method: "GET",  path: "/api/practices",                         desc: "List all practices.",                                     params: "" },
      { method: "GET",  path: "/api/practices/summary",                 desc: "Per-practice weekly summary.",                            params: "week_start=YYYY-MM-DD" },
      { method: "GET",  path: "/api/practices/[id]",                    desc: "Single practice by ID.",                                  params: "" },
      { method: "GET",  path: "/api/practices/[id]/therapist-overview", desc: "Therapist-level metrics for a practice.",                 params: "week_start=YYYY-MM-DD" },
      { method: "GET",  path: "/api/practices/[id]/at-risk",            desc: "At-risk check-ins for a practice.",                       params: "week_start=YYYY-MM-DD" },
      { method: "GET",  path: "/api/practices/[id]/ths",                desc: "Therapeutic Health Score history.",                       params: "practice_id=UUID" },
    ],
  },
  {
    label: "Therapists",
    endpoints: [
      { method: "GET",  path: "/api/therapists",                        desc: "List therapists, optionally filtered by practice.",       params: "practice_id=UUID" },
      { method: "GET",  path: "/api/therapists/[id]",                   desc: "Single therapist profile.",                               params: "" },
      { method: "GET",  path: "/api/therapists/[id]/care",              desc: "Full care view for a therapist (cases + signals).",       params: "week_start=YYYY-MM-DD" },
      { method: "GET",  path: "/api/therapists/[id]/case-signals",      desc: "Per-case engagement signals for a therapist.",            params: "week_start=YYYY-MM-DD" },
    ],
  },
  {
    label: "Cases",
    endpoints: [
      { method: "GET",  path: "/api/cases",                             desc: "List cases, optionally filtered by practice.",            params: "practice_id=UUID" },
      { method: "GET",  path: "/api/cases/[id]",                        desc: "Single case record.",                                     params: "" },
      { method: "GET",  path: "/api/cases/[id]/context",                desc: "Practice + therapist context for a case.",                params: "" },
      { method: "GET",  path: "/api/cases/[id]/check-ins",              desc: "All check-ins for a case.",                               params: "" },
      { method: "GET",  path: "/api/cases/[id]/goals",                  desc: "Goals set for a case.",                                   params: "" },
      { method: "GET",  path: "/api/cases/[id]/timeline",               desc: "Event timeline for a case.",                              params: "" },
      { method: "GET",  path: "/api/cases/[id]/ai-summary",             desc: "AI-generated weekly summary + risks + next actions.",     params: "week_start=YYYY-MM-DD" },
      { method: "GET",  path: "/api/cases/[id]/session-prep",           desc: "AI session prep notes for the therapist.",                params: "week_start=YYYY-MM-DD" },
      { method: "POST", path: "/api/cases/[id]/assignment",             desc: "Assign or reassign a therapist to a case.",               params: "body: { therapist_id }" },
    ],
  },
  {
    label: "Other",
    endpoints: [
      { method: "GET",  path: "/api/health-score",                      desc: "Aggregate health score across a practice.",               params: "practice_id=UUID" },
      { method: "GET",  path: "/api/summary",                           desc: "Cross-practice engagement summary.",                      params: "" },
    ],
  },
];

function ApiTester({ defaultUrl }: { defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; ms: number; data: any } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const responseRef = useRef<HTMLPreElement>(null);

  useEffect(() => { setUrl(defaultUrl); setResponse(null); setError(null); }, [defaultUrl]);

  async function run() {
    setLoading(true); setError(null); setResponse(null);
    const t0 = Date.now();
    try {
      const opts: RequestInit = { method, cache: "no-store" };
      if (method === "POST" && body) { opts.headers = { "Content-Type": "application/json" }; opts.body = body; }
      const res = await fetch(url, opts);
      const ms = Date.now() - t0;
      const json = await res.json().catch(() => null);
      setResponse({ status: res.status, ms, data: json });
      setTimeout(() => responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const statusColor = response
    ? response.status < 300 ? "#4ade80" : response.status < 500 ? "#fb923c" : "#f87171"
    : "#9ca3af";

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={method} onChange={(e) => setMethod(e.target.value)}
          style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#0a0c10", color: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
          <option>GET</option>
          <option>POST</option>
        </select>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="/api/..."
          style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#0a0c10", color: "inherit", fontSize: 13, fontFamily: "monospace", outline: "none" }} />
        <button onClick={run} disabled={loading}
          style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #1f2533", background: loading ? "transparent" : "#0d1220", color: "inherit", fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {loading ? "Sending\u2026" : "Send \u2192"}
        </button>
      </div>
      {method === "POST" && (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='{ "key": "value" }' rows={3}
          style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#0a0c10", color: "inherit", fontSize: 13, fontFamily: "monospace", resize: "vertical", outline: "none" }} />
      )}
      {error && (
        <div style={{ padding: 12, borderRadius: 9, border: "1px solid #3d1a1a", background: "#1a0808", color: "#f87171", fontSize: 13, fontFamily: "monospace" }}>{error}</div>
      )}
      {response && (
        <div style={{ border: "1px solid #1a1e2a", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: "#0a0c10", display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid #1a1e2a" }}>
            <span style={{ fontWeight: 900, color: statusColor, fontFamily: "monospace" }}>{response.status}</span>
            <span style={{ opacity: 0.4, fontSize: 12 }}>{response.ms}ms</span>
            <button onClick={() => navigator.clipboard.writeText(JSON.stringify(response.data, null, 2)).catch(() => {})}
              style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 7, border: "1px solid #1f2533", background: "transparent", color: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Copy
            </button>
          </div>
          <pre ref={responseRef}
            style={{ margin: 0, padding: "14px 16px", fontSize: 12, fontFamily: "monospace", overflowX: "auto", maxHeight: 360, overflowY: "auto", lineHeight: 1.6, color: "rgba(255,255,255,0.8)", background: "#080c12" }}>
            {JSON.stringify(response.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ApiTab() {
  const [triedUrl, setTriedUrl] = useState("");
  const testerRef = useRef<HTMLDivElement>(null);
  const total = API_GROUPS.reduce((s, g) => s + g.endpoints.length, 0);

  function handleTry(url: string) {
    setTriedUrl(url);
    setTimeout(() => testerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  return (
    <div style={{ paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>API Reference</div>
        <div style={{ fontSize: 13, opacity: 0.4 }}>{total} endpoints &middot; click Try &rarr; to test inline</div>
      </div>
      <div style={{ display: "grid", gap: 28 }}>
        {API_GROUPS.map((group) => (
          <div key={group.label}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.3, opacity: 0.3, textTransform: "uppercase", marginBottom: 10 }}>{group.label}</div>
            <div style={{ display: "grid", gap: 5 }}>
              {group.endpoints.map((ep) => (
                <div key={ep.path} style={{ border: "1px solid #1a1e2a", borderRadius: 10, padding: "11px 14px", background: "#0d1018", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, fontFamily: "monospace", flexShrink: 0,
                    background: ep.method === "GET" ? "rgba(0,200,160,0.10)" : "rgba(251,146,60,0.10)",
                    border: ep.method === "GET" ? "1px solid rgba(0,200,160,0.2)" : "1px solid rgba(251,146,60,0.2)",
                    color: ep.method === "GET" ? "#00c8a0" : "#fb923c",
                  }}>{ep.method}</span>
                  <code style={{ fontSize: 13, fontFamily: "monospace", color: "rgba(255,255,255,0.85)", flexShrink: 0 }}>{ep.path}</code>
                  <div style={{ fontSize: 12, opacity: 0.4, flex: 1 }}>{ep.desc}</div>
                  {ep.params && (
                    <code style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(124,92,252,0.75)", background: "rgba(124,92,252,0.07)", border: "1px solid rgba(124,92,252,0.15)", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {ep.params}
                    </code>
                  )}
                  <button onClick={() => handleTry(ep.path.replace("[id]", "REPLACE_ID"))}
                    style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #1f2533", background: "transparent", color: "#6b7280", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Try &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={testerRef} style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>API Tester</div>
          <div style={{ fontSize: 12, opacity: 0.4 }}>manual request &mdash; click Try &rarr; above to pre-fill</div>
        </div>
        <div style={{ border: "1px solid #1a1e2a", borderRadius: 12, padding: 18, background: "#0d1018" }}>
          <ApiTester defaultUrl={triedUrl} key={triedUrl} />
        </div>
      </div>
    </div>
  );
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

const CHECKS: CheckDef[] = [
  {
    id: "admin-overview", label: "Admin overview", desc: "GET /api/admin/overview?range=7d", url: "/api/admin/overview?range=7d",
    validate: (json, status) => {
      if (status >= 500) return { severity: "critical", summary: "Server error (5xx)", rca: "Check the API route handler and Supabase connection string." };
      if (status >= 400) return { severity: "critical", summary: `HTTP ${status}`, rca: "Verify query params and environment variables." };
      const d = json?.data;
      if (!d?.totals) return { severity: "critical", summary: "Missing data.totals", rca: "Response does not contain the expected data shape." };
      if (d.totals.practices === 0) return { severity: "empty", summary: "No practices created yet \u2014 seed data or create your first practice to get started" };
      return { severity: "info", summary: `${d.totals.practices} practices \u00b7 ${d.totals.therapists} therapists \u00b7 ${d.totals.active_cases} active cases` };
    },
  },
  {
    id: "case-routing", label: "Case routing", desc: "Checks for unassigned cases via admin overview", url: "/api/admin/overview?range=7d",
    validate: (json, status) => {
      if (status >= 400) return { severity: "critical", summary: `HTTP ${status}`, rca: "Could not fetch overview data to audit routing." };
      const t = json?.data?.totals;
      if (!t) return { severity: "critical", summary: "No totals in response", rca: "Check endpoint health first." };
      if (t.unassigned_cases > 0) return { severity: "info", summary: `${t.unassigned_cases} case${t.unassigned_cases !== 1 ? "s" : ""} not yet assigned \u2014 assign via Admin \u2192 Practices when ready` };
      return { severity: "info", summary: "All cases assigned" };
    },
  },
  {
    id: "risk-signals", label: "Risk signals", desc: "Checks for at-risk check-ins via admin overview", url: "/api/admin/overview?range=7d",
    validate: (json, status) => {
      if (status >= 400) return { severity: "critical", summary: `HTTP ${status}`, rca: "Could not fetch overview data." };
      const t = json?.data?.totals;
      if (!t) return { severity: "critical", summary: "No totals in response", rca: "Check endpoint health first." };
      if (t.at_risk_checkins > 0) return { severity: "info", summary: `${t.at_risk_checkins} at-risk check-in${t.at_risk_checkins !== 1 ? "s" : ""} this week — review in Manager Dashboard` };
      return { severity: "info", summary: "No at-risk check-ins in current window" };
    },
  },
  {
    id: "practices-list", label: "Practices endpoint", desc: "GET /api/practices", url: "/api/practices",
    validate: (json, status) => {
      if (status >= 500) return { severity: "critical", summary: "Server error (5xx)", rca: "Check app/api/practices/route.ts and Supabase credentials." };
      if (status >= 400) return { severity: "critical", summary: `HTTP ${status}`, rca: "Check middleware and auth configuration." };
      const list = json?.data ?? json;
      if (!Array.isArray(list)) return { severity: "critical", summary: "Bad response shape", rca: "Expected an array from /api/practices." };
      if (list.length === 0) return { severity: "empty", summary: "No practices in the system yet \u2014 create one or run the seed script to get started" };
      return { severity: "info", summary: `${list.length} practice${list.length !== 1 ? "s" : ""} returned` };
    },
  },
  {
    id: "therapists-list", label: "Therapists endpoint", desc: "GET /api/therapists (no filter)", url: "/api/therapists",
    validate: (json, status) => {
      if (status >= 500) return { severity: "critical", summary: "Server error (5xx)", rca: "Check the route handler and DB query." };
      if (status === 400) return { severity: "info", summary: "Endpoint expects a practice_id filter \u2014 this is normal" };
      if (status >= 400) return { severity: "critical", summary: `HTTP ${status}`, rca: "Unexpected error." };
      const list = json?.data ?? json;
      if (!Array.isArray(list)) return { severity: "info", summary: "Non-array response \u2014 test with a practice_id for full results" };
      return { severity: "info", summary: `${list.length} therapist${list.length !== 1 ? "s" : ""} returned` };
    },
  },
  {
    id: "health-score", label: "Health score endpoint", desc: "GET /api/health-score", url: "/api/health-score",
    validate: (_json, status) => {
      if (status >= 500) return { severity: "critical", summary: "Server error (5xx)", rca: "Check app/api/health-score/route.ts." };
      if (status >= 400) return { severity: "info", summary: "Endpoint requires a practice_id param \u2014 this is expected" };
      return { severity: "info", summary: "Endpoint reachable and responding" };
    },
  },
];

// ── Diagnostic check card ─────────────────────────────────────────────────────

function CheckCard({ check, result }: { check: CheckDef; result: CheckResult | undefined }) {
  const state = result?.state ?? "idle";
  const isRunning = state === "running";
  const severity = result?.severity ?? null;
  const ss = severity ? SEVERITY_STYLE[severity] : null;

  const isEmpty = severity === "empty";

  return (
    <div style={{
      borderLeft: ss ? ss.borderLeft : "3px solid #1a1e2a",
      borderRadius: 8,
      padding: "12px 16px",
      background: ss ? ss.bg : "#0d1018",
      border: severity === "critical" ? `1px solid #3d1a1a` : severity === "warning" ? "1px solid rgba(251,146,60,0.15)" : "1px solid #1a1e2a",
      borderLeftWidth: 3,
      borderLeftStyle: "solid",
      borderLeftColor: ss ? (severity === "empty" ? "transparent" : ss.fg) : "#1a1e2a",
      display: "grid",
      gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isRunning && severity && severity !== "empty" && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: ss!.dotColor, boxShadow: severity === "critical" ? `0 0 6px ${ss!.dotColor}55` : "none" }} />
        )}
        <div style={{
          fontWeight: isEmpty ? 500 : 700,
          fontSize: 13,
          flex: 1,
          color: isEmpty ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.9)",
          fontStyle: isEmpty ? "italic" : "normal",
        }}>
          {check.label}
        </div>
        {severity && severity !== "empty" && ss!.label && (
          <span style={{
            padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900,
            fontFamily: "'DM Mono', monospace",
            background: "transparent",
            border: `1px solid ${severity === "critical" ? "#3d1a1a" : severity === "warning" ? "#3d2800" : "#1f2240"}`,
            color: ss!.fg,
          }}>
            {ss!.label}
          </span>
        )}
        {isRunning && <span style={{ fontSize: 12, opacity: 0.45 }}>running&hellip;</span>}
        {state === "idle" && <span style={{ fontSize: 12, opacity: 0.3 }}>pending</span>}
        {result?.ms != null && !isRunning && <span style={{ fontSize: 11, opacity: 0.3, fontFamily: "'DM Mono', monospace" }}>{result.ms}ms</span>}
      </div>
      {result?.summary && (
        <div style={{
          fontSize: 13,
          color: isEmpty ? "rgba(255,255,255,0.3)" : severity === "critical" ? "#f87171" : severity === "warning" ? "#fb923c" : "rgba(255,255,255,0.55)",
          fontWeight: severity === "critical" || severity === "warning" ? 600 : 400,
          fontStyle: isEmpty ? "italic" : "normal",
          lineHeight: 1.5,
        }}>
          {result.summary}
        </div>
      )}
      {result?.rca && severity && (severity === "critical" || severity === "warning") && (
        <div style={{
          marginTop: 2,
          padding: "8px 12px",
          borderRadius: 8,
          border: `1px solid ${severity === "critical" ? "#3d1a1a" : "#3d2800"}`,
          background: "rgba(0,0,0,0.25)",
          fontSize: 12,
          color: ss!.fg,
          lineHeight: 1.6,
          opacity: 0.9,
        }}>
          <span style={{ fontWeight: 900, marginRight: 6 }}>RCA</span>{result.rca}
        </div>
      )}
    </div>
  );
}

// ── Diagnostics tab ───────────────────────────────────────────────────────────

function DiagnosticsTab() {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

  async function runCheck(check: CheckDef) {
    setResults((prev) => ({ ...prev, [check.id]: { state: "running" } }));
    const t0 = Date.now();
    try {
      const { status, json } = await fetchRaw(check.url);
      const ms = Date.now() - t0;
      const { severity, summary, rca } = check.validate(json, status);
      setResults((prev) => ({ ...prev, [check.id]: { state: "done", severity, ms, summary, rca } }));
    } catch (e: any) {
      const ms = Date.now() - t0;
      setResults((prev) => ({ ...prev, [check.id]: { state: "done", severity: "critical", ms, summary: "Network error", rca: e?.message ?? "Could not reach the endpoint." } }));
    }
  }

  async function runAll() {
    setRunning(true);
    setResults({});
    setInfoExpanded(false);
    await Promise.all(CHECKS.map(runCheck));
    setRunning(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runAll(); }, []);

  const allDone = !running && Object.keys(results).length === CHECKS.length;

  const counts = Object.values(results).reduce(
    (acc, r) => {
      if (r.severity === "critical") acc.critical++;
      else if (r.severity === "warning") acc.warning++;
      else if (r.severity === "info") acc.info++;
      else if (r.severity === "empty") acc.empty++;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, empty: 0 }
  );

  const actionableCount = counts.critical + counts.warning;
  const allHealthy = allDone && actionableCount === 0;

  // Sort: critical first, then warning, then info, then empty
  const sortedChecks = [...CHECKS].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2, empty: 3 };
    const sA = results[a.id]?.severity;
    const sB = results[b.id]?.severity;
    return (order[sA ?? "info"] ?? 2) - (order[sB ?? "info"] ?? 2);
  });

  // Split into groups
  const criticalItems = sortedChecks.filter(c => results[c.id]?.severity === "critical");
  const warningItems = sortedChecks.filter(c => results[c.id]?.severity === "warning");
  const infoItems = sortedChecks.filter(c => results[c.id]?.severity === "info");
  const emptyItems = sortedChecks.filter(c => results[c.id]?.severity === "empty");
  const pendingItems = sortedChecks.filter(c => !results[c.id]?.severity);

  return (
    <div style={{ paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>System Diagnostics</div>
          <div style={{ fontSize: 13, opacity: 0.4, marginTop: 3 }}>Automated health checks across API endpoints.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {allDone && actionableCount > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {counts.critical > 0 && <Badge tone="bad">{counts.critical} critical</Badge>}
              {counts.warning > 0 && <Badge tone="warn">{counts.warning} warning</Badge>}
            </div>
          )}
          <button onClick={runAll} disabled={running}
            style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid #1f2533", background: running ? "transparent" : "#0d1220", color: "inherit", fontWeight: 800, fontSize: 13, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.6 : 1 }}>
            {running ? "Running\u2026" : "Run all checks"}
          </button>
        </div>
      </div>

      {/* All healthy banner */}
      {allHealthy && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px", borderRadius: 12, marginBottom: 20,
          background: "#061a0b", border: "1px solid #0e2e1a",
        }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#4ade80" }}>All systems healthy</div>
            <div style={{ fontSize: 12, color: "rgba(74,222,128,0.6)", marginTop: 2 }}>
              {CHECKS.length} checks passed &middot; no items need attention
            </div>
          </div>
        </div>
      )}

      {/* Summary line when there are actionable items */}
      {allDone && actionableCount > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: counts.critical > 0 ? "#f87171" : "#fb923c", marginBottom: 16 }}>
          {actionableCount} item{actionableCount !== 1 ? "s" : ""} need{actionableCount === 1 ? "s" : ""} attention
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {/* Critical items — always visible */}
        {criticalItems.map((check) => <CheckCard key={check.id} check={check} result={results[check.id]} />)}

        {/* Warning items — always visible */}
        {warningItems.map((check) => <CheckCard key={check.id} check={check} result={results[check.id]} />)}

        {/* Pending items (still running) */}
        {pendingItems.map((check) => <CheckCard key={check.id} check={check} result={results[check.id]} />)}

        {/* Info items — collapsed by default if > 3 */}
        {infoItems.length > 0 && !allHealthy && (
          <>
            {infoItems.length > 3 && !infoExpanded ? (
              <>
                {infoItems.slice(0, 3).map((check) => <CheckCard key={check.id} check={check} result={results[check.id]} />)}
                <button
                  onClick={() => setInfoExpanded(true)}
                  style={{
                    padding: "8px 16px", borderRadius: 8,
                    border: "1px solid #1f2240", background: "transparent",
                    color: "#a5b4fc", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  Show {infoItems.length - 3} more info items&hellip;
                </button>
              </>
            ) : (
              infoItems.map((check) => <CheckCard key={check.id} check={check} result={results[check.id]} />)
            )}
          </>
        )}

        {/* Empty state items — always visible but ghost-styled */}
        {emptyItems.map((check) => <CheckCard key={check.id} check={check} result={results[check.id]} />)}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function AdminDevPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") as Tab) ?? "debug";
  const [tab, setTab] = useState<Tab>(initialTab);

  const weekStart = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);
  const [sidebarPracticeId, setSidebarPracticeId] = useState<string | null>(null);
  const [sidebarTherapistId, setSidebarTherapistId] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setSidebarPracticeId(localStorage.getItem("selected_practice_id"));
      setSidebarTherapistId(localStorage.getItem("selected_therapist_id"));
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c12", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @media (max-width: 767px) {
          .dev-main { padding: 64px 16px 60px !important; }
        }
      `}</style>

      <NavSidebar
        practiceId={sidebarPracticeId}
        practiceName={null}
        therapistId={sidebarTherapistId}
        weekStart={weekStart}
        adminOnly={true}
      />

      <main className="dev-main" style={{ flex: 1, minWidth: 0, padding: "40px 48px 80px", maxWidth: 960 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#374151", textDecoration: "none", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 20 }}>
            &larr; Admin
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: "linear-gradient(135deg, #1e3a8a, #4f6ef7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
              boxShadow: "0 0 24px rgba(79,110,247,0.25)",
            }}>{"\u2301"}</div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, color: "#f1f3f8", lineHeight: 1 }}>
                Developer Tools
              </h1>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 3 }}>
                API reference, inline tester, and system diagnostics
              </div>
            </div>
          </div>
        </div>

        <TabNav active={tab} onChange={setTab} />

        <div>
          {tab === "api"   && <ApiTab />}
          {tab === "debug" && <DiagnosticsTab />}
        </div>

      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminDevPage />
    </Suspense>
  );
}
