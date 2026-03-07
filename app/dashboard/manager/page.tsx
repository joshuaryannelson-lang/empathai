// app/dashboard/manager/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NavSidebar } from "@/app/components/NavSidebar";
import AIBriefing, { type AIBriefingData } from "@/app/components/ai/AIBriefing";

type RangeKey = "1d" | "7d" | "30d" | "this_week" | "last_week";

type AdminOverview = {
  range: RangeKey;
  window: { start: string; end: string };
  totals: {
    practices: number;
    therapists: number;
    active_cases: number;
    unassigned_cases: number;
    checkins: number;
    avg_score: number | null;
    at_risk_checkins: number;
  };
  practices: Array<{
    id: string;
    name: string | null;
    therapists: number;
    active_cases: number;
    total_cases: number;
    unassigned_cases: number;
    checkins: number;
    avg_score: number | null;
    at_risk_checkins: number;
  }>;
};

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(JSON.stringify(json?.error ?? json));
  return json;
}

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}
function fmtAvg(n: number | null) {
  return n === null || n === undefined ? "—" : n.toFixed(1);
}

// AI prompt construction moved to server-side lib/services/briefing.ts

function ManagerDashboardInner() {
  const searchParams = useSearchParams();
  const roleParam = searchParams?.get("role") ?? null;
  const isOwnerRole = roleParam === "owner";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminOverview | null>(null);

  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);

  // Structured AI briefing state
  const [structuredBriefing, setStructuredBriefing] = useState<AIBriefingData | null>(null);
  const [structuredLoading, setStructuredLoading] = useState(false);

  const defaultWeekStartISO = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson(`/api/admin/overview?range=7d`);
      const overview = json.data ?? null;
      setData(overview);
      if (overview) {
        loadStructuredBriefing(overview);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadStructuredBriefing(overview: AdminOverview) {
    setStructuredLoading(true);
    try {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: isOwnerRole ? "owner" : "manager",
          dataSnapshot: {
            totals: overview.totals,
            practices: overview.practices,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.data) setStructuredBriefing(json.data);
    } catch { /* ignore */ }
    finally { setStructuredLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const [managerMode, setManagerMode] = useState<"multi" | "single" | null>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem("selected_practice_id");
      const t = localStorage.getItem("selected_therapist_id");
      const m = localStorage.getItem("selected_manager_mode") as "multi" | "single" | null;
      setSelectedPracticeId(p?.length ? p : null);
      setSelectedTherapistId(t?.length ? t : null);
      setManagerMode(m);
    } catch {}
  }, []);

  const selectedPracticeName = useMemo(
    () => (data?.practices ?? []).find(p => p.id === selectedPracticeId)?.name ?? null,
    [data, selectedPracticeId]
  );

  const [filterPracticeId, setFilterPracticeId] = useState<string>("");

  // Filter practices based on manager mode
  const allPractices = useMemo(() => {
    const raw = data?.practices ?? [];
    if (managerMode === "multi") return raw.filter(p => p.name?.toLowerCase().includes("northside"));
    if (managerMode === "single" && selectedPracticeId) return raw.filter(p => p.id === selectedPracticeId);
    return raw;
  }, [data, managerMode, selectedPracticeId]);
  const practices = filterPracticeId
    ? allPractices.filter(p => p.id === filterPracticeId)
    : allPractices;

  // Recompute totals from filtered practices (or use API totals for "all")
  const totals = useMemo(() => {
    if (!filterPracticeId) return data?.totals ?? null;
    const p = allPractices.find(p => p.id === filterPracticeId);
    if (!p) return data?.totals ?? null;
    return {
      practices: 1,
      therapists: p.therapists,
      active_cases: p.active_cases,
      unassigned_cases: p.unassigned_cases,
      checkins: p.checkins,
      avg_score: p.avg_score,
      at_risk_checkins: p.at_risk_checkins,
    };
  }, [filterPracticeId, allPractices, data]);

  const scoreColor = (s: number | null) => {
    if (s === null) return "#6b7280";
    if (s <= 3) return "#f87171";
    if (s <= 5) return "#eab308";
    return "#4ade80";
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c12", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui" }}>
      <NavSidebar
        practiceId={selectedPracticeId}
        practiceName={selectedPracticeName}
        therapistId={selectedTherapistId}
        weekStart={defaultWeekStartISO}
        hideGroups={["Therapist"]}
      />

      <main className="mgr-main" style={{ flex: 1, padding: "36px 40px 80px", maxWidth: 1100, overflowX: "hidden" }}>

        {/* Header */}
        <div className="mgr-header" data-tour="dashboard-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#4b5563", marginBottom: 6 }}>
              {isOwnerRole ? "Organization Owner" : managerMode === "single" ? "Practice Owner" : "Network Manager"}
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#f1f3f8" }}>
              {isOwnerRole
                ? "Your Organization"
                : filterPracticeId
                  ? (allPractices.find(p => p.id === filterPracticeId)?.name ?? "Practice Operations")
                  : managerMode === "single"
                    ? (allPractices[0]?.name ?? "Your Practice")
                    : "Practice Operations"}
            </h1>
            <div style={{ marginTop: 4, fontSize: 13, color: "#4b5563" }}>
              {isOwnerRole
                ? "Network-level view · Last 7 days"
                : filterPracticeId
                  ? "Single practice view · Last 7 days"
                  : managerMode === "single"
                    ? "Your practice · Last 7 days"
                    : "Network-wide view · Last 7 days"}
            </div>
          </div>
          <div data-tour="quick-actions" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <select
              value={filterPracticeId}
              onChange={e => setFilterPracticeId(e.target.value)}
              style={{
                padding: "9px 12px", borderRadius: 9,
                border: "1px solid #1f2533", background: "#0d1018",
                color: filterPracticeId ? "#e2e8f0" : "#6b7280",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                cursor: "pointer", outline: "none",
              }}
            >
              <option value="">{managerMode === "single" ? "Your practice" : "All practices"}</option>
              {allPractices.map(p => (
                <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
              ))}
            </select>
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: "9px 16px", borderRadius: 9,
                border: "1px solid #1f2533", background: "#0d1018",
                color: "#9ca3af", fontFamily: "inherit", fontSize: 13,
                fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1, transition: "all .15s",
              }}
            >
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#1a0808", border: "1px solid #3d1a1a", color: "#fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 12, fontFamily: "monospace", marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Stat tiles */}
        <div className="mgr-stats" data-tour="caseload-metrics" data-demo-spotlight="manager-kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Practices", value: totals?.practices ?? "—", accent: "#6b82d4" },
            { label: "Therapists", value: totals?.therapists ?? "—", accent: "#6b82d4" },
            { label: "Active cases", value: totals?.active_cases ?? "—", accent: "#9ca3af" },
            {
              label: "Unassigned",
              value: totals?.unassigned_cases ?? "—",
              accent: (totals?.unassigned_cases ?? 0) > 0 ? "#fb923c" : "#4ade80",
              bg: (totals?.unassigned_cases ?? 0) > 0 ? "#1a1000" : undefined,
              border: (totals?.unassigned_cases ?? 0) > 0 ? "#3d2800" : undefined,
            },
            { label: "Check-ins", value: totals?.checkins ?? "—", accent: "#9ca3af" },
            {
              label: "Avg score",
              value: fmtAvg(totals?.avg_score ?? null),
              accent: scoreColor(totals?.avg_score ?? null),
              bg: (totals?.avg_score ?? 10) <= 4 ? "#1a0808" : undefined,
              border: (totals?.avg_score ?? 10) <= 4 ? "#3d1a1a" : undefined,
            },
          ].map(({ label, value, accent, bg, border }) => (
            <div key={label} style={{
              padding: "14px 16px", borderRadius: 12,
              border: `1px solid ${border ?? "#1a1e2a"}`,
              background: bg ?? "#0d1018",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#4b5563", marginBottom: 8 }}>
                {label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: accent }}>
                {loading && value === "—" ? <span style={{ opacity: 0.3 }}>—</span> : value}
              </div>
            </div>
          ))}
        </div>

        {/* AI Operational Briefing — structured */}
        <div style={{ marginBottom: 20 }} data-demo-spotlight="ai-briefing-panel">
          <AIBriefing
            briefing={structuredBriefing}
            isLoading={structuredLoading}
            onRegenerate={() => data && loadStructuredBriefing(data)}
            context={isOwnerRole ? "owner" : "manager"}
          />
        </div>

        {/* Issues row */}
        <div className="mgr-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {/* Routing friction */}
          <div data-demo-spotlight="routing-friction" style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid #131720" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7 }}>
                Routing friction
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                background: (totals?.unassigned_cases ?? 0) > 0 ? "#1a1000" : "#061a0b",
                border: `1px solid ${(totals?.unassigned_cases ?? 0) > 0 ? "#3d2800" : "#0e2e1a"}`,
                color: (totals?.unassigned_cases ?? 0) > 0 ? "#fb923c" : "#4ade80",
              }}>
                {(totals?.unassigned_cases ?? 0) > 0 ? `${totals?.unassigned_cases} unassigned` : "All routed"}
              </span>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 10, lineHeight: 1.5 }}>
                Cases not yet attached to a therapist — need routing before the week&apos;s sessions.
              </div>
              {practices.filter(p => p.unassigned_cases > 0).length === 0 ? (
                <div style={{ fontSize: 13, color: "#374151" }}>No routing issues this period.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {practices.filter(p => p.unassigned_cases > 0).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid #3d2800", background: "#0f0b04" }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name ?? p.id}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fb923c", background: "#1a1000", border: "1px solid #3d2800", padding: "2px 8px", borderRadius: 20 }}>
                        {p.unassigned_cases} unassigned
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Risk signals */}
          <div data-demo-spotlight="risk-signals" style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid #131720" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7 }}>
                Risk signals
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                background: (totals?.at_risk_checkins ?? 0) > 0 ? "#1a0808" : "#061a0b",
                border: `1px solid ${(totals?.at_risk_checkins ?? 0) > 0 ? "#3d1a1a" : "#0e2e1a"}`,
                color: (totals?.at_risk_checkins ?? 0) > 0 ? "#f87171" : "#4ade80",
              }}>
                {(totals?.at_risk_checkins ?? 0) > 0 ? `${totals?.at_risk_checkins} at-risk` : "None flagged"}
              </span>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 10, lineHeight: 1.5 }}>
                Check-ins with scores ≤ 3 this week — flagged for therapist follow-up. Count reflects check-in events, not unique patients.
              </div>
              {practices.filter(p => p.at_risk_checkins > 0).length === 0 ? (
                <div style={{ fontSize: 13, color: "#374151" }}>No at-risk check-ins this period.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {practices.filter(p => p.at_risk_checkins > 0).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid #3d1a1a", background: "#0f0808" }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name ?? p.id}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", background: "#1a0808", border: "1px solid #3d1a1a", padding: "2px 8px", borderRadius: 20 }}>
                        {p.at_risk_checkins} at-risk
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Practice snapshot */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
            Practice snapshot
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {loading && !data && [1, 2, 3].map(i => (
              <div key={i} style={{ height: 72, borderRadius: 12, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
            ))}
            {practices.map(p => {
              const hasRisk = p.at_risk_checkins > 0;
              const hasUnassigned = p.unassigned_cases > 0;
              const borderColor = hasRisk ? "#3d1a1a" : hasUnassigned ? "#3d2800" : "#1a1e2a";
              const bgColor = hasRisk ? "#0f0808" : hasUnassigned ? "#0f0b04" : "#0d1018";
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", borderRadius: 12, border: `1px solid ${borderColor}`, background: bgColor }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f3f8", marginBottom: 6 }}>{p.name ?? p.id}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[
                        { label: `${p.therapists} therapists`, tone: "neutral" },
                        { label: `${p.active_cases} active`, tone: "neutral" },
                        { label: `${p.unassigned_cases} unassigned`, tone: p.unassigned_cases > 0 ? "warn" : "good" },
                        { label: `${p.at_risk_checkins} at-risk`, tone: p.at_risk_checkins > 0 ? "bad" : "good" },
                        { label: `avg ${fmtAvg(p.avg_score)}`, tone: (p.avg_score ?? 10) <= 4 ? "bad" : "neutral" },
                      ].map(({ label, tone }) => {
                        const fg = tone === "bad" ? "#f87171" : tone === "warn" ? "#fb923c" : tone === "good" ? "#4ade80" : "#6b7280";
                        const bg = tone === "bad" ? "#1a0808" : tone === "warn" ? "#1a1000" : tone === "good" ? "#061a0b" : "#0d1018";
                        const bd = tone === "bad" ? "#3d1a1a" : tone === "warn" ? "#3d2800" : tone === "good" ? "#0e2e1a" : "#1a1e2a";
                        return (
                          <span key={label} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: fg, background: bg, border: `1px solid ${bd}` }}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <Link
                    href={`/practices/${encodeURIComponent(p.id)}/therapist-overview?week_start=${encodeURIComponent(defaultWeekStartISO)}`}
                    style={{ fontSize: 12, fontWeight: 700, color: "inherit", textDecoration: "none", opacity: 0.5, whiteSpace: "nowrap", flexShrink: 0, transition: "opacity .15s" }}
                  >
                    Open →
                  </Link>
                </div>
              );
            })}
            {!loading && practices.length === 0 && !error && (
              <div style={{ fontSize: 13, color: "#374151", padding: "20px 0" }}>No practices found.</div>
            )}
          </div>
        </div>

      </main>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        select { color-scheme: dark; }
        @media (max-width: 767px) {
          .mgr-main { padding: 64px 16px 60px !important; }
          .mgr-header { flex-direction: column !important; align-items: flex-start !important; }
          .mgr-header > div:last-child { width: 100%; }
          .mgr-header select { flex: 1; min-width: 0; }
          .mgr-stats { grid-template-columns: repeat(3, 1fr) !important; }
          .mgr-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export default function ManagerDashboard() {
  return (
    <Suspense fallback={null}>
      <ManagerDashboardInner />
    </Suspense>
  );
}
