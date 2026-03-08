// app/analytics/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// ── Sparkline ─────────────────────────────────────────────────────────────────
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

// ── Module card ───────────────────────────────────────────────────────────────
function ModuleCard({ icon, title, description, accent, preview, status = "coming-soon" }: {
  icon: string; title: string; description: string; accent: string;
  preview?: React.ReactNode; status?: "coming-soon" | "live";
}) {
  return (
    <div style={{
      border: `1px solid ${accent}22`,
      borderRadius: 20,
      padding: 26,
      background: `linear-gradient(135deg, ${accent}08 0%, #0d1018 60%)`,
      display: "flex",
      flexDirection: "column",
      gap: 0,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Corner glow */}
      <div style={{
        position: "absolute", top: -60, right: -60, width: 200, height: 200,
        borderRadius: "50%", background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ color: accent, fontSize: 16 }}>{icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const,
              color: status === "live" ? "#4ade80" : "#d97706", opacity: 0.85,
              background: status === "live" ? "rgba(74,222,128,0.1)" : "rgba(217,119,6,0.1)",
              border: `1px solid ${status === "live" ? "rgba(74,222,128,0.3)" : "rgba(217,119,6,0.3)"}`,
              padding: "2px 8px", borderRadius: 999,
            }}>
              {status === "live" ? "● Live" : "Coming soon"}
            </span>
          </div>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.3, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{description}</div>
        </div>
        {preview && <div style={{ flexShrink: 0, paddingTop: 4 }}>{preview}</div>}
      </div>
    </div>
  );
}

// ── Skeleton shimmer for loading state ────────────────────────────────────────
function SparklineSkeleton() {
  return (
    <div style={{ width: 160, height: 52, borderRadius: 8, background: "rgba(255,255,255,0.04)", animation: "skeleton-shimmer 2s infinite linear", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)" }} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [thsScores, setThsScores] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchTHS() {
      try {
        const practiceId = typeof window !== "undefined"
          ? localStorage.getItem("selected_practice_id") || "demo-practice-01"
          : "demo-practice-01";
        const res = await fetch(`/api/practices/${practiceId}/ths`);
        if (!res.ok) throw new Error("Failed to fetch THS");
        const json = await res.json();
        const data = json.data;
        if (!cancelled && data?.score != null) {
          setThsScores([data.score]);
        }
      } catch {
        // No data available — will show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTHS();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <style>{`
        @keyframes orb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.08); } }
        @keyframes orb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,40px) scale(1.05); } }
        @keyframes orb3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,50px) scale(1.1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @media (max-width: 767px) {
          .analytics-module-grid { grid-template-columns: 1fr !important; }
          .analytics-roadmap-milestones { flex-wrap: wrap !important; gap: 12px !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080c12", color: "white", fontFamily: "'DM Sans', system-ui", position: "relative", overflow: "hidden" }}>

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
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 600, marginBottom: 24, transition: "color 0.2s" }}>
            ← Back
          </Link>

          {/* Roadmap strip */}
          <div style={{
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18,
            padding: "24px 28px", background: "rgba(255,255,255,0.02)",
            marginBottom: 24, animation: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, fontFamily: "'Sora', system-ui", color: "#f1f5f9" }}>Module roadmap</div>
                <div style={{ fontSize: 12, opacity: 0.4, marginTop: 3 }}>Health score pipeline is live — additional modules shipping next</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#f5a623" }}>1 of 4 live</div>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: "25%", borderRadius: 99,
                background: "linear-gradient(90deg, #f5a623, #f87171)",
                boxShadow: "0 0 12px rgba(245,166,35,0.4)",
              }} />
            </div>
            <div className="analytics-roadmap-milestones" style={{ display: "flex", gap: 24, marginTop: 14 }}>
              {[
                { label: "Health Score", done: true },
                { label: "Engagement", done: false },
                { label: "Utilization", done: false },
                { label: "Benchmarks", done: false },
              ].map((m) => (
                <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: m.done ? "#f5a623" : "rgba(255,255,255,0.3)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.done ? "#f5a623" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 32, animation: "fadeUp 0.7s 0.15s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px",
              borderRadius: 999, border: "1px solid rgba(245,166,35,0.3)", background: "rgba(245,166,35,0.07)",
              fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" as const,
              color: "#f5a623", marginBottom: 16, animation: "pulse 2.5s ease-in-out infinite",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5a623", boxShadow: "0 0 8px #f5a623", display: "inline-block" }} />
              In development
            </div>

            <h1 style={{
              fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, letterSpacing: -2,
              lineHeight: 1.05, margin: "0 0 12px", fontFamily: "'Sora', system-ui",
              background: "linear-gradient(135deg, #ffffff 30%, #f5a623 70%, #f87171 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              The insights your practice has been missing.
            </h1>

            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Real-time signal intelligence across every practice, therapist, and patient — so you can act before problems compound.
            </p>
          </div>

          {/* Module cards */}
          <div className="analytics-module-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48, animation: "fadeUp 0.7s 0.25s cubic-bezier(0.16,1,0.3,1) both" }}>
            <ModuleCard
              icon="◈" accent="#f5a623" status="live"
              title="Practice Health Score"
              description="Week-over-week engagement quality and care signal trends across your entire practice roster."
              preview={loading
                ? <SparklineSkeleton />
                : thsScores && thsScores.length >= 2
                  ? <Sparkline values={thsScores} color="#f5a623" />
                  : <div style={{ width: 160, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>Collecting data...</div>
              }
            />
            <ModuleCard
              icon="⬟" accent="#f87171"
              title="At-Risk Pattern Detection"
              description="Surface caseload and engagement patterns that precede patient disengagement — before it happens."
            />
            <ModuleCard
              icon="◎" accent="#7c5cfc"
              title="Therapist Utilization"
              description="Caseload vs. capacity at a glance. Identify burnout risk and coverage gaps before they affect care."
            />
            <ModuleCard
              icon="⬡" accent="#00c8a0"
              title="Cross-Practice Benchmarks"
              description="Compare engagement, retention, and outcome signals across practices to find what's working."
            />
          </div>

          {/* Bottom CTA */}
          <div style={{ textAlign: "center", animation: "fadeUp 0.7s 0.45s cubic-bezier(0.16,1,0.3,1) both" }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>
              Analytics ships as part of the empathAI platform — no separate setup required.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                textDecoration: "none", padding: "14px 28px", borderRadius: 12,
                border: "1px solid rgba(245,166,35,0.3)", background: "rgba(245,166,35,0.08)",
                color: "#f5a623", fontWeight: 800, fontSize: 14, fontFamily: "'Sora', system-ui",
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
