/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalIdentityContext } from "../layout";

type Checkin = {
  id: string;
  score: number | null;
  mood: number | null;
  created_at: string;
  note: string | null;
  notes: string | null;
};

type SessionNote = { date: string; text: string };

const scoreColor = (s: number | null) => {
  if (s === null) return { fg: "#6b7280", bg: "#111420", border: "#1f2533" };
  if (s <= 2) return { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" };
  if (s <= 3) return { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" };
  if (s <= 5) return { fg: "#eab308", bg: "#1a1500", border: "#3d3200" };
  return { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" };
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

const noteText = (c: Checkin) => c.note || c.notes || null;

export default function HistoryPage() {
  const router = useRouter();
  const { session } = useContext(PortalIdentityContext);

  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) { router.replace("/portal/onboarding"); return; }
    const identity = { case_id: session.case_id ?? session.case_code };
    // Append ?demo=true for demo sessions (empty token = legacy demo mode)
    const demoSuffix = !session.token ? "?demo=true" : "";
    setLoading(true);
    fetch(`/api/cases/${identity.case_id}/timeline${demoSuffix}`, { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        const data = json?.data ?? json;
        setCheckins(data?.checkins ?? []);
        setSessionNotes(
          [...(data?.patient?.extended_profile?.session_notes ?? [])].sort(
            (a: SessionNote, b: SessionNote) => b.date.localeCompare(a.date)
          )
        );
        // Therapist name intentionally not displayed on patient portal
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, router]);

  if (!session) return null;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div className="fade-in" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "rgba(255,255,255,0.9)", fontFamily: "'Sora',system-ui" }}>
          My History
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
          Your check-in timeline and session notes.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 14 }} />
              <div className="skeleton" style={{ height: 12, width: "80%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: "65%" }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {/* Recent check-ins */}
          {checkins.length > 0 && (
            <div className="card fade-in-1">
              <div className="section-title">My recent check-ins</div>
              <div>
                {checkins.slice(0, 10).map((ci, idx) => {
                  const c = scoreColor(ci.score);
                  return (
                    <div key={ci.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: idx < Math.min(checkins.length, 10) - 1 ? "1px solid #0f1218" : "none" }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: c.bg, border: `1px solid ${c.border}`, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                        {ci.score ?? "\u2014"}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
                          {fmtFull(ci.created_at)}{idx === 0 ? " \u00B7 latest" : ""}
                        </div>
                        {noteText(ci)
                          ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3, lineHeight: 1.5, fontStyle: "italic" }}>&quot;{noteText(ci)}&quot;</div>
                          : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 3, fontStyle: "italic" }}>No note</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session notes */}
          <div className="card fade-in-2">
            <div className="section-title">Notes from my sessions</div>
            {sessionNotes.length === 0 ? (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No session notes yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {sessionNotes.map((n, i) => (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #131720", background: "#080c12" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 0.5, marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>
                      {fmtDate(n.date)}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{n.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
