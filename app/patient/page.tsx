/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Identity = { patient_id: string; patient_name: string; case_id: string };

type Checkin = {
  id: string;
  score: number | null;
  mood: number | null;
  created_at: string;
  note: string | null;
  notes: string | null;
};

type SessionNote = { date: string; text: string };

type Goal = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
};

type TimelineData = {
  case: { id: string; title: string | null; status: string | null };
  patient: {
    first_name: string | null;
    last_name: string | null;
    extended_profile?: {
      session_notes?: SessionNote[];
      activities?: { date: string; description: string }[];
    };
  } | null;
  therapist: { name: string | null } | null;
  checkins: Checkin[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const ACCENT = "#38bdf8";
const ACCENT_RGB = "56,189,248";

const scoreColor = (s: number | null) => {
  if (s === null) return { fg: "#6b7280", bg: "#111420", border: "#1f2533" };
  if (s <= 2) return { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" };
  if (s <= 3) return { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" };
  if (s <= 5) return { fg: "#eab308", bg: "#1a1500", border: "#3d3200" };
  return { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" };
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

const noteText = (c: Checkin) => c.note || c.notes || null;

// ── Score button label ────────────────────────────────────────────────────────
const SCORE_LABELS: Record<number, string> = {
  1: "Very bad", 2: "Bad", 3: "Struggling", 4: "Below average", 5: "Okay",
  6: "Decent", 7: "Good", 8: "Great", 9: "Really good", 10: "Excellent",
};

// ── Noise ─────────────────────────────────────────────────────────────────────
function Noise() {
  return (
    <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, opacity: 0.025 }} xmlns="http://www.w3.org/2000/svg">
      <filter id="pnoise">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#pnoise)" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PatientPortal() {
  const [step, setStep] = useState<"identify" | "register" | "registered" | "welcome" | "portal">("identify");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Identify form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [dob, setDob]             = useState("");
  const [identifyError, setIdentifyError]   = useState<string | null>(null);
  const [identifyLoading, setIdentifyLoading] = useState(false);

  // Register form
  const [regEmail, setRegEmail]         = useState("");
  const [regPhone, setRegPhone]         = useState("");
  const [regPracticeId, setRegPracticeId] = useState("");
  const [regPractices, setRegPractices] = useState<{ id: string; name: string }[]>([]);
  const [regError, setRegError]         = useState<string | null>(null);
  const [regLoading, setRegLoading]     = useState(false);

  // Demo shortcut
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError]     = useState<string | null>(null);

  // Check-in widget
  const [checkinScore, setCheckinScore] = useState<number | null>(null);
  const [checkinNote, setCheckinNote]   = useState("");
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinDone, setCheckinDone]   = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  // Load practices when register step opens
  useEffect(() => {
    if (step !== "register" || regPractices.length > 0) return;
    fetch("/api/practices", { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        const list = j?.data ?? [];
        setRegPractices(list);
        if (list.length === 1) setRegPracticeId(list[0].id);
      })
      .catch(() => {});
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore from localStorage
  useEffect(() => {
    try {
      const caseId     = localStorage.getItem("patient_case_id");
      const patientName = localStorage.getItem("patient_name");
      const patientId  = localStorage.getItem("patient_id");
      if (caseId && patientName && patientId) {
        setIdentity({ case_id: caseId, patient_name: patientName, patient_id: patientId });
        setStep("portal");
      }
    } catch {}
  }, []);

  // Load data on portal entry
  useEffect(() => {
    if (step !== "portal" || !identity) return;
    setDataLoading(true);
    Promise.all([
      fetch(`/api/cases/${identity.case_id}/timeline`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/cases/${identity.case_id}/goals`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
    ]).then(([tJson, gJson]) => {
      if (tJson) setTimeline(tJson?.data ?? tJson);
      setGoals(gJson?.data ?? []);
    }).finally(() => setDataLoading(false));
  }, [step, identity]);

  async function handleIdentify() {
    if (!firstName.trim() || !lastName.trim() || !dob) return;
    setIdentifyLoading(true);
    setIdentifyError(null);
    try {
      const res  = await fetch("/api/patient/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), dob }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not find your account.");
      const { patient_id, patient_name, case_id } = json.data;
      setIdentity({ patient_id, patient_name, case_id });
      try {
        localStorage.setItem("patient_case_id", case_id);
        localStorage.setItem("patient_name", patient_name);
        localStorage.setItem("patient_id", patient_id);
      } catch {}
      setStep("welcome");
    } catch (e: any) {
      setIdentifyError(e?.message ?? "Something went wrong.");
    } finally {
      setIdentifyLoading(false);
    }
  }

  async function handleRegister() {
    if (!firstName.trim() || !lastName.trim() || !dob) return;
    setRegLoading(true);
    setRegError(null);
    try {
      const body: Record<string, string> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob,
      };
      if (regEmail.trim())    body.email       = regEmail.trim();
      if (regPhone.trim())    body.phone       = regPhone.trim();
      if (regPracticeId)      body.practice_id = regPracticeId;
      const res  = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Registration failed.");
      setStep("registered");
    } catch (e: any) {
      setRegError(e?.message ?? "Something went wrong.");
    } finally {
      setRegLoading(false);
    }
  }

  async function handleDemoPatient() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      // Pick a practice
      const practicesJson = await fetch("/api/practices", { cache: "no-store" }).then(r => r.json());
      const practices: { id: string; name: string }[] = practicesJson?.data ?? [];
      if (!practices.length) throw new Error("No practices found in demo data.");

      // Shuffle practices and try each until we find cases with patients
      const shuffled = [...practices].sort(() => Math.random() - 0.5);
      let picked: { id: string; patient_id: string; patient_first_name: string; patient_last_name: string } | null = null;
      for (const practice of shuffled) {
        const casesJson = await fetch(`/api/cases?practice_id=${practice.id}&limit=50`, { cache: "no-store" }).then(r => r.json());
        const cases: { id: string; patient_id: string | null; patient_first_name: string | null; patient_last_name: string | null }[] = casesJson?.data ?? [];
        const eligible = cases.filter(c => c.patient_id && c.patient_first_name);
        if (eligible.length) {
          const c = eligible[Math.floor(Math.random() * eligible.length)];
          picked = { id: c.id, patient_id: c.patient_id!, patient_first_name: c.patient_first_name!, patient_last_name: c.patient_last_name ?? "" };
          break;
        }
      }
      if (!picked) throw new Error("No patient cases found in demo data.");

      const patientName = `${picked.patient_first_name} ${picked.patient_last_name}`.trim();
      setIdentity({ case_id: picked.id, patient_name: patientName, patient_id: picked.patient_id });
      setStep("welcome");
    } catch (e: any) {
      setDemoError(e?.message ?? "Could not load demo patient.");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleCheckin() {
    if (!checkinScore || !identity) return;
    setCheckinLoading(true);
    setCheckinError(null);
    try {
      const res  = await fetch(`/api/patient/${identity.case_id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: checkinScore, note: checkinNote.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to submit.");
      setCheckinDone(true);
      setCheckinScore(null);
      setCheckinNote("");
      // Refresh checkins
      fetch(`/api/cases/${identity.case_id}/timeline`, { cache: "no-store" })
        .then(r => r.json())
        .then(j => { if (j) setTimeline(j?.data ?? j); })
        .catch(() => {});
    } catch (e: any) {
      setCheckinError(e?.message ?? "Failed to submit.");
    } finally {
      setCheckinLoading(false);
    }
  }

  function handleSignOut() {
    try {
      localStorage.removeItem("patient_case_id");
      localStorage.removeItem("patient_name");
      localStorage.removeItem("patient_id");
    } catch {}
    setIdentity(null);
    setTimeline(null);
    setGoals([]);
    setStep("identify");
    setFirstName(""); setLastName(""); setDob("");
    setIdentifyError(null);
    setCheckinDone(false);
  }

  const checkins    = timeline?.checkins ?? [];
  const sessionNotes = [...(timeline?.patient?.extended_profile?.session_notes ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date)
  );
  const therapistName = timeline?.therapist?.name ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080810; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes orb1 { 0%,100%{transform:translate(0,0)scale(1)} 50%{transform:translate(30px,-20px)scale(1.06)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0)scale(1)} 50%{transform:translate(-30px,30px)scale(1.04)} }
        .patient-shell { min-height:100vh; background:#080810; color:#e2e8f0; font-family:'DM Sans',system-ui; position:relative; }
        .fade-in { animation:fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-1 { animation:fadeUp 0.45s 0.08s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-2 { animation:fadeUp 0.45s 0.16s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-3 { animation:fadeUp 0.45s 0.24s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-4 { animation:fadeUp 0.45s 0.32s cubic-bezier(0.16,1,0.3,1) both; }
        .card { border-radius:16px; border:1px solid #1a1e2a; background:#0d1018; padding:20px 22px; }
        .label { font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:8px; font-family:'DM Mono',monospace; }
        .section-title { font-size:13px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:14px; font-family:'DM Mono',monospace; }
        .input-field {
          width:100%; padding:12px 14px; border-radius:10px;
          border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04);
          color:#e2e8f0; font-family:'DM Sans',system-ui; font-size:14px;
          transition:border-color .15s, background .15s; outline:none;
        }
        .input-field:focus { border-color:${ACCENT}66; background:rgba(56,189,248,0.04); }
        .input-field::placeholder { color:rgba(255,255,255,0.25); }
        .btn-primary {
          padding:13px 28px; border-radius:12px; border:1px solid ${ACCENT}55;
          background:linear-gradient(135deg, rgba(${ACCENT_RGB},0.2), rgba(${ACCENT_RGB},0.08));
          color:white; font-size:15px; font-weight:800; cursor:pointer; font-family:'Sora',system-ui;
          transition:all .2s ease; letter-spacing:-.2px;
        }
        .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg, rgba(${ACCENT_RGB},0.28), rgba(${ACCENT_RGB},0.12)); box-shadow:0 0 24px rgba(${ACCENT_RGB},0.18); }
        .btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
        .score-btn {
          width:44px; height:44px; border-radius:9px; border:1px solid rgba(255,255,255,0.1);
          background:rgba(255,255,255,0.03); color:rgba(255,255,255,0.55);
          font-size:13px; font-weight:700; cursor:pointer; font-family:'DM Mono',monospace;
          transition:all .15s ease; display:flex; align-items:center; justify-content:center;
        }
        .score-btn:hover { border-color:rgba(255,255,255,0.25); color:rgba(255,255,255,0.9); }
        .score-btn.active { color:white; }
        .ci-row { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid #0f1218; }
        .ci-row:last-child { border-bottom:none; }
        .skeleton { background:linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:5px; }
      `}</style>

      <div className="patient-shell">
        <Noise />

        {/* Ambient orbs */}
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
          <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:`radial-gradient(circle, rgba(${ACCENT_RGB},0.12) 0%, transparent 65%)`, top:"-10%", right:"-5%", animation:"orb1 20s ease-in-out infinite" }} />
          <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,92,252,0.1) 0%, transparent 65%)", bottom:"5%", left:"-5%", animation:"orb2 24s ease-in-out infinite" }} />
        </div>

        {/* ── Top header ── */}
        <header style={{ position:"relative", zIndex:10, borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", backdropFilter:"blur(10px)", background:"rgba(8,8,16,0.7)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${ACCENT}, #7c5cfc)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>◎</div>
            <span style={{ fontSize:14, fontWeight:800, letterSpacing:-.3, color:"#e2e8f0" }}>empathAI</span>
            <span style={{ fontSize:11, fontWeight:600, color:ACCENT, opacity:.8, marginLeft:4, fontFamily:"'DM Mono',monospace" }}>Patient Portal</span>
          </div>
          {identity && (
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:13, color:"rgba(255,255,255,0.5)", fontWeight:500 }}>{identity.patient_name}</span>
              <button
                onClick={handleSignOut}
                style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.3)", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit", transition:"all .15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
              >
                Sign out
              </button>
            </div>
          )}
        </header>

        {/* ── Steps ── */}
        <div style={{ position:"relative", zIndex:1 }}>

          {/* ─── STEP: IDENTIFY ─────────────────────────────────────────── */}
          {step === "identify" && (
            <div style={{ minHeight:"calc(100vh - 61px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
              <div style={{ width:"100%", maxWidth:420 }}>
                <div className="fade-in" style={{ marginBottom:32, textAlign:"center" }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.6, textTransform:"uppercase", color:ACCENT, opacity:.85, fontFamily:"'DM Mono',monospace", marginBottom:12 }}>
                    Step 1 of 3
                  </div>
                  <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:-.8, color:"rgba(255,255,255,0.97)", lineHeight:1.1, fontFamily:"'Sora',system-ui" }}>
                    Let&apos;s find<br />your account
                  </h1>
                  <p style={{ marginTop:10, fontSize:14, color:"rgba(255,255,255,0.42)", lineHeight:1.6 }}>
                    Enter your name and date of birth to access your care portal.
                  </p>
                </div>

                <div className="card fade-in-1" style={{ display:"grid", gap:16 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:12 }}>
                    <div>
                      <div className="label">First name</div>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="Jane"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleIdentify()}
                      />
                    </div>
                    <div>
                      <div className="label">Last name</div>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="Smith"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleIdentify()}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="label">Date of birth</div>
                    <input
                      className="input-field"
                      type="date"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleIdentify()}
                      style={{ colorScheme:"dark" }}
                    />
                  </div>

                  {identifyError && (
                    <div style={{ fontSize:13, color:"#f87171", background:"#1a0808", border:"1px solid #3d1a1a", borderRadius:8, padding:"10px 12px", lineHeight:1.5 }}>
                      {identifyError}
                    </div>
                  )}

                  <button
                    className="btn-primary"
                    onClick={handleIdentify}
                    disabled={identifyLoading || !firstName.trim() || !lastName.trim() || !dob}
                    style={{ width:"100%", marginTop:4 }}
                  >
                    {identifyLoading ? "Looking up…" : "Continue →"}
                  </button>
                </div>

                <div className="fade-in-2" style={{ marginTop:20, textAlign:"center" }}>
                  <span style={{ fontSize:13, color:"rgba(255,255,255,0.3)" }}>New patient? </span>
                  <button
                    onClick={() => { setRegEmail(""); setRegPhone(""); setRegPracticeId(""); setRegError(null); setStep("register"); }}
                    style={{ fontSize:13, fontWeight:600, color:ACCENT, background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:"inherit", opacity:.9 }}
                  >
                    Get started →
                  </button>
                </div>

                {/* Demo shortcut */}
                <div className="fade-in-2" style={{ marginTop:16 }}>
                  <button
                    onClick={handleDemoPatient}
                    disabled={demoLoading}
                    style={{
                      width:"100%", padding:"11px 0", borderRadius:10,
                      border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)",
                      color:"rgba(255,255,255,0.45)", fontSize:13, fontWeight:600,
                      cursor:demoLoading?"not-allowed":"pointer", fontFamily:"inherit",
                      transition:"all .15s", letterSpacing:.1,
                    }}
                    onMouseEnter={e => { if (!demoLoading) { (e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.65)"; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.03)"; (e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.45)"; }}
                  >
                    {demoLoading ? "Loading demo patient…" : "◎  View as existing patient (demo)"}
                  </button>
                  {demoError && (
                    <div style={{ marginTop:8, fontSize:12, color:"#f87171", textAlign:"center" }}>{demoError}</div>
                  )}
                </div>

                <div className="fade-in-2" style={{ marginTop:12, textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.2)", fontFamily:"'DM Mono',monospace" }}>
                  Demo environment · Synthetic data only
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP: REGISTER ─────────────────────────────────────────── */}
          {step === "register" && (
            <div style={{ minHeight:"calc(100vh - 61px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
              <div style={{ width:"100%", maxWidth:420 }}>
                <div className="fade-in" style={{ marginBottom:32, textAlign:"center" }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.6, textTransform:"uppercase", color:ACCENT, opacity:.85, fontFamily:"'DM Mono',monospace", marginBottom:12 }}>
                    New Patient
                  </div>
                  <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:-.8, color:"rgba(255,255,255,0.97)", lineHeight:1.1, fontFamily:"'Sora',system-ui" }}>
                    Create your<br />account
                  </h1>
                  <p style={{ marginTop:10, fontSize:14, color:"rgba(255,255,255,0.42)", lineHeight:1.6 }}>
                    Once registered, your care team will connect you to the portal.
                  </p>
                </div>

                <div className="card fade-in-1" style={{ display:"grid", gap:16 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:12 }}>
                    <div>
                      <div className="label">First name</div>
                      <input className="input-field" type="text" placeholder="Jane" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    </div>
                    <div>
                      <div className="label">Last name</div>
                      <input className="input-field" type="text" placeholder="Smith" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="label">Date of birth</div>
                    <input className="input-field" type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ colorScheme:"dark" }} />
                  </div>
                  <div>
                    <div className="label">Email <span style={{ opacity:.5 }}>(optional)</span></div>
                    <input className="input-field" type="email" placeholder="jane@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                  </div>
                  <div>
                    <div className="label">Phone <span style={{ opacity:.5 }}>(optional)</span></div>
                    <input className="input-field" type="tel" placeholder="+1 555 000 0000" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                  </div>
                  {regPractices.length > 0 && (
                    <div>
                      <div className="label">Practice</div>
                      <select
                        className="input-field"
                        value={regPracticeId}
                        onChange={e => setRegPracticeId(e.target.value)}
                        style={{ appearance: "none", cursor: "pointer" }}
                      >
                        <option value="">Select your practice…</option>
                        {regPractices.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {regError && (
                    <div style={{ fontSize:13, color:"#f87171", background:"#1a0808", border:"1px solid #3d1a1a", borderRadius:8, padding:"10px 12px", lineHeight:1.5 }}>
                      {regError}
                    </div>
                  )}

                  <button
                    className="btn-primary"
                    onClick={handleRegister}
                    disabled={regLoading || !firstName.trim() || !lastName.trim() || !dob}
                    style={{ width:"100%", marginTop:4 }}
                  >
                    {regLoading ? "Registering…" : "Register →"}
                  </button>
                </div>

                <div className="fade-in-2" style={{ marginTop:20, textAlign:"center" }}>
                  <span style={{ fontSize:13, color:"rgba(255,255,255,0.3)" }}>Already have an account? </span>
                  <button
                    onClick={() => { setIdentifyError(null); setStep("identify"); }}
                    style={{ fontSize:13, fontWeight:600, color:ACCENT, background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:"inherit", opacity:.9 }}
                  >
                    Sign in →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP: REGISTERED ───────────────────────────────────────── */}
          {step === "registered" && (
            <div style={{ minHeight:"calc(100vh - 61px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
              <div style={{ width:"100%", maxWidth:440, textAlign:"center" }}>
                <div className="fade-in">
                  <div style={{ width:64, height:64, borderRadius:20, background:"rgba(74,222,128,0.12)", border:"1px solid rgba(74,222,128,0.25)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", fontSize:28 }}>
                    ✓
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.6, textTransform:"uppercase", color:"#4ade80", opacity:.85, fontFamily:"'DM Mono',monospace", marginBottom:10 }}>
                    Registration complete
                  </div>
                  <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:-.8, color:"rgba(255,255,255,0.97)", lineHeight:1.1, fontFamily:"'Sora',system-ui" }}>
                    You&apos;re on the list,<br />{firstName}.
                  </h1>
                  <p style={{ marginTop:14, fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.7, maxWidth:360, margin:"14px auto 0" }}>
                    Your account has been created. Your care team will reach out to connect you to the full portal.
                  </p>
                </div>
                <div className="fade-in-1" style={{ marginTop:32 }}>
                  <button
                    className="btn-primary"
                    onClick={() => { setFirstName(""); setLastName(""); setDob(""); setRegEmail(""); setRegPhone(""); setStep("identify"); }}
                    style={{ padding:"12px 28px" }}
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP: WELCOME ──────────────────────────────────────────── */}
          {step === "welcome" && identity && (
            <div style={{ minHeight:"calc(100vh - 61px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
              <div style={{ width:"100%", maxWidth:480, textAlign:"center" }}>
                <div className="fade-in">
                  <div style={{ width:64, height:64, borderRadius:20, background:`rgba(${ACCENT_RGB},0.12)`, border:`1px solid rgba(${ACCENT_RGB},0.25)`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", fontSize:26 }}>
                    ◎
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.6, textTransform:"uppercase", color:ACCENT, opacity:.85, fontFamily:"'DM Mono',monospace", marginBottom:10 }}>
                    Welcome back
                  </div>
                  <h1 style={{ fontSize:36, fontWeight:900, letterSpacing:-1, color:"rgba(255,255,255,0.97)", lineHeight:1.1, fontFamily:"'Sora',system-ui" }}>
                    Hi, {identity.patient_name.split(" ")[0]}.
                  </h1>
                  <p style={{ marginTop:14, fontSize:15, color:"rgba(255,255,255,0.5)", lineHeight:1.7, maxWidth:380, margin:"14px auto 0" }}>
                    Your care portal is ready. You can check in with how you&apos;re feeling, view notes from your sessions, track your treatment goals, and more.
                  </p>
                </div>

                <div className="fade-in-1" style={{ marginTop:32, display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, maxWidth:360, margin:"32px auto 0" }}>
                  {[
                    { icon:"💬", label:"Log how you feel" },
                    { icon:"📋", label:"Session notes" },
                    { icon:"🎯", label:"Treatment goals" },
                    { icon:"✉️", label:"Messages (soon)" },
                  ].map(f => (
                    <div key={f.label} style={{ padding:"12px 14px", borderRadius:12, border:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.02)", display:"flex", alignItems:"center", gap:9 }}>
                      <span style={{ fontSize:16 }}>{f.icon}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.55)" }}>{f.label}</span>
                    </div>
                  ))}
                </div>

                <div className="fade-in-2" style={{ marginTop:28 }}>
                  <button
                    className="btn-primary"
                    onClick={() => setStep("portal")}
                    style={{ padding:"14px 40px" }}
                  >
                    Open my portal →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP: PORTAL ───────────────────────────────────────────── */}
          {step === "portal" && identity && (
            <div style={{ maxWidth:720, margin:"0 auto", padding:"32px 20px 80px" }}>

              {/* Page title */}
              <div className="fade-in" style={{ marginBottom:28 }}>
                <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:-.5, color:"rgba(255,255,255,0.9)", fontFamily:"'Sora',system-ui" }}>
                  My Care Portal
                </h2>
                {therapistName && (
                  <p style={{ fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:4 }}>
                    Care provider: {therapistName}
                  </p>
                )}
              </div>

              {dataLoading ? (
                <div style={{ display:"grid", gap:12 }}>
                  {[1,2,3].map(i => (
                    <div key={i} className="card">
                      <div className="skeleton" style={{ height:12, width:"40%", marginBottom:14 }} />
                      <div className="skeleton" style={{ height:12, width:"80%", marginBottom:8 }} />
                      <div className="skeleton" style={{ height:12, width:"65%" }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display:"grid", gap:14 }}>

                  {/* ── Check-in widget ── */}
                  <div className="card fade-in" style={{ border:`1px solid rgba(${ACCENT_RGB},0.18)`, background:`linear-gradient(160deg, rgba(${ACCENT_RGB},0.05) 0%, #0d1018 60%)` }}>
                    {checkinDone ? (
                      <div style={{ textAlign:"center", padding:"12px 0" }}>
                        <div style={{ fontSize:28, marginBottom:10 }}>✓</div>
                        <div style={{ fontSize:16, fontWeight:700, color:ACCENT, fontFamily:"'Sora',system-ui" }}>Check-in recorded</div>
                        <p style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginTop:6, lineHeight:1.5 }}>Thanks for sharing. Your care team will see this.</p>
                        <button
                          onClick={() => setCheckinDone(false)}
                          style={{ marginTop:14, fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.35)", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit" }}
                        >
                          Log another
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
                          <span style={{ fontSize:18 }}>💬</span>
                          <div>
                            <div style={{ fontSize:15, fontWeight:800, color:"rgba(255,255,255,0.9)", fontFamily:"'Sora',system-ui" }}>How are you feeling today?</div>
                            <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2 }}>Rate from 1 (very bad) to 10 (excellent)</div>
                          </div>
                        </div>

                        {/* Score buttons */}
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                            const c = scoreColor(n);
                            const isActive = checkinScore === n;
                            return (
                              <button
                                key={n}
                                className={`score-btn${isActive ? " active" : ""}`}
                                onClick={() => setCheckinScore(n)}
                                style={isActive ? { background: c.bg, border: `1px solid ${c.border}`, color: c.fg } : {}}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>

                        {/* Score label */}
                        {checkinScore && (
                          <div style={{ fontSize:13, fontWeight:600, color:scoreColor(checkinScore).fg, marginBottom:12, fontFamily:"'DM Mono',monospace", letterSpacing:.3 }}>
                            {SCORE_LABELS[checkinScore]}
                          </div>
                        )}

                        {/* Note */}
                        <textarea
                          className="input-field"
                          placeholder="Add a note (optional) — what's on your mind?"
                          value={checkinNote}
                          onChange={e => setCheckinNote(e.target.value)}
                          rows={2}
                          style={{ resize:"none", lineHeight:1.6 }}
                        />

                        {checkinError && (
                          <div style={{ fontSize:12, color:"#f87171", marginTop:8 }}>{checkinError}</div>
                        )}

                        <div style={{ marginTop:12 }}>
                          <button
                            className="btn-primary"
                            onClick={handleCheckin}
                            disabled={!checkinScore || checkinLoading}
                            style={{ fontSize:13, padding:"11px 22px" }}
                          >
                            {checkinLoading ? "Saving…" : "Submit check-in"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Recent check-ins ── */}
                  {checkins.length > 0 && (
                    <div className="card fade-in-1">
                      <div className="section-title">My recent check-ins</div>
                      <div>
                        {checkins.slice(0, 6).map((ci, idx) => {
                          const c = scoreColor(ci.score);
                          return (
                            <div key={ci.id} className="ci-row">
                              <div style={{ width:38, height:38, borderRadius:9, background:c.bg, border:`1px solid ${c.border}`, color:c.fg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, flexShrink:0 }}>
                                {ci.score ?? "—"}
                              </div>
                              <div>
                                <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"'DM Mono',monospace" }}>
                                  {fmtFull(ci.created_at)}{idx === 0 ? " · latest" : ""}
                                </div>
                                {noteText(ci)
                                  ? <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginTop:3, lineHeight:1.5, fontStyle:"italic" }}>&quot;{noteText(ci)}&quot;</div>
                                  : <div style={{ fontSize:12, color:"rgba(255,255,255,0.2)", marginTop:3, fontStyle:"italic" }}>No note</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Session notes ── */}
                  <div className="card fade-in-2">
                    <div className="section-title">Notes from my sessions</div>
                    {sessionNotes.length === 0 ? (
                      <p style={{ fontSize:13, color:"rgba(255,255,255,0.25)", fontStyle:"italic" }}>No session notes yet.</p>
                    ) : (
                      <div style={{ display:"grid", gap:10 }}>
                        {sessionNotes.map((n, i) => (
                          <div key={i} style={{ padding:"12px 14px", borderRadius:10, border:"1px solid #131720", background:"#080c12" }}>
                            <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)", letterSpacing:.5, marginBottom:5, fontFamily:"'DM Mono',monospace" }}>
                              {fmtDate(n.date)}
                            </div>
                            <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.7 }}>{n.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Treatment goals ── */}
                  <div className="card fade-in-3">
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                      <div className="section-title" style={{ marginBottom:0 }}>My goals</div>
                      {goals.length > 0 && (
                        <span style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.25)", fontFamily:"'DM Mono',monospace" }}>
                          {goals.filter(g => g.status === "done" || g.status === "completed").length}/{goals.length} done
                        </span>
                      )}
                    </div>
                    {goals.length === 0 ? (
                      <p style={{ fontSize:13, color:"rgba(255,255,255,0.25)", fontStyle:"italic" }}>No goals set yet.</p>
                    ) : (
                      <div style={{ display:"grid", gap:0 }}>
                        {goals.map(g => {
                          const done = g.status === "done" || g.status === "completed";
                          return (
                            <div key={g.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:"1px solid #0f1218" }}>
                              <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, background:done?"#061a0b":"#0d1018", border:`1px solid ${done?"#0e2e1a":"#1f2533"}`, color:done?"#4ade80":"transparent" }}>
                                {done ? "✓" : ""}
                              </div>
                              <div>
                                <div style={{ fontSize:13, lineHeight:1.5, color:done?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.8)", textDecoration:done?"line-through":"none" }}>{g.title}</div>
                                {g.target_date && <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:2 }}>Target: {fmtDate(g.target_date)}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Messages (coming soon) ── */}
                  <div className="card fade-in-4" style={{ border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.01)" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:16 }}>✉️</span>
                        <div className="section-title" style={{ marginBottom:0 }}>Messages</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:"uppercase", padding:"3px 9px", borderRadius:999, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.3)" }}>
                        Coming soon
                      </span>
                    </div>
                    <p style={{ fontSize:13, color:"rgba(255,255,255,0.25)", lineHeight:1.65 }}>
                      Direct messaging with your care provider is on the way. You&apos;ll be able to send and receive messages, share updates between sessions, and get quick responses from your therapist.
                    </p>
                    <div style={{ marginTop:14, display:"flex", gap:8 }}>
                      <div style={{ flex:1, height:36, borderRadius:8, border:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.02)", display:"flex", alignItems:"center", paddingLeft:12 }}>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.2)", fontStyle:"italic" }}>Write a message…</span>
                      </div>
                      <div style={{ width:36, height:36, borderRadius:8, border:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.02)", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.2)", fontSize:14 }}>→</div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
