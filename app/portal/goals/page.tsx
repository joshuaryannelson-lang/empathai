"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalIdentityContext } from "../layout";

type Goal = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function GoalsPage() {
  const router = useRouter();
  const { session } = useContext(PortalIdentityContext);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) { router.replace("/portal/onboarding"); return; }
    const identity = { case_id: session.case_id ?? session.case_code };
    // Append ?demo=true for demo sessions (empty token = legacy demo mode)
    const demoSuffix = !session.token ? "?demo=true" : "";
    setLoading(true);
    fetch(`/api/cases/${identity.case_id}/goals${demoSuffix}`, { cache: "no-store" })
      .then(r => r.json())
      .then(json => setGoals(json?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, router]);

  if (!session) return null;

  const doneCount = goals.filter(g => g.status === "done" || g.status === "completed").length;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div className="fade-in" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "rgba(255,255,255,0.9)", fontFamily: "'Sora',system-ui" }}>
          My Goals
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
          Treatment goals set by your care team.
        </p>
      </div>

      {loading ? (
        <div className="card">
          <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 12, width: "80%", marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 12, width: "65%" }} />
        </div>
      ) : (
        <div className="card fade-in-1" data-tour="goals-list" data-demo-spotlight="goals-list">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Treatment goals</div>
            {goals.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono',monospace" }}>
                {doneCount}/{goals.length} done
              </span>
            )}
          </div>

          {goals.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No goals set yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 0 }}>
              {goals.map((g, idx) => {
                const done = g.status === "done" || g.status === "completed";
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: idx < goals.length - 1 ? "1px solid #0f1218" : "none" }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 900,
                      background: done ? "#061a0b" : "#0d1018",
                      border: `1px solid ${done ? "#0e2e1a" : "#1f2533"}`,
                      color: done ? "#4ade80" : "transparent",
                    }}>
                      {done ? "\u2713" : ""}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, lineHeight: 1.5,
                        color: done ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.8)",
                        textDecoration: done ? "line-through" : "none",
                      }}>
                        {g.title}
                      </div>
                      {g.target_date && (
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                          Target: {fmtDate(g.target_date)}
                        </div>
                      )}
                    </div>
                    {/* Status badge */}
                    <div style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: done ? "rgba(74,222,128,0.08)" : "rgba(56,189,248,0.08)",
                      border: `1px solid ${done ? "rgba(74,222,128,0.15)" : "rgba(56,189,248,0.15)"}`,
                      marginTop: 1,
                    }}>
                      {done ? (
                        <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 900, lineHeight: 1 }}>{"\u2713"}</span>
                      ) : (
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: "#4ade80",
                          flexShrink: 0,
                        }} />
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                        color: done ? "rgba(74,222,128,0.7)" : "rgba(74,222,128,0.7)",
                        fontFamily: "'DM Mono', monospace",
                      }}>
                        {done ? "Completed" : "Active"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
