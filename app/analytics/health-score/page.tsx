// app/analytics/health-score/page.tsx
// Module 1: Practice Health Score — full analytics sub-page
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isDemoMode } from "@/lib/demo/demoMode";

type THSComponents = {
  total: number;
  workload: number;
  satisfaction: number;
  outcomes: number;
  stability: number;
};

type Movement = { direction: "up" | "down"; label: string; detail: string };
type Recommendation = { priority: "high" | "medium" | "low"; action: string; reason: string };

type ThsResponse = {
  practice_id: string;
  week_start: string;
  score: number | null;
  band: "Optimal" | "Balanced" | "Needs attention" | "No data";
  ths_components: THSComponents | null;
  trend: {
    prior_week_start: string;
    prior_score: number | null;
    delta: number | null;
    direction: "up" | "down" | "flat" | null;
  };
  movements: Movement[];
  recommendations: Recommendation[];
  drivers: {
    avg_checkin_score: number | null;
    therapists_count: number;
    cases_count: number;
    unassigned_cases_count: number;
    avg_cases_per_therapist: number;
    workload_spread: number;
    cases_by_therapist: Record<string, number>;
    at_risk_count: number;
    checkin_count: number;
  };
};

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}

const BAND_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Optimal":        { color: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },
  "Balanced":       { color: "#eab308", bg: "#1a1200", border: "#3d2c00" },
  "Needs attention":{ color: "#f87171", bg: "#1a0808", border: "#3d1a1a" },
  "No data":        { color: "#6b7280", bg: "#0d1018", border: "#1a1e2a" },
};

const PRIORITY_STYLES: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  high:   { color: "#f87171", bg: "#1a0808", border: "#3d1a1a", dot: "#f87171" },
  medium: { color: "#fb923c", bg: "#1a1000", border: "#3d2800", dot: "#fb923c" },
  low:    { color: "#4ade80", bg: "#061a0b", border: "#0e2e1a", dot: "#4ade80" },
};

function Shimmer({ height = 20, width = "100%", radius = 8 }: { height?: number; width?: string | number; radius?: number }) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
    }} />
  );
}

function DriverBar({ label, value, weight, color }: { label: string; value: number; weight: string; color: string }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#c8d0e0" }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: -0.5 }}>{value.toFixed(1)}</span>
          <span style={{ fontSize: 11, color: "#4b5563" }}>/ 10</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#374151", background: "#0d1018", border: "1px solid #1a1e2a", borderRadius: 6, padding: "1px 6px" }}>×{weight}</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "#1a1e2a", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "live" | "coming-soon" }) {
  const isLive = status === "live";
  const color = isLive ? "#4ade80" : "#d97706";
  const label = isLive ? "Live" : "Coming soon";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const,
      color, opacity: 0.95,
      background: isLive ? "rgba(74,222,128,0.1)" : "rgba(217,119,6,0.1)",
      border: `1px solid ${isLive ? "rgba(74,222,128,0.3)" : "rgba(217,119,6,0.3)"}`,
      padding: "2px 8px", borderRadius: 999,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: color,
        boxShadow: isLive ? `0 0 6px ${color}` : "none",
        display: "inline-block",
      }} />
      {label}
    </span>
  );
}

export default function HealthScorePage() {
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [ths, setThs] = useState<ThsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const defaultWeek = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);
  const [pickedDate, setPickedDate] = useState(defaultWeek);
  const [weekStart, setWeekStart] = useState(defaultWeek);

  useEffect(() => {
    setPracticeId(localStorage.getItem("selected_practice_id"));
  }, []);

  useEffect(() => {
    if (!practiceId) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const isDemo = isDemoMode();
        const demoParam = isDemo ? "&demo=true" : "";
        const res = await fetch(
          `/api/practices/${encodeURIComponent(practiceId!)}/ths?week_start=${encodeURIComponent(weekStart)}${demoParam}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setThs(json.data ?? null);
      } catch {
        if (!cancelled) setThs(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [practiceId, weekStart]);

  const score = ths?.score ?? null;
  const band = ths?.band ?? "No data";
  const bandStyle = BAND_STYLES[band] ?? BAND_STYLES["No data"];
  const trend = ths?.trend;
  const delta = trend?.delta ?? null;
  const direction = trend?.direction ?? null;
  const components = ths?.ths_components ?? null;
  const movements = ths?.movements ?? [];
  const recommendations = ths?.recommendations ?? [];
  const hasData = components !== null;

  return (
    <div style={{ minHeight: "100vh", background: "#080c12", color: "#f1f5f9", fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input[type="date"] { color-scheme: dark; }
        @media (max-width: 767px) {
          .ths-page-main { padding: 24px 16px 60px !important; }
          .ths-hero-inner { flex-direction: column !important; }
          .ths-formula { border-left: none !important; padding-left: 0 !important; border-top: 1px solid #1a1e2a; padding-top: 16px; margin-top: 16px; }
          .ths-driver-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="ths-page-main" style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Back link */}
        <Link href="/analytics" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 24, transition: "color 0.2s" }}>
          ← Back to Analytics
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: "#f1f5f9" }}>
                Practice Health Score
              </h1>
              <StatusBadge status="live" />
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              Proprietary composite metric · Week of {ths?.week_start ?? weekStart}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="date" value={pickedDate}
              onChange={(e) => { const m = toMondayYYYYMMDD(e.target.value); setPickedDate(m); setWeekStart(m); }}
              style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid #1a2035", background: "#0d1018", color: "#e2e8f0", fontSize: 13 }}
            />
          </div>
        </div>

        {/* THS Hero */}
        <div style={{ animation: "fadeUp 0.25s ease", marginBottom: 16, borderRadius: 16, border: `1px solid ${bandStyle.border}`, background: `linear-gradient(160deg, ${bandStyle.bg}, #080c12)`, overflow: "hidden" }}>
          <div className="ths-hero-inner" style={{ padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <Shimmer height={52} width={120} />
                <Shimmer height={16} width={200} />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>THS Score</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: -3, color: bandStyle.color, lineHeight: 1 }}>
                    {score !== null ? score.toFixed(1) : "—"}
                  </span>
                  <span style={{ fontSize: 20, color: "#374151", fontWeight: 700 }}>/10</span>
                  {delta !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: direction === "up" ? "#061a0b" : direction === "down" ? "#1a0808" : "#0d1018", border: `1px solid ${direction === "up" ? "#0e2e1a" : direction === "down" ? "#3d1a1a" : "#1a1e2a"}` }}>
                      <span style={{ fontSize: 14, color: direction === "up" ? "#4ade80" : direction === "down" ? "#f87171" : "#6b7280" }}>
                        {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: direction === "up" ? "#4ade80" : direction === "down" ? "#f87171" : "#6b7280" }}>
                        {delta > 0 ? "+" : ""}{delta} vs last week
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 20, color: bandStyle.color, background: bandStyle.bg, border: `1px solid ${bandStyle.border}` }}>
                    {band}
                  </span>
                  {trend?.prior_score !== null && trend?.prior_score !== undefined && (
                    <span style={{ fontSize: 12, color: "#374151" }}>Prior week: {trend.prior_score.toFixed(1)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Formula */}
            <div className="ths-formula" style={{ fontSize: 11, color: "#374151", fontFamily: "monospace", lineHeight: 2, borderLeft: "1px solid #1a1e2a", paddingLeft: 24 }}>
              <div style={{ fontWeight: 700, color: "#4b5563", marginBottom: 4, fontFamily: "inherit" }}>Formula</div>
              <div>THS = 0.25 · Workload</div>
              <div style={{ paddingLeft: 36 }}>+ 0.25 · Satisfaction</div>
              <div style={{ paddingLeft: 36 }}>+ 0.35 · Outcomes</div>
              <div style={{ paddingLeft: 36 }}>+ 0.15 · Stability</div>
            </div>
          </div>
        </div>

        {/* Driver Components */}
        <div className="ths-driver-grid" style={{ animation: "fadeUp 0.3s ease 0.06s both", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} style={{ padding: 20, borderRadius: 12, border: "1px solid #1a2035", background: "#0d1018", display: "grid", gap: 10 }}>
                <Shimmer height={13} width="60%" />
                <Shimmer height={6} width="100%" radius={99} />
              </div>
            ))
          ) : components ? (
            [
              { key: "workload",     label: "Workload",     weight: "0.25", color: "#6b82d4", desc: "Caseload balance across therapists" },
              { key: "satisfaction", label: "Satisfaction", weight: "0.25", color: "#7c5cfc", desc: "Avg patient check-in score" },
              { key: "outcomes",     label: "Outcomes",     weight: "0.35", color: "#00c8a0", desc: "Score × engagement rate" },
              { key: "stability",    label: "Stability",    weight: "0.15", color: "#fb923c", desc: "Penalized by unassigned + at-risk" },
            ].map(({ key, label, weight, color, desc }) => (
              <div key={key} style={{ padding: 20, borderRadius: 12, border: "1px solid #1a2035", background: "#0d1018" }}>
                <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 10 }}>{desc}</div>
                <DriverBar label={label} value={(components as any)[key]} weight={weight} color={color} />
              </div>
            ))
          ) : (
            <div style={{ gridColumn: "1 / -1", padding: "28px 24px", borderRadius: 12, border: "1px solid #1a2035", background: "#0d1018", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#4b5563", marginBottom: 8 }}>No check-in data this week</div>
              <div style={{ fontSize: 13, color: "#374151" }}>THS requires at least one patient check-in to compute.</div>
            </div>
          )}
        </div>

        {/* What moved THS this week */}
        {(hasData || loading) && (
          <div style={{ animation: "fadeUp 0.35s ease 0.1s both", marginBottom: 16, borderRadius: 12, border: "1px solid #1a2035", background: "#0d1018", overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #131720", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8 }}>What moved THS this week</div>
            </div>
            <div style={{ padding: "14px 20px" }}>
              {loading ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <Shimmer height={14} width="70%" />
                  <Shimmer height={14} width="55%" />
                </div>
              ) : movements.length === 0 ? (
                <div style={{ fontSize: 13, color: "#374151" }}>
                  {trend?.prior_score === null ? "No prior week data to compare against." : "No significant movements vs last week."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {movements.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1px solid ${m.direction === "up" ? "#0e2e1a" : "#3d1a1a"}`, background: m.direction === "up" ? "#061a0b" : "#1a0808" }}>
                      <span style={{ fontSize: 16, color: m.direction === "up" ? "#4ade80" : "#f87171", flexShrink: 0 }}>
                        {m.direction === "up" ? "↑" : "↓"}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: m.direction === "up" ? "#4ade80" : "#f87171" }}>{m.label}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommended actions */}
        {(hasData || loading) && (
          <div style={{ animation: "fadeUp 0.4s ease 0.14s both", marginBottom: 24, borderRadius: 12, border: "1px solid #1a2035", background: "#0d1018", overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #131720" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8 }}>Recommended actions this week</div>
            </div>
            <div style={{ padding: "14px 20px" }}>
              {loading ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <Shimmer height={40} />
                  <Shimmer height={40} />
                </div>
              ) : recommendations.length === 0 ? (
                <div style={{ fontSize: 13, color: "#374151" }}>No recommendations at this time.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {recommendations.map((r, i) => {
                    const ps = PRIORITY_STYLES[r.priority];
                    return (
                      <div key={i} style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${ps.border}`, background: ps.bg, display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: ps.dot, flexShrink: 0, marginTop: 5, boxShadow: r.priority === "high" ? `0 0 6px ${ps.dot}88` : "none" }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: ps.color }}>{r.action}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, lineHeight: 1.5 }}>{r.reason}</div>
                        </div>
                        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: ps.color, background: "transparent", border: `1px solid ${ps.border}`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {r.priority}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
