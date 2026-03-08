"use client";

import React, { Suspense, useEffect, useState } from "react";
import Skeleton, { SkeletonPage } from "@/app/components/ui/Skeleton";

// ── Types ──

type KPIs = {
  active_cases: number;
  active_therapists: number;
  checkins_this_week: number;
  avg_prep_time_seconds: number | null;
};

type TherapistRow = {
  first_name: string;
  active_cases: number;
  checkins_this_week: number;
  last_prep_at: string | null;
  avg_ths_score: number | null;
};

type OwnerStats = {
  kpis: KPIs;
  therapists: TherapistRow[];
};

// ── Design tokens ──

const FONT = {
  body: "'DM Sans', system-ui",
  mono: "'DM Mono', monospace",
};

const T = {
  bg: "#080c12",
  card: "#0d1018",
  border: "#1a2035",
  accent: "#6b82d4",
  text: { primary: "#f1f5f9", secondary: "#94a3b8" },
  green: "#4ade80",
  amber: "#d97706",
  red: "#f87171",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function OwnerDashboardInner() {
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/owner/stats", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => setStats(json.data))
      .catch((err) =>
        setError(err.message ?? "Unable to load \u2014 please refresh")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          padding: "40px 48px 80px",
        }}
      >
        <Skeleton width={200} height={12} />
        <div style={{ marginTop: 10 }}>
          <Skeleton width={260} height={28} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 14,
            marginTop: 32,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: 20,
                borderRadius: 14,
                border: `1px solid ${T.border}`,
                background: T.card,
              }}
            >
              <Skeleton width={90} height={11} />
              <div style={{ marginTop: 12 }}>
                <Skeleton width={50} height={32} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          padding: "40px 48px 80px",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            border: `1px solid rgba(248,113,113,0.2)`,
            background: "rgba(248,113,113,0.06)",
            color: T.red,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const kpiCards = [
    {
      label: "Active Cases",
      value: stats.kpis.active_cases,
      fmt: (v: number) => String(v),
    },
    {
      label: "Active Therapists",
      value: stats.kpis.active_therapists,
      fmt: (v: number) => String(v),
    },
    {
      label: "Check-ins This Week",
      value: stats.kpis.checkins_this_week,
      fmt: (v: number) => String(v),
    },
    {
      label: "Avg Session Prep Time",
      value: stats.kpis.avg_prep_time_seconds,
      fmt: (v: number | null) => (v !== null ? `${v}s` : "\u2014"),
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.body }}>
      <style>{`
        @media (max-width: 640px) {
          .owner-main { padding: 24px 16px 60px !important; }
          .owner-kpi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <main
        className="owner-main"
        style={{ padding: "40px 48px 80px", maxWidth: 960, margin: "0 auto" }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.5,
              textTransform: "uppercase" as const,
              color: "rgba(255,255,255,0.35)",
              fontFamily: FONT.mono,
              marginBottom: 8,
            }}
          >
            Owner Dashboard
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: -0.5,
              color: T.text.primary,
              lineHeight: 1,
              margin: 0,
              fontFamily: FONT.body,
            }}
          >
            Practice Overview
          </h1>
        </div>

        {/* KPI Cards */}
        <div
          className="owner-kpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 14,
            marginBottom: 36,
          }}
        >
          {kpiCards.map((card) => (
            <div
              key={card.label}
              style={{
                padding: 20,
                borderRadius: 14,
                border: `1px solid ${T.border}`,
                background: T.card,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  color: T.text.secondary,
                  marginBottom: 10,
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 28,
                  fontWeight: 800,
                  color: T.text.primary,
                  lineHeight: 1,
                }}
              >
                {card.fmt(card.value as number)}
              </div>
            </div>
          ))}
        </div>

        {/* Therapist Performance Table */}
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${T.border}`,
            background: T.card,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: T.text.primary,
              }}
            >
              Therapist Performance
            </div>
          </div>

          {stats.therapists.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: T.text.secondary,
                fontSize: 14,
              }}
            >
              No therapists assigned yet
            </div>
          ) : (
            <div
              style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 560,
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Therapist",
                      "Active Cases",
                      "Check-ins",
                      "Last Prep",
                      "Avg THS",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          color: T.text.secondary,
                          letterSpacing: 0.5,
                          borderBottom: `1px solid ${T.border}`,
                          fontFamily: FONT.mono,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.therapists.map((t, i) => (
                    <tr
                      key={i}
                      style={{ transition: "background 0.15s" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = T.border)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          color: T.text.primary,
                        }}
                      >
                        {t.first_name}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          color: T.text.primary,
                          fontFamily: FONT.mono,
                        }}
                      >
                        {t.active_cases}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          color: T.text.primary,
                          fontFamily: FONT.mono,
                        }}
                      >
                        {t.checkins_this_week}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 13,
                          color: T.text.secondary,
                        }}
                      >
                        {relativeTime(t.last_prep_at)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          color: T.text.primary,
                          fontFamily: FONT.mono,
                        }}
                      >
                        {t.avg_ths_score !== null
                          ? t.avg_ths_score.toFixed(1)
                          : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <OwnerDashboardInner />
    </Suspense>
  );
}
