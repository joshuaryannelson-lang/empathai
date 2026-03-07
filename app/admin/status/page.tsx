// app/admin/status/page.tsx
// Practice Status — operational health view for practice managers.
// Calm, non-technical, Monday-morning dashboard.
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { NavSidebar } from "@/app/components/NavSidebar";
import { PracticeSelector } from "./components/PracticeSelector";
import { getRole, type Role } from "@/lib/roleContext";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

// ── Types ─────────────────────────────────────────────────────────────────────

type PracticeOption = { id: string; name: string };

type StatusData = {
  checkinRate: { numerator: number; denominator: number; rate: number | null };
  avgRating: { value: number | null; delta: number | null };
  needsAttention: { count: number };
  practiceHealthScore: { value: number | null; confidence: "high" | "medium" | "low" | null; partialNote: string | null };
  therapistActivity: Array<{
    id: string;
    name: string;
    practiceName?: string | null;
    casesAssigned: number;
    checkinsThisWeek: number;
    sessionRatings: number | null;
    lastActivity: string | null;
  }>;
  activityFeed: Array<{ type: string; message: string; time: string; practiceName?: string | null }>;
  hasMoreActivity: boolean;
  trends: Array<{ weekStart: string; checkinRate: number | null; avgRating: number | null }>;
};

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg: { page: "#080c12", card: "#0d1018", surface: "#111420" },
  border: { DEFAULT: "#1a1e2a", emphasis: "#1f2533" },
  text: {
    primary: "#e2e8f0",
    heading: "rgba(255,255,255,0.9)",
    secondary: "rgba(255,255,255,0.65)",
    tertiary: "rgba(255,255,255,0.45)",
    muted: "rgba(255,255,255,0.35)",
    disabled: "rgba(255,255,255,0.25)",
  },
  trend: {
    improving: { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },
    stable: { fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240" },
    declining: { fg: "#c4b5a0", bg: "#141210", border: "#2e2820" },
  },
  accent: { DEFAULT: "#38bdf8", bg: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.25)" },
  crisis: { bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.2)", fg: "#7dd3fc" },
  confidence: {
    high: { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },
    medium: { fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240" },
    low: { fg: "#d4a574", bg: "#141008", border: "#2e2418" },
  },
} as const;

const FONT = {
  display: "'Sora', system-ui, sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'DM Mono', monospace",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(s: string) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

function rateColor(rate: number | null): { fg: string; bg: string; border: string } {
  if (rate === null) return T.trend.stable;
  if (rate >= 0.75) return T.trend.improving;
  if (rate >= 0.50) return { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" };
  return T.trend.declining;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "1.2px",
      textTransform: "uppercase", color: T.text.muted,
      fontFamily: FONT.mono, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: "20px 22px", borderRadius: 12,
      border: `1px solid ${T.border.DEFAULT}`,
      background: T.bg.card,
      minHeight: 120,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Ghost text (empty state) ──────────────────────────────────────────────────

function Ghost({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: T.text.disabled, fontStyle: "italic", fontSize: 13, fontWeight: 500 }}>
      {children}
    </span>
  );
}

// ── Sparkline (pure SVG — no recharts dependency) ─────────────────────────────

function Sparkline({ data, color, width = 200, height = 48 }: { data: (number | null)[]; color: string; width?: number; height?: number }) {
  const valid = data.filter((d): d is number => d !== null);
  if (valid.length < 2) return <Ghost>Not enough data yet — check back after a few weeks of check-ins</Ghost>;

  const min = Math.min(...valid) * 0.9;
  const max = Math.max(...valid) * 1.1 || 1;
  const range = max - min || 1;
  const padding = 4;

  const points = data.map((v, i) => {
    if (v === null) return null;
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return { x, y };
  }).filter(Boolean) as { x: number; y: number }[];

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={T.bg.card} stroke={color} strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ── Main page content ─────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PracticeStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Practices list for the selector
  const [practices, setPractices] = useState<PracticeOption[]>([]);

  // Current user context for manager scoping
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);

  const weekStart = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);
  const [sidebarPracticeId, setSidebarPracticeId] = useState<string | null>(null);
  const [sidebarTherapistId, setSidebarTherapistId] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "crisis" | "clinical" | "system">("all");

  const demoParam = searchParams?.get("demo") === "true" ? "&demo=true" : "";

  // Read practice_id from URL, validate UUID format
  const rawPracticeId = searchParams?.get("practice_id") ?? null;
  const selectedPracticeId = rawPracticeId && UUID_RE.test(rawPracticeId) ? rawPracticeId : null;

  // Determine if multi-practice view (selector visible, "All practices" mode possible)
  const isMulti = practices.length > 1;
  const selectedPracticeName = selectedPracticeId
    ? practices.find((p) => p.id === selectedPracticeId)?.name ?? null
    : null;

  // Resolve user identity and role, then fetch practices
  useEffect(() => {
    async function init() {
      const role = getRole();
      setUserRole(role);

      let uid: string | null = null;
      try {
        const sb = getSupabaseBrowser();
        const { data: { session } } = await sb.auth.getSession();
        uid = session?.user?.id ?? null;
        setUserId(uid);
      } catch {}

      // Manager: scope practices to assignments
      const managerParam = role === "manager" && uid ? `?manager_id=${uid}` : "";
      try {
        const res = await fetch(`/api/practices${managerParam}`, { cache: "no-store" });
        const json = await res.json();
        const list: PracticeOption[] = Array.isArray(json?.data)
          ? json.data.filter((p: any) => p.id && p.name).map((p: any) => ({ id: p.id, name: p.name }))
          : [];
        setPractices(list);
      } catch {}
    }
    init();
  }, []);

  // On first mount for single-practice managers: auto-select their practice from localStorage.
  // Multi-practice managers always default to "All practices" (selectedId = null).
  useEffect(() => {
    if (rawPracticeId) return; // URL already has one
    if (practices.length !== 1) return; // Multi-practice: default to "All"
    try {
      const stored = localStorage.getItem("selected_practice_id");
      if (stored && UUID_RE.test(stored) && practices.some((p) => p.id === stored)) {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("practice_id", stored);
        router.replace(`${pathname}?${params.toString()}`);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practices]); // Only run when practices load

  const handlePracticeChange = useCallback((id: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (id) {
      params.set("practice_id", id);
    } else {
      params.delete("practice_id");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pidParam = selectedPracticeId ? `&practice_id=${encodeURIComponent(selectedPracticeId)}` : "";
      const mgrParam = userRole === "manager" && userId ? `&manager_id=${userId}` : "";
      const res = await fetch(`/api/admin/practice-status?_t=${Date.now()}${demoParam}${pidParam}${mgrParam}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(typeof json.error === "string" ? json.error : json.error?.message ?? "API error");
      setData(json.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [demoParam, selectedPracticeId, userRole, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    try {
      setSidebarPracticeId(localStorage.getItem("selected_practice_id"));
      setSidebarTherapistId(localStorage.getItem("selected_therapist_id"));
    } catch {}
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg.page, color: T.text.primary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .status-fade { animation: fadeIn 0.25s ease; }
        @media (max-width: 767px) {
          .status-main { padding: 64px 16px 60px !important; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .sparkline-grid { grid-template-columns: 1fr !important; }
          .therapist-table { font-size: 12px !important; }
        }
        @media (max-width: 500px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <NavSidebar
        practiceId={sidebarPracticeId}
        practiceName={null}
        therapistId={sidebarTherapistId}
        weekStart={weekStart}
        adminOnly={true}
      />

      <main className="status-main" style={{ flex: 1, minWidth: 0, padding: "40px 48px 80px", maxWidth: 880 }}>

        {/* Header */}
        <div className="status-fade" style={{ marginBottom: 36 }}>
          <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#374151", textDecoration: "none", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 20 }}>
            &larr; Admin
          </Link>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontFamily: FONT.mono, marginBottom: 8 }}>
            Practice Status
          </div>
          <div className="status-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <h1 style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: T.text.heading, lineHeight: 1, margin: 0 }}>
              {selectedPracticeId && selectedPracticeName
                ? selectedPracticeName
                : isMulti
                  ? (userRole === "manager" ? "All My Practices" : "All Practices")
                  : practices.length === 1
                    ? practices[0].name
                    : "Practice Status"}
            </h1>
            <PracticeSelector
              practices={practices}
              selectedId={selectedPracticeId}
              onChange={handlePracticeChange}
              allLabel={userRole === "manager" ? "All my practices" : "All practices"}
            />
          </div>
        </div>
        <style>{`
          @media (max-width: 640px) {
            .status-header-row { flex-direction: column !important; align-items: stretch !important; }
          }
        `}</style>

        {/* Error state */}
        {error && (
          <div style={{ padding: "14px 18px", borderRadius: 12, border: `1px solid ${T.trend.declining.border}`, background: T.trend.declining.bg, color: T.trend.declining.fg, fontSize: 13, marginBottom: 24 }}>
            Could not load practice status: {error}
          </div>
        )}

        {/* Loading state */}
        {loading && !data && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Ghost>Loading practice status...</Ghost>
          </div>
        )}

        {/* Zero-assignment empty state for managers */}
        {!loading && !error && userRole === "manager" && practices.length === 0 && (
          <div style={{
            textAlign: "center", padding: "80px 24px",
            borderRadius: 12, border: `1px solid ${T.border.DEFAULT}`,
            background: T.bg.card,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text.secondary, marginBottom: 8 }}>
              No practices assigned yet
            </div>
            <div style={{ fontSize: 13, color: T.text.tertiary, maxWidth: 340, margin: "0 auto" }}>
              Contact your administrator to get access to one or more practices.
            </div>
          </div>
        )}

        {data && (
          <div className="status-fade" style={{ display: "grid", gap: 36 }}>

            {/* ── Narrative Summary ── */}
            {(() => {
              const rate = data.checkinRate?.rate;
              const ratePercent = rate !== null && rate !== undefined ? Math.round(rate * 100) : null;
              const avgVal = data.avgRating?.value;
              const delta = data.avgRating?.delta;
              const attn = data.needsAttention?.count ?? 0;
              const isHealthy = (ratePercent === null || ratePercent >= 70) && attn <= 1;
              const trendWord = delta && delta > 0.3 ? "improving" : delta && delta < -0.3 ? "declining" : "stable";

              const line1 = ratePercent !== null
                ? `${ratePercent}% of patients checked in this week`
                : "Check-in data is still coming in";
              const line2 = avgVal !== null && avgVal !== undefined
                ? ` with an average rating of ${avgVal.toFixed(1)}/10${delta ? ` (${trendWord} vs last week)` : ""}.`
                : ".";
              const line3 = attn > 0
                ? ` ${attn} case${attn > 1 ? "s" : ""} flagged for attention.`
                : "";

              return (
                <div style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: `1px solid ${isHealthy ? "rgba(74,222,128,0.15)" : "rgba(251,146,60,0.2)"}`,
                  background: isHealthy ? "rgba(74,222,128,0.04)" : "rgba(251,146,60,0.04)",
                  marginBottom: 20,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: 700, color: isHealthy ? "#4ade80" : "#fb923c" }}>
                    {isHealthy ? "Practice is healthy" : "Attention needed"}
                  </span>
                  {" \u2014 "}
                  {line1}{line2}{line3}
                </div>
              );
            })()}

            {/* ── Section 1: At a Glance ── */}
            <div>
              <SectionHeader>Practice health at a glance</SectionHeader>
              <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>

                {/* Card 1: Check-in rate */}
                <StatCard>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", color: T.text.muted, marginBottom: 8 }}>
                    Weekly check-in rate
                  </div>
                  {data.checkinRate.rate !== null ? (
                    <>
                      <div style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: rateColor(data.checkinRate.rate).fg, lineHeight: 1 }}>
                        {Math.round(data.checkinRate.rate * 100)}%
                      </div>
                      <div style={{ fontSize: 12, color: T.text.tertiary, marginTop: 6 }}>
                        {data.checkinRate.numerator} of {data.checkinRate.denominator} patients checked in
                      </div>
                    </>
                  ) : (
                    <Ghost>No active cases yet</Ghost>
                  )}
                </StatCard>

                {/* Card 2: Average rating */}
                <StatCard>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", color: T.text.muted, marginBottom: 8 }}>
                    Average weekly rating
                  </div>
                  {data.avgRating.value !== null ? (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: T.text.heading, lineHeight: 1 }}>
                          {data.avgRating.value.toFixed(1)}
                        </span>
                        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: T.text.muted }}>/10</span>
                      </div>
                      {data.avgRating.delta !== null && (
                        <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: data.avgRating.delta >= 0 ? T.trend.improving.fg : T.trend.declining.fg }}>
                          {data.avgRating.delta >= 0 ? "\u2191" : "\u2193"} {Math.abs(data.avgRating.delta).toFixed(1)} vs last week
                        </div>
                      )}
                    </>
                  ) : (
                    <Ghost>No check-ins yet this week</Ghost>
                  )}
                </StatCard>

                {/* Card 3: Cases needing attention */}
                <StatCard>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", color: T.text.muted, marginBottom: 8 }}>
                    Cases needing attention
                  </div>
                  {data.needsAttention.count > 0 ? (
                    <>
                      <div style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: T.trend.declining.fg, lineHeight: 1 }}>
                        {data.needsAttention.count}
                      </div>
                      <Link href="/cases" style={{ fontSize: 12, color: T.accent.DEFAULT, fontWeight: 600, textDecoration: "none", marginTop: 6, display: "inline-block" }}>
                        View cases &rarr;
                      </Link>
                    </>
                  ) : (
                    <div style={{ color: T.trend.improving.fg, fontSize: 13, fontWeight: 600 }}>
                      No cases flagged this week
                    </div>
                  )}
                </StatCard>

                {/* Card 4: Practice Health Score */}
                <StatCard>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", color: T.text.muted, marginBottom: 8 }}>
                    Practice Health Score
                  </div>
                  {data.practiceHealthScore.value !== null ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: T.text.heading, lineHeight: 1 }}>
                          {data.practiceHealthScore.value.toFixed(1)}
                        </span>
                        {data.practiceHealthScore.confidence && (
                          <span style={{
                            padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                            background: T.confidence[data.practiceHealthScore.confidence].bg,
                            border: `1px solid ${T.confidence[data.practiceHealthScore.confidence].border}`,
                            color: T.confidence[data.practiceHealthScore.confidence].fg,
                          }}>
                            {data.practiceHealthScore.confidence}
                          </span>
                        )}
                      </div>
                      {data.practiceHealthScore.partialNote && (
                        <div style={{ fontSize: 11, color: T.text.disabled, marginTop: 6, fontStyle: "italic", lineHeight: 1.4 }}>
                          {data.practiceHealthScore.partialNote}
                        </div>
                      )}
                    </>
                  ) : (
                    <Ghost>Score will appear once check-ins are submitted</Ghost>
                  )}
                </StatCard>
              </div>
            </div>

            {/* ── Section 2: Activity Feed ── */}
            <div>
              <SectionHeader>This week&apos;s activity</SectionHeader>
              {/* Filter pills */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {(["all", "crisis", "clinical", "system"] as const).map((f) => {
                  const labels: Record<typeof f, string> = { all: "All", crisis: "Crisis", clinical: "Clinical", system: "System" };
                  const isActive = activityFilter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setActivityFilter(f)}
                      style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.3px",
                        padding: "4px 12px", borderRadius: 999, cursor: "pointer",
                        border: `1px solid ${isActive ? T.accent.border : T.border.DEFAULT}`,
                        background: isActive ? T.accent.bg : "transparent",
                        color: isActive ? T.accent.DEFAULT : T.text.muted,
                        fontFamily: FONT.mono, textTransform: "uppercase",
                        transition: "all .15s",
                      }}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
              </div>
              {(() => {
                const filteredFeed = data.activityFeed.filter((event) => {
                  if (activityFilter === "all") return true;
                  if (activityFilter === "crisis") return event.type === "crisis";
                  if (activityFilter === "system") return event.type === "join";
                  /* clinical */ return event.type !== "crisis" && event.type !== "join";
                });
                return filteredFeed.length === 0 ? (
                <div style={{ padding: "24px 0" }}>
                  <Ghost>{activityFilter === "all" ? "No activity yet this week — patients may not have been prompted yet" : `No ${activityFilter} activity this week`}</Ghost>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 0 }}>
                  {filteredFeed.map((event, i) => (
                    <div key={i}>
                      {event.type === "crisis" ? (
                        /* Crisis notice — calm blue, not red */
                        <div style={{
                          padding: "14px 18px", borderRadius: 10, marginBottom: 8,
                          background: T.crisis.bg,
                          border: `1px solid ${T.crisis.border}`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.crisis.fg, lineHeight: 1.6 }}>
                            {event.message}
                          </div>
                          <div style={{ fontSize: 11, color: T.text.disabled, marginTop: 6 }}>
                            {timeAgo(event.time)}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 0",
                          borderBottom: i < filteredFeed.length - 1 ? `1px solid ${T.border.DEFAULT}` : "none",
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                            background: event.type === "join" ? T.accent.DEFAULT
                              : event.type === "unusual" ? "#fb923c"
                              : T.text.disabled,
                          }} />
                          <div style={{ flex: 1, fontSize: 13, color: T.text.secondary }}>
                            {event.message}
                            {isMulti && !selectedPracticeId && event.practiceName && (
                              <span style={{ color: T.text.disabled, fontSize: 11 }}>{" · "}{event.practiceName}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: T.text.disabled, fontFamily: FONT.mono, flexShrink: 0 }}>
                            {timeAgo(event.time)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {data.hasMoreActivity && (
                    <div style={{ paddingTop: 8 }}>
                      <Link href="/status" style={{ fontSize: 12, color: T.accent.DEFAULT, fontWeight: 600, textDecoration: "none" }}>
                        View full log &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              );
              })()}
            </div>

            {/* ── Section 3: Therapist Activity ── */}
            <div>
              <SectionHeader>Therapist activity</SectionHeader>
              {data.therapistActivity.length === 0 ? (
                <div style={{ padding: "24px 0" }}>
                  <Ghost>No therapists assigned to cases yet</Ghost>
                </div>
              ) : (
                <div className="therapist-table" style={{ borderRadius: 12, border: `1px solid ${T.border.DEFAULT}`, overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr 1fr 1fr",
                    padding: "10px 18px", background: T.bg.surface,
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
                    color: T.text.muted, textTransform: "uppercase",
                    borderBottom: `1px solid ${T.border.DEFAULT}`,
                  }}>
                    <span>Therapist</span>
                    <span>Cases</span>
                    <span>Check-ins</span>
                    <span>Ratings</span>
                    <span>Last activity</span>
                  </div>
                  {/* Rows */}
                  {data.therapistActivity.map((t, i) => {
                    const isInactive = t.checkinsThisWeek === 0;
                    return (
                      <div key={t.id} style={{
                        display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr 1fr 1fr",
                        padding: "12px 18px",
                        borderBottom: i < data.therapistActivity.length - 1 ? `1px solid ${T.border.DEFAULT}` : "none",
                        background: T.bg.card,
                        color: isInactive ? T.text.disabled : T.text.secondary,
                        fontStyle: isInactive ? "italic" : "normal",
                        fontSize: 13,
                      }}>
                        <span style={{ fontWeight: 600, color: isInactive ? T.text.disabled : T.text.primary }}>
                          {t.name}
                          {isMulti && !selectedPracticeId && t.practiceName && (
                            <span style={{ display: "block", fontSize: 10, fontWeight: 500, color: T.text.disabled, marginTop: 1 }}>
                              {t.practiceName}
                            </span>
                          )}
                        </span>
                        <span>{t.casesAssigned}</span>
                        <span>{t.checkinsThisWeek}</span>
                        <span style={{ color: T.text.disabled }}>{t.sessionRatings !== null ? t.sessionRatings : "\u2014"}</span>
                        <span style={{ fontFamily: FONT.mono, fontSize: 11 }}>
                          {t.lastActivity ? timeAgo(t.lastActivity) : "\u2014"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Section 4: Trend Sparklines ── */}
            <div>
              <SectionHeader>Trends (last 4 weeks)</SectionHeader>
              <div className="sparkline-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Check-in completion */}
                <div style={{ padding: "18px 22px", borderRadius: 12, border: `1px solid ${T.border.DEFAULT}`, background: T.bg.card }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text.muted, marginBottom: 14 }}>
                    Check-in completion rate
                  </div>
                  <Sparkline
                    data={data.trends.map(w => w.checkinRate !== null ? Math.round(w.checkinRate * 100) : null)}
                    color={T.trend.improving.fg}
                    width={280}
                    height={52}
                  />
                  {data.trends.some(w => w.checkinRate !== null) && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      {data.trends.map((w, i) => (
                        <span key={i} style={{ fontSize: 10, color: T.text.disabled, fontFamily: FONT.mono }}>
                          {w.weekStart.slice(5)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Average rating */}
                <div style={{ padding: "18px 22px", borderRadius: 12, border: `1px solid ${T.border.DEFAULT}`, background: T.bg.card }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text.muted, marginBottom: 14 }}>
                    Average weekly rating
                  </div>
                  <Sparkline
                    data={data.trends.map(w => w.avgRating)}
                    color={T.accent.DEFAULT}
                    width={280}
                    height={52}
                  />
                  {data.trends.some(w => w.avgRating !== null) && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      {data.trends.map((w, i) => (
                        <span key={i} style={{ fontSize: 10, color: T.text.disabled, fontFamily: FONT.mono }}>
                          {w.weekStart.slice(5)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PracticeStatusContent />
    </Suspense>
  );
}
