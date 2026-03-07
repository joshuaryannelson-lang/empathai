/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalIdentityContext } from "../layout";

const ACCENT = "#38bdf8";
const ACCENT_RGB = "56,189,248";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, setSession } = useContext(PortalIdentityContext);

  const [mode, setMode] = useState<"join" | "welcome">("join");

  // Join code
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);

  // Demo shortcut
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/portal/checkin");
  }, [session, router]);

  // ── Join code flow (primary) ──
  async function handleJoinCode() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/portal/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Invalid join code.");
      const { token, case_code } = json.data;
      setSession({
        token,
        case_code,
        display_label: "Patient", // No name from join code — PHI-light
      });
      setMode("welcome");
    } catch (e: any) {
      setJoinError(e?.message ?? "Something went wrong.");
    } finally {
      setJoinLoading(false);
    }
  }

  // ── Demo patient shortcut ──
  // Always use demo API endpoints (?demo=true) so we get deterministic
  // synthetic data instead of hitting the real DB.
  async function handleDemoPatient() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const casesJson = await fetch("/api/cases?practice_id=demo-practice-01&demo=true&limit=50", { cache: "no-store" }).then(r => r.json());
      const cases: { id: string; patient_id: string | null; patient_first_name: string | null }[] = casesJson?.data ?? [];
      const eligible = cases.filter(c => c.patient_id && c.patient_first_name);
      if (!eligible.length) throw new Error("No patient cases found in demo data.");

      // Pick a deterministic demo case (case 2 = Jordan, the demo patient persona)
      const picked = eligible.find(c => c.patient_first_name === "Jordan") ?? eligible[0];

      setSession({
        case_code: picked.id,
        token: "", // No JWT in demo mode
        display_label: picked.patient_first_name!,
        patient_id: picked.patient_id!,
        case_id: picked.id,
      });
      setMode("welcome");
    } catch (e: any) {
      setDemoError(e?.message ?? "Could not load demo patient.");
    } finally {
      setDemoLoading(false);
    }
  }

  // ── JOIN CODE VIEW (primary) ──
  if (mode === "join") {
    return (
      <div style={{ minHeight: "calc(100vh - 61px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>
          <div className="fade-in" style={{ marginBottom: 32, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: ACCENT, opacity: 0.85, fontFamily: "'DM Mono',monospace", marginBottom: 12 }}>
              Patient Portal
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.8, color: "rgba(255,255,255,0.97)", lineHeight: 1.1, fontFamily: "'Sora',system-ui" }}>
              Enter your<br />join code
            </h1>
            <p style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.42)", lineHeight: 1.6 }}>
              Your therapist or care team will provide you with a join code to access your portal.
            </p>
          </div>

          <div className="card fade-in-1" style={{ display: "grid", gap: 16 }}>
            <div>
              <div className="label">Join code</div>
              <input
                className="input-field"
                type="text"
                placeholder="ABCD-1234"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleJoinCode()}
                style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3, textAlign: "center", fontFamily: "'DM Mono',monospace" }}
                maxLength={9}
                autoComplete="off"
              />
            </div>

            {joinError && (
              <div style={{ fontSize: 13, color: "#f87171", background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>
                {joinError}
              </div>
            )}

            <button className="btn-primary" onClick={handleJoinCode} disabled={joinLoading || joinCode.trim().length < 4} style={{ width: "100%", marginTop: 4 }}>
              {joinLoading ? "Verifying\u2026" : "Continue \u2192"}
            </button>
          </div>

          {/* Demo shortcut */}
          <div className="fade-in-2" style={{ marginTop: 20 }}>
            <button onClick={handleDemoPatient} disabled={demoLoading} style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: `1px solid rgba(${ACCENT_RGB},0.25)`, background: `rgba(${ACCENT_RGB},0.08)`, color: `rgba(${ACCENT_RGB},0.85)`, fontSize: 14, fontWeight: 700, cursor: demoLoading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all .15s", letterSpacing: 0.1 }}>
              {demoLoading ? "Loading demo patient\u2026" : "\u25CE  View as demo patient"}
            </button>
            {demoError && <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", textAlign: "center" }}>{demoError}</div>}
          </div>

          <div className="fade-in-2" style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono',monospace" }}>
            Demo environment &middot; Synthetic data only
          </div>
        </div>
      </div>
    );
  }

  // ── WELCOME ──
  if (mode === "welcome" && session) {
    return (
      <div style={{ minHeight: "calc(100vh - 61px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
          <div className="fade-in">
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.25)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 26 }}>
              &#9678;
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: ACCENT, opacity: 0.85, fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>
              Welcome
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color: "rgba(255,255,255,0.97)", lineHeight: 1.1, fontFamily: "'Sora',system-ui" }}>
              Hi, {session.display_label.trim().split(" ")[0]}.
            </h2>
            <p style={{ marginTop: 14, fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 380, margin: "14px auto 0" }}>
              Your care portal is ready. Check in with how you&apos;re feeling, view session notes, and track your goals.
            </p>
          </div>

          <div className="fade-in-1" style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, maxWidth: 360, margin: "32px auto 0" }}>
            {[
              { icon: "\uD83D\uDCAC", label: "Log how you feel" },
              { icon: "\uD83D\uDCC8", label: "Check-in history" },
              { icon: "\uD83C\uDFAF", label: "Treatment goals" },
            ].map(f => (
              <div key={f.label} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>{f.label}</span>
              </div>
            ))}
          </div>

          <div className="fade-in-2" style={{ marginTop: 28 }}>
            <button className="btn-primary" onClick={() => router.push("/portal/checkin")} style={{ padding: "14px 40px" }}>
              Open my portal &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
