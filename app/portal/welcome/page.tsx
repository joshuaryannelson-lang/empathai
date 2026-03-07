/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalIdentityContext } from "../layout";
import { useProfileGate } from "../hooks/useProfileGate";

const ACCENT = "#38bdf8";
const ACCENT_RGB = "56,189,248";

type StatusData = {
  lastCheckinDaysAgo: number | null;
  activeGoals: number;
  hasSessionThisWeek: boolean | null;
};

export default function WelcomePage() {
  const router = useRouter();
  const { session } = useContext(PortalIdentityContext);
  const [status, setStatus] = useState<StatusData>({
    lastCheckinDaysAgo: null,
    activeGoals: 0,
    hasSessionThisWeek: null,
  });
  const [loaded, setLoaded] = useState(false);

  useProfileGate();

  useEffect(() => {
    if (!session) {
      router.replace("/portal/onboarding");
      return;
    }

    const caseId = session.case_id ?? session.case_code;
    const demoSuffix = !session.token ? "?demo=true" : "";

    // Fetch check-in history and goals in parallel
    Promise.allSettled([
      fetch(`/api/cases/${caseId}/checkins${demoSuffix}`, { cache: "no-store" }).then(r => r.json()),
      fetch(`/api/cases/${caseId}/goals${demoSuffix}`, { cache: "no-store" }).then(r => r.json()),
    ]).then(([checkinsResult, goalsResult]) => {
      const newStatus: StatusData = {
        lastCheckinDaysAgo: null,
        activeGoals: 0,
        hasSessionThisWeek: null,
      };

      // Parse last check-in
      if (checkinsResult.status === "fulfilled") {
        const checkins: any[] = checkinsResult.value?.data ?? [];
        if (checkins.length > 0) {
          // Find most recent check-in by created_at or submitted_at
          const sorted = [...checkins].sort((a, b) => {
            const da = new Date(a.created_at ?? a.submitted_at ?? 0).getTime();
            const db = new Date(b.created_at ?? b.submitted_at ?? 0).getTime();
            return db - da;
          });
          const latest = sorted[0];
          const latestDate = new Date(latest.created_at ?? latest.submitted_at);
          const now = new Date();
          const diffMs = now.getTime() - latestDate.getTime();
          newStatus.lastCheckinDaysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      // Parse goals
      if (goalsResult.status === "fulfilled") {
        const goals: any[] = goalsResult.value?.data ?? [];
        newStatus.activeGoals = goals.filter(
          (g: any) => g.status !== "done" && g.status !== "completed"
        ).length;
      }

      setStatus(newStatus);
      setLoaded(true);
    });
  }, [session, router]);

  if (!session) return null;

  const firstName = session.display_label?.trim().split(" ")[0] || "there";

  const tiles = [
    {
      label: "Last check-in",
      value: loaded
        ? status.lastCheckinDaysAgo !== null
          ? status.lastCheckinDaysAgo === 0
            ? "Today"
            : status.lastCheckinDaysAgo === 1
              ? "1 day ago"
              : `${status.lastCheckinDaysAgo} days ago`
          : "Not yet"
        : null,
      icon: "\u25CB",
    },
    {
      label: "Active goals",
      value: loaded ? `${status.activeGoals} goal${status.activeGoals !== 1 ? "s" : ""}` : null,
      icon: "\u25CE",
    },
    ...(loaded && status.hasSessionThisWeek !== null
      ? [{ label: "Next session", value: "This week", icon: "\u25C7" }]
      : []),
  ];

  return (
    <div style={{
      maxWidth: 520,
      margin: "0 auto",
      padding: "56px 20px 80px",
    }}>
      {/* Header */}
      <div className="fade-in" style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: -1,
          color: "rgba(255,255,255,0.97)",
          fontFamily: "'Sora', system-ui",
          lineHeight: 1.15,
        }}>
          Welcome, {firstName}.
        </h1>
        <p style={{
          marginTop: 10,
          fontSize: 15,
          color: "rgba(255,255,255,0.42)",
          lineHeight: 1.65,
        }}>
          Here&apos;s where you can track how you&apos;re doing each week.
        </p>
      </div>

      {/* Status tiles */}
      <div className="fade-in-1" style={{
        display: "grid",
        gridTemplateColumns: `repeat(${tiles.length}, 1fr)`,
        gap: 12,
        marginBottom: 40,
      }}>
        {tiles.map((tile) => (
          <div key={tile.label} style={{
            padding: "18px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'DM Mono', monospace",
              marginBottom: 8,
            }}>
              {tile.label}
            </div>
            {tile.value !== null ? (
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: "rgba(255,255,255,0.8)",
                letterSpacing: -0.2,
              }}>
                {tile.value}
              </div>
            ) : (
              <div className="skeleton" style={{ height: 14, width: "70%", borderRadius: 4 }} />
            )}
          </div>
        ))}
      </div>

      {/* Primary CTA */}
      <div className="fade-in-2" style={{ marginBottom: 24 }}>
        <button
          className="btn-primary"
          onClick={() => router.push("/portal/checkin")}
          style={{
            width: "100%",
            padding: "15px 28px",
            fontSize: 16,
            textAlign: "center",
          }}
        >
          Check in this week
        </button>
      </div>

      {/* Secondary links */}
      <div className="fade-in-3" style={{
        display: "flex",
        justifyContent: "center",
        gap: 28,
      }}>
        <a
          href="/portal/history"
          onClick={(e) => { e.preventDefault(); router.push("/portal/history"); }}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: `rgba(${ACCENT_RGB}, 0.7)`,
            textDecoration: "none",
            cursor: "pointer",
            transition: "color 0.15s ease",
          }}
        >
          View my history
        </a>
        <a
          href="/portal/goals"
          onClick={(e) => { e.preventDefault(); router.push("/portal/goals"); }}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: `rgba(${ACCENT_RGB}, 0.7)`,
            textDecoration: "none",
            cursor: "pointer",
            transition: "color 0.15s ease",
          }}
        >
          See my goals
        </a>
      </div>
    </div>
  );
}
