// app/practices/[id]/health-score/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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

type Therapist = { id: string; name: string };

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error("Failed to fetch");
  return json;
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

function PracticeThsPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const practiceId = params?.id as string;
  const isDemo = searchParams?.get("demo") === "true";

  const defaultWeekStartISO = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);
  const [pickedDateISO, setPickedDateISO] = useState(defaultWeekStartISO);
  const [weekStartISO, setWeekStartISO] = useState(defaultWeekStartISO);

  const [ths, setThs] = useState<ThsResponse | null>(null);
  const [therapistNameById, setTherapistNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  async function load() {
    if (!practiceId) return;
    setLoading(true);
    try {
      const json = await fetchJson(`/api/practices/${encodeURIComponent(practiceId)}/ths?week_start=${encodeURIComponent(weekStartISO)}${isDemo ? "&demo=true" : ""}`);
      setThs(json.data ?? null);
    } catch {
      setThs(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadTherapistNames() {
    if (!practiceId) return;
    try {
      const json = await fetchJson(`/api/therapists?practice_id=${encodeURIComponent(practiceId)}${isDemo ? "&demo=true" : ""}`);
      const list: Therapist[] = json?.data ?? [];
      const map: Record<string, string> = {};
      list.forEach((t) => (map[t.id] = t.name));
      setTherapistNameById(map);
    } catch {
      // best-effort
    }
  }

  async function seedDemo() {
    setSeedStatus("loading");
    setSeedMsg(null);
    try {
      const res = await fetch("/api/admin/seed/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStartISO }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? JSON.stringify(json?.error));
      setSeedMsg(json?.data?.message ?? "Demo data loaded.");
      setSeedStatus("done");
      await load();
    } catch (e: any) {
      setSeedMsg(e?.message ?? String(e));
      setSeedStatus("error");
    }
  }

  useEffect(() => { load(); loadTherapistNames(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [practiceId, weekStartISO]);

  const bucketISO = ths?.week_start ?? weekStartISO;
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
    <main style={{ padding: "40px 48px 80px", maxWidth: 900, background: "#080c12", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input[type="date"] { color-scheme: dark; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <div>
          <Link href={`/practices/${practiceId}/therapist-overview?week_start=${encodeURIComponent(weekStartISO)}`} style={{ textDecoration: "none", fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 0.5, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
            ← Practice Overview
          </Link>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: "#f1f3f8" }}>
            Therapeutic Health Score
          </h1>
          <div style={{ marginTop: 4, fontSize: 13, color: "#4b5563" }}>
            Proprietary composite metric · Practice {practiceId.slice(0, 8)}… · Week of {bucketISO}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={pickedDateISO}
            onChange={(e) => { const m = toMondayYYYYMMDD(e.target.value); setPickedDateISO(m); setWeekStartISO(m); }}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid #1a1e2a", background: "#0d1018", color: "#e2e8f0", fontSize: 13 }}
          />
          <button onClick={load} disabled={loading}
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #1a1e2a", background: "#0d1018", color: "#9ca3af", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── THS Hero ── */}
      <div style={{ animation: "fadeUp 0.25s ease", marginBottom: 16, borderRadius: 16, border: `1px solid ${bandStyle.border}`, background: `linear-gradient(160deg, ${bandStyle.bg}, #080c12)`, overflow: "hidden" }}>
        <div style={{ padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          {loading && !ths ? (
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
          <div style={{ fontSize: 11, color: "#374151", fontFamily: "monospace", lineHeight: 2, borderLeft: "1px solid #1a1e2a", paddingLeft: 24 }}>
            <div style={{ fontWeight: 700, color: "#4b5563", marginBottom: 4, fontFamily: "inherit" }}>Formula</div>
            <div>THS = 0.25 · Workload</div>
            <div style={{ paddingLeft: 36 }}>+ 0.25 · Satisfaction</div>
            <div style={{ paddingLeft: 36 }}>+ 0.35 · Outcomes</div>
            <div style={{ paddingLeft: 36 }}>+ 0.15 · Stability</div>
          </div>
        </div>
      </div>

      {/* ── Driver Components ── */}
      <div style={{ animation: "fadeUp 0.3s ease 0.06s both", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {loading && !components ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: 20, borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", display: "grid", gap: 10 }}>
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
            <div key={key} style={{ padding: 20, borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018" }}>
              <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 10 }}>{desc}</div>
              <DriverBar label={label} value={(components as any)[key]} weight={weight} color={color} />
            </div>
          ))
        ) : !loading && (
          <div style={{ gridColumn: "1 / -1", padding: "28px 24px", borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#4b5563", marginBottom: 8 }}>No check-in data this week</div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>THS requires at least one patient check-in to compute.</div>
            {!isDemo && (
              <>
                {seedMsg && (
                  <div style={{ fontSize: 12, marginBottom: 12, padding: "8px 10px", borderRadius: 8, display: "inline-block", background: seedStatus === "error" ? "#1a0808" : "#061a0b", border: `1px solid ${seedStatus === "error" ? "#3d1a1a" : "#0e2e1a"}`, color: seedStatus === "error" ? "#f87171" : "#4ade80", fontFamily: "monospace" }}>
                    {seedMsg}
                  </div>
                )}
                <div>
                  <button onClick={seedDemo} disabled={seedStatus === "loading"}
                    style={{ fontSize: 13, fontWeight: 700, color: "#f5a623", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.35)", borderRadius: 9, padding: "10px 20px", cursor: seedStatus === "loading" ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {seedStatus === "loading" ? "Seeding…" : "⚡ Load Demo Data"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── What moved THS this week ── */}
      {(hasData || loading) && (
        <div style={{ animation: "fadeUp 0.35s ease 0.1s both", marginBottom: 16, borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #131720", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8 }}>What moved THS this week</div>
          </div>
          <div style={{ padding: "14px 20px" }}>
            {loading && !ths ? (
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
                      {m.direction === "up" ? "+" : "−"}
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

      {/* ── Recommended actions ── */}
      {(hasData || loading) && (
        <div style={{ animation: "fadeUp 0.4s ease 0.14s both", marginBottom: 24, borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #131720" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8 }}>Recommended actions this week</div>
          </div>
          <div style={{ padding: "14px 20px" }}>
            {loading && !ths ? (
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

      {/* ── Caseload by therapist ── */}
      <div style={{ animation: "fadeUp 0.45s ease 0.18s both" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          Caseload by therapist
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {loading && !ths ? (
            [1, 2, 3].map(i => <Shimmer key={i} height={48} radius={12} />)
          ) : ths?.drivers?.cases_by_therapist && Object.keys(ths.drivers.cases_by_therapist).length ? (
            Object.entries(ths.drivers.cases_by_therapist).map(([therapistId, count]) => {
              const name = therapistNameById[therapistId] ?? therapistId;
              const isFallback = !therapistNameById[therapistId];
              return (
                <div key={therapistId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018" }}>
                  <Link
                    href={`/dashboard/therapists/${therapistId}/care?week_start=${encodeURIComponent(bucketISO)}`}
                    style={{ fontWeight: 700, textDecoration: "none", borderBottom: "1px dotted rgba(255,255,255,0.2)", fontFamily: isFallback ? "monospace" : "inherit", fontSize: 14, color: "#c8d0e0" }}
                  >
                    {name}
                  </Link>
                  <span style={{ fontWeight: 900, fontSize: 15, color: "#e2e8f0" }}>{count} cases</span>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: "#374151" }}>No therapist assignments found.</div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PracticeThsPage() {
  return (
    <Suspense fallback={null}>
      <PracticeThsPageInner />
    </Suspense>
  );
}
