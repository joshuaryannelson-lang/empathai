// app/analytics/page.tsx
// Analytics index — 4 module cards, LIVE cards navigate, COMING SOON cards muted
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo/demoMode";

// ── Types ────────────────────────────────────────────────────────────────────
type ThsData = {
  score: number | null;
  band: string | null;
  trend: {
    delta: number | null;
    direction: "up" | "down" | "flat" | null;
  };
};

type WeekData = {
  week: string;
  total: number;
  uniquePatients: number;
  avgMood: number | null;
  completionRate: number;
};

// ── Sparkline (only renders with real data) ──────────────────────────────────
function Sparkline({ values, width = 160, height = 52, color = "#f5a623" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = [`0,${height}`, ...pts, `${width},${height}`];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`fill-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${fillPts.join(" L")}Z`} fill={`url(#fill-${color.replace("#","")})`} />
      <path d={`M${pts.join(" L")}`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="4" fill={color} />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="8" fill={color} opacity="0.2" />
    </svg>
  );
}

// ── Skeleton line (loading placeholder) ──────────────────────────────────────
function SkeletonLine({ width = 160, height = 52 }: { width?: number; height?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 8,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.5s ease-in-out infinite",
    }} />
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
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

// ── Live module card (clickable, navigates to sub-route) ─────────────────────
function LiveModuleCard({ href, icon, title, description, accent, preview }: {
  href: string; icon: string; title: string; description: string; accent: string;
  preview: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="analytics-live-card" style={{
        border: `1px solid ${accent}22`,
        borderRadius: 20, padding: 26,
        background: `linear-gradient(135deg, ${accent}08 0%, #0d1018 60%)`,
        display: "flex", flexDirection: "column", gap: 0,
        position: "relative", overflow: "hidden",
        cursor: "pointer", transition: "border-color 0.2s",
      }}>
        <div style={{
          position: "absolute", top: -60, right: -60, width: 200, height: 200,
          borderRadius: "50%", background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: accent, fontSize: 16 }}>{icon}</span>
              <StatusBadge status="live" />
            </div>
            <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.3, marginBottom: 8, color: "#f1f5f9" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{description}</div>
          </div>
          <div style={{ flexShrink: 0, paddingTop: 4 }}>{preview}</div>
        </div>
      </div>
    </Link>
  );
}

// ── Coming-soon module card (non-clickable, muted) ───────────────────────────
function ComingSoonModuleCard({ icon, title, description }: {
  icon: string; title: string; description: string;
}) {
  return (
    <div style={{
      border: "1px solid #1a2035",
      borderRadius: 20, padding: 26,
      background: "#0d1018",
      display: "flex", flexDirection: "column", gap: 0,
      position: "relative", overflow: "hidden",
      opacity: 0.5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: "#94a3b8", fontSize: 16 }}>{icon}</span>
        <StatusBadge status="coming-soon" />
      </div>
      <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.3, marginBottom: 8, color: "#f1f5f9" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{description}</div>
    </div>
  );
}

// ── THS live preview ─────────────────────────────────────────────────────────
function THSPreview({ ths, loading, error }: { ths: ThsData | null; loading: boolean; error: string | null }) {
  if (loading) return <SkeletonLine />;

  if (error) {
    return (
      <div style={{ width: 160, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#f87171" }}>{error}</span>
      </div>
    );
  }

  if (!ths || ths.score === null) {
    return (
      <div style={{ width: 160, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>No score data yet</span>
      </div>
    );
  }

  const score = ths.score;
  const priorScore = ths.trend.delta !== null ? score - ths.trend.delta : score;
  const sparkValues = [priorScore, score];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f5a623", letterSpacing: -0.5 }}>
          {score.toFixed(1)}
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
          {ths.band ?? ""}
        </div>
        {ths.trend.delta !== null && (
          <div style={{
            fontSize: 11, fontWeight: 700, marginTop: 2,
            color: ths.trend.direction === "up" ? "#4ade80" : ths.trend.direction === "down" ? "#f87171" : "#94a3b8",
          }}>
            {ths.trend.direction === "up" ? "+" : ""}{ths.trend.delta.toFixed(1)} vs prior
          </div>
        )}
      </div>
      <Sparkline values={sparkValues} width={80} height={40} color="#f5a623" />
    </div>
  );
}

// ── Engagement live preview ──────────────────────────────────────────────────
function EngagementPreview({ weeks, loading }: { weeks: WeekData[] | null; loading: boolean }) {
  if (loading) return <SkeletonLine />;

  if (!weeks || weeks.length < 2) {
    return (
      <div style={{ width: 160, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>No data yet</span>
      </div>
    );
  }

  const totalCheckins = weeks.reduce((s, w) => s + w.total, 0);
  const avgWeekly = Math.round(totalCheckins / weeks.length);
  const lastTwo = weeks.slice(-2);
  const trend = lastTwo.length === 2
    ? (lastTwo[1].total > lastTwo[0].total ? "up" : lastTwo[1].total < lastTwo[0].total ? "down" : "flat")
    : "flat";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#6b82d4", letterSpacing: -0.5 }}>
          {avgWeekly}
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
          avg/week
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, marginTop: 2,
          color: trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : "#94a3b8",
        }}>
          {trend === "up" ? "↑ trending up" : trend === "down" ? "↓ trending down" : "→ flat"}
        </div>
      </div>
      <Sparkline
        values={weeks.slice(-6).map(w => w.total)}
        width={80} height={40} color="#6b82d4"
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [ths, setThs] = useState<ThsData | null>(null);
  const [thsLoading, setThsLoading] = useState(true);
  const [thsError, setThsError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<WeekData[] | null>(null);
  const [weeksLoading, setWeeksLoading] = useState(true);

  useEffect(() => {
    async function loadTHS() {
      setThsLoading(true);
      setThsError(null);
      try {
        const practiceId = localStorage.getItem("selected_practice_id");
        if (!practiceId) {
          setThsLoading(false);
          return;
        }
        const isDemo = isDemoMode();
        const demoParam = isDemo ? "&demo=true" : "";
        const res = await fetch(
          `/api/practices/${encodeURIComponent(practiceId)}/ths?week_start=${new Date().toISOString().slice(0, 10)}${demoParam}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setThsError("Failed to load");
          setThsLoading(false);
          return;
        }
        const json = await res.json();
        if (json.error) {
          setThsError(json.error.message ?? "Failed to load");
        } else if (json.data) {
          setThs(json.data);
        }
      } catch {
        setThsError("Failed to load health score");
      } finally {
        setThsLoading(false);
      }
    }

    async function loadEngagement() {
      setWeeksLoading(true);
      try {
        const res = await fetch("/api/analytics/engagement");
        if (!res.ok) throw new Error();
        const json = await res.json();
        setWeeks(json.data?.weeks ?? []);
      } catch {
        setWeeks([]);
      } finally {
        setWeeksLoading(false);
      }
    }

    loadTHS();
    loadEngagement();
  }, []);

  const liveModuleCount = 2;
  const totalModuleCount = 4;

  return (
    <>
      <style>{`        @keyframes orb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.08); } }
        @keyframes orb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,40px) scale(1.05); } }
        @keyframes orb3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,50px) scale(1.1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .analytics-live-card:hover { border-color: #6b82d4 !important; }
        @media (max-width: 767px) {
          .analytics-module-grid { grid-template-columns: 1fr !important; }
          .analytics-roadmap-milestones { flex-wrap: wrap !important; gap: 12px !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080c12", color: "#f1f5f9", fontFamily: "'DM Sans', system-ui", position: "relative", overflow: "hidden" }}>

        {/* Ambient orbs */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.14) 0%, transparent 65%)", top: "-10%", right: "5%", animation: "orb1 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,92,252,0.10) 0%, transparent 65%)", bottom: "-5%", left: "0%", animation: "orb2 24s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(248,113,113,0.08) 0%, transparent 65%)", top: "45%", left: "30%", animation: "orb3 18s ease-in-out infinite" }} />
        </div>

        {/* Noise */}
        <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, opacity: 0.025 }}>
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>

          {/* Back link */}
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 24, transition: "color 0.2s" }}>
            ← Back
          </Link>

          {/* Roadmap strip */}
          <div style={{
            border: "1px solid #1a2035", borderRadius: 18,
            padding: "24px 28px", background: "#0d1018",
            marginBottom: 24, animation: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, fontFamily: "'Sora', system-ui", color: "#f1f5f9" }}>Module roadmap</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>Health score pipeline is live — more modules shipping soon</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>{liveModuleCount} of {totalModuleCount} live</div>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${(liveModuleCount / totalModuleCount) * 100}%`, borderRadius: 99,
                background: "linear-gradient(90deg, #4ade80, #6b82d4)",
                boxShadow: "0 0 12px rgba(74,222,128,0.4)",
              }} />
            </div>
            <div className="analytics-roadmap-milestones" style={{ display: "flex", gap: 24, marginTop: 14 }}>
              {[
                { label: "Health Score", done: true },
                { label: "Engagement", done: true },
                { label: "Utilization", done: false },
                { label: "Benchmarks", done: false },
              ].map((m) => (
                <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: m.done ? "#4ade80" : "#94a3b8" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.done ? "#4ade80" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 32, animation: "fadeUp 0.7s 0.15s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px",
              borderRadius: 999, border: "1px solid rgba(107,130,212,0.3)", background: "rgba(107,130,212,0.07)",
              fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" as const,
              color: "#6b82d4", marginBottom: 16,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", display: "inline-block" }} />
              Analytics
            </div>

            <h1 style={{
              fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, letterSpacing: -2,
              lineHeight: 1.05, margin: "0 0 12px", fontFamily: "'Sora', system-ui",
              background: "linear-gradient(135deg, #ffffff 30%, #6b82d4 70%, #4ade80 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Practice insights, powered by real data.
            </h1>

            <p style={{ fontSize: 15, color: "#94a3b8", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Signal intelligence across your practice — built on live check-in, caseload, and health score data.
            </p>
          </div>

          {/* Module cards — 2×2 grid */}
          <div className="analytics-module-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48, animation: "fadeUp 0.7s 0.25s cubic-bezier(0.16,1,0.3,1) both" }}>

            {/* Module 1: Practice Health Score — LIVE */}
            <LiveModuleCard
              href="/analytics/health-score"
              icon="◈" accent="#f5a623"
              title="Practice Health Score"
              description="Week-over-week engagement quality and care signal trends across your entire practice roster."
              preview={<THSPreview ths={ths} loading={thsLoading} error={thsError} />}
            />

            {/* Module 2: Patient Engagement — LIVE */}
            <LiveModuleCard
              href="/analytics/engagement"
              icon="◉" accent="#6b82d4"
              title="Patient Engagement"
              description="Weekly check-in volume, mood trends, and engagement patterns across your patient base."
              preview={<EngagementPreview weeks={weeks} loading={weeksLoading} />}
            />

            {/* Module 3: At-Risk Pattern Detection — COMING SOON */}
            <ComingSoonModuleCard
              icon="⬟"
              title="At-Risk Pattern Detection"
              description="Surface caseload and engagement patterns that precede patient disengagement — before it happens."
            />

            {/* Module 4: Therapist Utilization — COMING SOON */}
            <ComingSoonModuleCard
              icon="◎"
              title="Therapist Utilization"
              description="Caseload vs. capacity at a glance. Identify burnout risk and coverage gaps before they affect care."
            />
          </div>

          {/* Bottom CTA */}
          <div style={{ textAlign: "center", animation: "fadeUp 0.7s 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
              Analytics ships as part of the empathAI platform — no separate setup required.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                textDecoration: "none", padding: "14px 28px", borderRadius: 12,
                border: "1px solid rgba(107,130,212,0.3)", background: "rgba(107,130,212,0.08)",
                color: "#6b82d4", fontWeight: 800, fontSize: 14, fontFamily: "'Sora', system-ui",
                letterSpacing: -0.2,
              }}
            >
              ← Back to home
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
