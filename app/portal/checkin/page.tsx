/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { Suspense, useContext, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PortalIdentityContext } from "../layout";
import CrisisBanner, { useCrisisDetection } from "../components/CrisisBanner";
import { detectPHI, phiWarningMessage } from "../components/PHIGuard";

const ACCENT_RGB = "56,189,248";

const scoreColor = (s: number | null) => {
  if (s === null) return { fg: "#6b7280", bg: "#111420", border: "#1f2533" };
  if (s <= 2) return { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" };
  if (s <= 3) return { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" };
  if (s <= 5) return { fg: "#eab308", bg: "#1a1500", border: "#3d3200" };
  return { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" };
};

const SCORE_LABELS: Record<number, string> = {
  1: "Very bad", 2: "Bad", 3: "Struggling", 4: "Below average", 5: "Okay",
  6: "Decent", 7: "Good", 8: "Great", 9: "Really good", 10: "Excellent",
};

function CheckinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams?.get("demo") === "true";
  const { session, authHeader } = useContext(PortalIdentityContext);

  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCrisis = useCrisisDetection(note);
  const phiViolations = detectPHI(note);
  const phiWarning = phiWarningMessage(phiViolations);
  const blocked = isCrisis || phiViolations.length > 0;

  useEffect(() => {
    if (!session && !isDemo) router.replace("/portal/onboarding");
  }, [session, isDemo, router]);

  if (!session && !isDemo) return null;

  async function handleSubmit() {
    if (!score || blocked) return;
    setLoading(true);
    setError(null);
    try {
      if (isDemo) {
        // Demo mode: simulate a short delay, no real API call
        await new Promise(r => setTimeout(r, 600));
        setDone(true);
        setScore(null);
        setNote("");
        return;
      }
      if (!session) return;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const auth = authHeader();
      if (!auth) throw new Error("Not authenticated. Please sign in with your join code.");

      headers["Authorization"] = auth;

      const url = "/api/portal/checkin";
      const body = { rating: score, notes: note.trim() || null, case_code: session.case_code };

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to submit.");
      setDone(true);
      setScore(null);
      setNote("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div className="fade-in" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "rgba(255,255,255,0.9)", fontFamily: "'Sora',system-ui" }}>
          {isDemo ? "Hi Jordan \uD83D\uDC4B" : "Weekly Check-in"}
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
          {isDemo ? "How are you feeling this week?" : "Let your care team know how you\u0027re doing."}
        </p>
        {isDemo && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6, lineHeight: 1.5 }}>
            Your therapist Dr. Maya Chen will review your response before your next session.
          </p>
        )}
      </div>

      <div className="card fade-in-1" style={{ border: `1px solid rgba(${ACCENT_RGB},0.18)`, background: `linear-gradient(160deg, rgba(${ACCENT_RGB},0.05) 0%, #0d1018 60%)` }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            {isDemo ? (
              <>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24, color: "#4ade80" }}>&#10003;</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", fontFamily: "'Sora',system-ui", letterSpacing: -0.3 }}>Thanks, Jordan</div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 8, lineHeight: 1.6, maxWidth: 340, margin: "8px auto 0" }}>
                  Your check-in has been recorded. Dr. Chen will review it before your next session on Thursday.
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 10, lineHeight: 1.5 }}>
                  That took about 60 seconds &mdash; no app to download, no personal data stored.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 10 }}>&#10003;</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: `rgb(${ACCENT_RGB})`, fontFamily: "'Sora',system-ui" }}>Check-in recorded</div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 6, lineHeight: 1.5 }}>Thanks for sharing. Your care team will see this.</p>
              </>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDone(false)} style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                Log another
              </button>
              <button onClick={() => router.push("/portal/history")} style={{ fontSize: 12, fontWeight: 600, color: `rgb(${ACCENT_RGB})`, background: `rgba(${ACCENT_RGB},0.08)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                View history &rarr;
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <span style={{ fontSize: 18 }}>{"\uD83D\uDCAC"}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.9)", fontFamily: "'Sora',system-ui" }}>How are you feeling today?</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Rate from 1 (very bad) to 10 (excellent)</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                const c = scoreColor(n);
                const isActive = score === n;
                return (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    style={{
                      width: 44, height: 44, borderRadius: 9,
                      border: isActive ? `1px solid ${c.border}` : "1px solid rgba(255,255,255,0.1)",
                      background: isActive ? c.bg : "rgba(255,255,255,0.03)",
                      color: isActive ? c.fg : "rgba(255,255,255,0.55)",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'DM Mono',monospace",
                      transition: "all .15s ease",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {score && (
              <div style={{ fontSize: 13, fontWeight: 600, color: scoreColor(score).fg, marginBottom: 12, fontFamily: "'DM Mono',monospace", letterSpacing: 0.3 }}>
                {SCORE_LABELS[score]}
              </div>
            )}

            <textarea
              className="input-field"
              placeholder="Add a note (optional) &mdash; what's on your mind?"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{ resize: "none", lineHeight: 1.6 }}
            />

            {/* Crisis banner */}
            <div style={{ marginTop: 12 }}>
              <CrisisBanner visible={isCrisis} />
            </div>

            {/* PHI warning */}
            {phiWarning && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#fb923c", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>
                {phiWarning}
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{error}</div>}

            <div style={{ marginTop: 16 }}>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!score || loading || blocked}
                style={{ width: "100%", fontSize: 16, fontWeight: 700, padding: "14px 28px", letterSpacing: -0.2 }}
              >
                {loading ? "Saving\u2026" : blocked ? "Cannot submit" : "Submit check-in"}
              </button>
              {isCrisis && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#f87171", textAlign: "center" }}>
                  Check-in is paused. Please reach out to the 988 Lifeline above if you need support.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <Suspense fallback={null}>
      <CheckinPageInner />
    </Suspense>
  );
}
