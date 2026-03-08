// app/practices/[id]/therapist-overview/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { NavSidebar } from "@/app/components/NavSidebar";
import MarkdownContent from "@/app/components/MarkdownContent";
import { SkeletonPage } from "@/app/components/ui/Skeleton";

type TherapistRow = {
  therapist_id: string;
  therapist_name: string;
  active_cases: number;
  avg_checkin_score: number | null;
  missing_checkins: number;
  at_risk_patients: number;
};

type Practice = { id: string; name: string | null };

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}
function isISODate(s: string | null) { return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s); }

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(JSON.stringify(json?.error ?? json));
  return json;
}

function scoreColor(score: number | null) {
  if (score === null) return "#6b7280";
  if (score >= 7) return "#4ade80";
  if (score >= 5) return "#eab308";
  return "#f87171";
}

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

function Section({ title, right, children }: { title: string; right?: any; children: any }) {
  return (
    <section style={{ border: "1px solid #1a1e2a", borderRadius: 12, padding: 16, background: "#0d1018" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {right && <div>{right}</div>}
      </div>
      {children}
    </section>
  );
}

function StatRow({ label, value, tone = "neutral" }: { label: string; value: any; tone?: "neutral" | "warn" | "bad" }) {
  const color = tone === "bad" ? "#f87171" : tone === "warn" ? "#fb923c" : "inherit";
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid #1a1e2a" }}>
      <div style={{ fontSize: 13, opacity: 0.65 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 15, color }}>{value}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TherapistCard({ row, practiceId: _practiceId, weekStartISO, onOpen }: {
  row: TherapistRow;
  practiceId: string;
  weekStartISO: string;
  onOpen: (id: string) => void;
}) {
  const hasRisk = row.at_risk_patients > 0;
  const hasMissing = row.missing_checkins > 0;
  const borderColor = hasRisk ? "#3d1a1a" : hasMissing ? "#3d2800" : "#1a1e2a";
  const bgColor = hasRisk ? "#1a0808" : hasMissing ? "#1a1000" : "#0d1018";

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px 16px", background: bgColor, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>{row.therapist_name}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge tone="neutral">{row.active_cases} cases</Badge>
            {hasRisk && <Badge tone="bad">{row.at_risk_patients} at-risk</Badge>}
            {hasMissing && <Badge tone="warn">{row.missing_checkins} missing</Badge>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 700, marginBottom: 2 }}>Avg score</div>
            <div style={{ fontWeight: 900, fontSize: 18, color: scoreColor(row.avg_checkin_score) }}>
              {row.avg_checkin_score === null ? "—" : row.avg_checkin_score.toFixed(1)}
            </div>
          </div>
          <Link
            href={`/dashboard/therapists/${row.therapist_id}/care?week_start=${weekStartISO}`}
            onClick={() => onOpen(row.therapist_id)}
            style={{ textDecoration: "none", padding: "8px 14px", borderRadius: 9, border: "1px solid #1f2533", background: "transparent", color: "inherit", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}
          >
            Open →
          </Link>
        </div>
      </div>
    </div>
  );
}

function fmtAvg(n: number | null) {
  return n === null || n === undefined ? "—" : n.toFixed(1);
}

// AI prompt construction moved to server-side lib/services/briefing.ts

function PracticeManagerPage() {
  const params = useParams();
  const practiceId = params?.id as string;
  const search = useSearchParams();
  const weekStartFromUrlRaw = search?.get("week_start");

  const defaultWeekStartISO = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);
  const initialWeekStartISO = useMemo(() => {
    if (!isISODate(weekStartFromUrlRaw)) return defaultWeekStartISO;
    return toMondayYYYYMMDD(weekStartFromUrlRaw!);
  }, [weekStartFromUrlRaw, defaultWeekStartISO]);

  const [pickedDateISO, setPickedDateISO] = useState(initialWeekStartISO);
  const [weekStartISO, setWeekStartISO] = useState(initialWeekStartISO);

  const [rows, setRows] = useState<TherapistRow[]>([]);
  const [practiceName, setPracticeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);

  // AI state
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem("selected_therapist_id");
      setSelectedTherapistId(t && t.length ? t : null);
    } catch {}
    try { if (practiceId) localStorage.setItem("selected_practice_id", practiceId); } catch {}
  }, [practiceId]);

  useEffect(() => {
    if (!practiceId) return;
    fetchJson("/api/practices")
      .then((json) => {
        const list: Practice[] = json?.data ?? json ?? [];
        setPracticeName(list.find((p) => p.id === practiceId)?.name ?? null);
      })
      .catch(() => {});
  }, [practiceId]);

  async function generateAI(loadedRows: TherapistRow[], loadedTotals: { totalActive: number; teamAvg: number | null; missing: number; atRisk: number }, name: string | null, week: string) {
    setAiLoading(true);
    setAiText("");
    setAiDone(false);
    setAiError(null);
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "manager",
          triggeredBy: `manager:${practiceId}`,
          caseCode: practiceId,
          stream: true,
          dataSnapshot: {
            practice_name: name,
            week_start: week ? new Date(week + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : week,
            therapists: loadedRows.map(r => ({
              name: r.therapist_name,
              active_cases: r.active_cases,
              avg_score: r.avg_checkin_score,
              missing_checkins: r.missing_checkins,
              at_risk_patients: r.at_risk_patients,
            })),
            totals: loadedTotals,
          },
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "AI error");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAiText(accumulated);
      }
      if (!accumulated) throw new Error("Empty response");
    } catch (e: any) {
      setAiError(e?.message ?? String(e));
    } finally {
      setAiLoading(false);
      setAiDone(true);
    }
  }

  async function load() {
    if (!practiceId) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson(`/api/practices/${practiceId}/therapist-overview?week_start=${encodeURIComponent(weekStartISO)}`);
      const loadedRows: TherapistRow[] = json.data ?? [];
      setRows(loadedRows);
      const scored = loadedRows.map(r => r.avg_checkin_score).filter((x): x is number => typeof x === "number");
      const loadedTotals = {
        totalActive: loadedRows.reduce((s, r) => s + (r.active_cases ?? 0), 0),
        teamAvg: scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null,
        missing: loadedRows.reduce((s, r) => s + (r.missing_checkins ?? 0), 0),
        atRisk: loadedRows.reduce((s, r) => s + (r.at_risk_patients ?? 0), 0),
      };
      generateAI(loadedRows, loadedTotals, practiceName, weekStartISO);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPickedDateISO(initialWeekStartISO);
    setWeekStartISO(initialWeekStartISO);
  }, [practiceId, initialWeekStartISO]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [practiceId, weekStartISO]);

  const totals = useMemo(() => {
    const totalActive = rows.reduce((s, r) => s + (r.active_cases ?? 0), 0);
    const scored = rows.map((r) => r.avg_checkin_score).filter((x): x is number => typeof x === "number");
    const teamAvg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
    const missing = rows.reduce((s, r) => s + (r.missing_checkins ?? 0), 0);
    const atRisk = rows.reduce((s, r) => s + (r.at_risk_patients ?? 0), 0);
    return { totalActive, teamAvg, missing, atRisk };
  }, [rows]);

  const aiSections = useMemo(() => {
    if (!aiText) return null;
    const keys = ["PRIORITY", "AT RISK", "FOLLOW UP", "THIS WEEK"];
    const out: Record<string, string> = {};
    for (const k of keys) {
      const m = aiText.match(new RegExp(`${k}:\\s*(.+?)(?=\\n[A-Z ]+:|$)`, "s"));
      if (m) out[k] = m[1].trim();
    }
    return Object.keys(out).length >= 2 ? out : null;
  }, [aiText]);

  const atRiskRows = rows.filter((r) => r.at_risk_patients > 0);
  const missingRows = rows.filter((r) => r.missing_checkins > 0);
  const displayName = practiceName ?? "…";

  function handleOpen(therapistId: string) {
    try { localStorage.setItem("selected_therapist_id", therapistId); } catch {}
    setSelectedTherapistId(therapistId);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c12", color: "#e2e8f0" }}>
      <style>{`        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        input[type="date"] { color-scheme: dark; }
        @media (max-width: 767px) {
          .tov-main { padding: 64px 16px 60px !important; }
          .tov-header { flex-direction: column !important; align-items: flex-start !important; }
          .tov-header > div:last-child { flex-direction: column !important; align-items: flex-start !important; }
          .tov-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <NavSidebar practiceId={practiceId} practiceName={practiceName} therapistId={selectedTherapistId} weekStart={weekStartISO} mode="practice" hideGroups={["Therapists"]} />

      <main className="tov-main" style={{ flex: 1, minWidth: 0, padding: "48px 56px 80px" }}>

        {/* Header */}
        <div style={{ animation: "fadeUp 0.25s ease", marginBottom: 36 }}>
          <Link href="/dashboard/manager" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#374151", textDecoration: "none", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 24 }}>
            ← Dashboard
          </Link>

          <div className="tov-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                  background: "linear-gradient(135deg, #1d4ed8 0%, #4f6ef7 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  boxShadow: "0 0 28px rgba(79,110,247,0.22), 0 0 0 1px rgba(79,110,247,0.1)",
                }}>⬡</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>Practice</div>
                  <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.8, color: "#f1f3f8", lineHeight: 1 }}>
                  {practiceName === null
                    ? <span style={{ display: "inline-block", width: 180, height: 28, borderRadius: 6, background: "linear-gradient(90deg,#1a1e2a 0%,#252b3b 50%,#1a1e2a 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", verticalAlign: "middle" }} />
                    : displayName}
                </h1>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>
                Weekly operations — care signals, risk flags, and therapist activity.
              </p>
            </div>

            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 0.5, textTransform: "uppercase" }}>Week</label>
              <input
                type="date"
                value={pickedDateISO}
                onChange={(e) => { const m = toMondayYYYYMMDD(e.target.value); setPickedDateISO(m); setWeekStartISO(m); }}
                style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid #1a1e2a", background: "#0d1018", color: "#e2e8f0", fontSize: 13 }}
              />
              <button
                onClick={load}
                disabled={loading}
                style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #1a1e2a", cursor: loading ? "not-allowed" : "pointer", background: "#0d1018", color: "#9ca3af", fontSize: 13, fontWeight: 700, opacity: loading ? 0.6 : 1, fontFamily: "inherit" }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 9, border: "1px solid #3d1a1a", background: "#1a0808", color: "#f87171", fontSize: 13, fontFamily: "monospace" }}>
            {error}
          </div>
        )}

        {/* AI Operational Briefing */}
        <div style={{ animation: "fadeUp 0.3s ease 0.06s both", borderRadius: 14, border: "1px solid #1a2240", background: "linear-gradient(160deg, #0a0e1c, #0d1018)", overflow: "hidden", marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #131a30" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #3b4fd4, #6d3fc4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" }}>Practice Briefing</div>
                <div style={{ fontSize: 11, color: "#374151", marginTop: 1 }}>AI-generated · based on this week&apos;s practice data</div>
              </div>
            </div>
            {aiDone && (
              <button
                onClick={() => generateAI(rows, totals, practiceName, weekStartISO)}
                style={{ fontSize: 11, fontWeight: 600, color: "#4b5563", background: "none", border: "1px solid #1f2533", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}
              >
                ↻ Regenerate
              </button>
            )}
          </div>
          <div style={{ padding: 16 }}>
            {aiLoading && !aiSections && (
              <div className="tov-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["55%","85%","70%"],["50%","90%","65%"],["60%","80%","72%"],["52%","88%","60%"]].map((ws, i) => (
                  <div key={i} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #131a30", background: "#080c18" }}>
                    {ws.map((w, j) => (
                      <div key={j} style={{ height: j === 0 ? 10 : 12, width: w, borderRadius: 4, marginBottom: j < ws.length - 1 ? 8 : 0, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {aiError && (
              <div style={{ fontSize: 12, color: "#f87171", background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace" }}>{aiError}</div>
            )}
            {aiText && !aiSections && (
              <div style={{ fontSize: 13, lineHeight: 1.8, color: "#c8d0e0", padding: "4px 2px" }}>
                <MarkdownContent>{aiText}</MarkdownContent>
                {aiLoading && <span style={{ display: "inline-block", width: 2, height: 13, background: "#6d3fc4", marginLeft: 3, verticalAlign: "middle", animation: "blink 1s step-end infinite" }} />}
              </div>
            )}
            {aiSections && (
              <div className="tov-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { key: "PRIORITY",  icon: "⚡", color: "#f87171", label: "Priority" },
                  { key: "AT RISK",   icon: "◉",  color: "#eab308", label: "At-risk signals" },
                  { key: "FOLLOW UP", icon: "⇄",  color: "#fb923c", label: "Follow-up needed" },
                  { key: "THIS WEEK", icon: "→",  color: "#4ade80", label: "This week" },
                ].map(({ key, icon, color, label }) => (
                  <div key={key} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #131a30", background: "#080c18" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                      <span>{icon}</span>{label}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: "#c8d0e0" }}>
                      {aiSections[key] ? <MarkdownContent>{aiSections[key]}</MarkdownContent> : "—"}
                      {aiLoading && key === "THIS WEEK" && <span style={{ display: "inline-block", width: 2, height: 13, background: "#6d3fc4", marginLeft: 3, verticalAlign: "middle", animation: "blink 1s step-end infinite" }} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="tov-two-col" style={{ animation: "fadeUp 0.35s ease 0.12s both", marginTop: 20, display: "grid", gridTemplateColumns: "0.85fr 1.5fr", gap: 14, alignItems: "start" }}>

          {/* ── Left: Practice context ── */}
          <div style={{ display: "grid", gap: 14 }}>
            <Section title="Practice snapshot">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <Badge tone="neutral">Week {weekStartISO}</Badge>
                <Badge tone={totals.atRisk > 0 ? "bad" : "good"}>
                  {totals.atRisk > 0 ? `${totals.atRisk} at-risk patients` : "No at-risk"}
                </Badge>
                {totals.missing > 0 && <Badge tone="warn">{totals.missing} missing</Badge>}
              </div>

              <StatRow label="Active cases" value={loading ? "…" : totals.totalActive} />
              <StatRow
                label="Team avg engagement"
                value={loading ? "…" : totals.teamAvg === null ? "—" : totals.teamAvg.toFixed(1)}
                tone={totals.teamAvg !== null && totals.teamAvg <= 4 ? "bad" : "neutral"}
              />
              <StatRow label="Missing check-ins" value={loading ? "…" : totals.missing} tone={totals.missing > 0 ? "warn" : "neutral"} />
              <StatRow label="At-risk patients" value={loading ? "…" : totals.atRisk} tone={totals.atRisk > 0 ? "bad" : "neutral"} />
              <StatRow label="Therapists" value={loading ? "…" : rows.length} />
            </Section>

            {/* Quick nav */}
            <Section title="Jump to">
              <div style={{ display: "grid", gap: 8 }}>
                <Link
                  href={`/practices/${practiceId}/at-risk?week_start=${weekStartISO}`}
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 9, border: "1px solid #1a1e2a", background: "#0a0c10", color: "inherit", fontWeight: 800, fontSize: 13 }}
                >
                  <span>At-risk queue</span>
                  {totals.atRisk > 0 && <Badge tone="bad">{totals.atRisk}</Badge>}
                </Link>
                <Link
                  href={`/practices/${practiceId}/health-score?practice_id=${practiceId}&week_start=${weekStartISO}`}
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 9, border: "1px solid #1a1e2a", background: "#0a0c10", color: "inherit", fontWeight: 800, fontSize: 13 }}
                >
                  <span>Health score</span>
                  <span style={{ opacity: 0.4, fontSize: 12 }}>→</span>
                </Link>
                <Link
                  href={`/cases?practice_id=${practiceId}`}
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 9, border: "1px solid #1a1e2a", background: "#0a0c10", color: "inherit", fontWeight: 800, fontSize: 13 }}
                >
                  <span>Case queue</span>
                  <span style={{ opacity: 0.4, fontSize: 12 }}>→</span>
                </Link>
              </div>
            </Section>
          </div>

          {/* ── Right: Signal panels + roster ── */}
          <div style={{ display: "grid", gap: 14 }}>

            {/* Risk signals */}
            <Section
              title="Risk signals"
              right={<Badge tone={atRiskRows.length > 0 ? "bad" : "good"}>{atRiskRows.length > 0 ? `${totals.atRisk} at-risk patients` : "All clear"}</Badge>}
            >
              {atRiskRows.length === 0 ? (
                <div style={{ opacity: 0.55, fontSize: 13 }}>No at-risk patients this week.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {atRiskRows.map((r) => (
                    <div key={r.therapist_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid #3d1a1a", background: "#1a0808", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{r.therapist_name}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#f87171" }}>{r.at_risk_patients} patient{r.at_risk_patients !== 1 ? "s" : ""} flagged</div>
                      </div>
                      <Link
                        href={`/dashboard/therapists/${r.therapist_id}/care?week_start=${weekStartISO}`}
                        onClick={() => handleOpen(r.therapist_id)}
                        style={{ textDecoration: "none", borderBottom: "1px dotted rgba(255,255,255,0.3)", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", color: "#f87171" }}
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Follow-up needed */}
            <Section
              title="Follow-up needed"
              right={<Badge tone={missingRows.length > 0 ? "warn" : "good"}>{missingRows.length > 0 ? `${totals.missing} missing` : "All checked in"}</Badge>}
            >
              {missingRows.length === 0 ? (
                <div style={{ opacity: 0.55, fontSize: 13 }}>All patients have checked in this week.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {missingRows.map((r) => (
                    <div key={r.therapist_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid #3d2800", background: "#1a1000", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{r.therapist_name}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#fb923c" }}>{r.missing_checkins} check-in{r.missing_checkins !== 1 ? "s" : ""} outstanding</div>
                      </div>
                      <Link
                        href={`/dashboard/therapists/${r.therapist_id}/care?week_start=${weekStartISO}`}
                        onClick={() => handleOpen(r.therapist_id)}
                        style={{ textDecoration: "none", borderBottom: "1px dotted rgba(255,255,255,0.3)", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", color: "#fb923c" }}
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Full roster */}
            <Section
              title="Therapist roster"
              right={<span style={{ fontSize: 13, opacity: 0.45, fontWeight: 600 }}>{rows.length} therapist{rows.length !== 1 ? "s" : ""}</span>}
            >
              {loading && <div style={{ opacity: 0.55, fontSize: 13 }}>Loading…</div>}
              {!loading && rows.length === 0 && !error && (
                <div style={{ opacity: 0.55, fontSize: 13 }}>No therapists found for this practice.</div>
              )}
              <div style={{ display: "grid", gap: 10 }}>
                {rows.map((row) => (
                  <TherapistCard
                    key={row.therapist_id}
                    row={row}
                    practiceId={practiceId}
                    weekStartISO={weekStartISO}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <PracticeManagerPage />
    </Suspense>
  );
}
