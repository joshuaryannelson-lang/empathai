/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PatientNav from "./components/PatientNav";

const ACCENT = "#38bdf8";

/**
 * Portal session — PHI-light identity.
 * case_code: pseudonymous case identifier (e.g. "EMP-A3F2B1")
 * token: signed JWT scoped to case_code only
 * display_label: first name only (never stored alongside case_code server-side)
 *
 * Legacy fields (patient_id, case_id) retained for demo mode backward compat.
 */
type PortalSession = {
  case_code: string;
  token: string;
  display_label: string;
  // Legacy demo fields (will be removed post-pilot)
  patient_id?: string;
  case_id?: string;
};

export const PortalIdentityContext = React.createContext<{
  session: PortalSession | null;
  setSession: (s: PortalSession | null) => void;
  signOut: () => void;
  /** Convenience: returns Authorization header value */
  authHeader: () => string | null;
}>({
  session: null,
  setSession: () => {},
  signOut: () => {},
  authHeader: () => null,
});

// Storage keys — never store patient name alongside case_code
const LS_TOKEN = "portal_token";
const LS_CASE_CODE = "portal_case_code";
const LS_LABEL = "portal_label";
// Legacy keys (demo compat)
const LS_LEGACY_CASE_ID = "patient_case_id";
const LS_LEGACY_NAME = "patient_name";
const LS_LEGACY_PID = "patient_id";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSessionState] = useState<PortalSession | null>(null);
  const [ready, setReady] = useState(false);

  // Decode JWT expiry client-side (no verification — just check exp claim)
  function isTokenExpired(token: string): boolean {
    if (!token) return false; // empty token = demo mode, not "expired"
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (typeof payload.exp === "number") {
        return payload.exp * 1000 < Date.now();
      }
    } catch {}
    return false;
  }

  // Restore session from localStorage
  useEffect(() => {
    try {
      const token = localStorage.getItem(LS_TOKEN);
      const caseCode = localStorage.getItem(LS_CASE_CODE);
      const label = localStorage.getItem(LS_LABEL);
      if (token && caseCode) {
        // If the JWT is expired, clear it and show join code screen
        if (isTokenExpired(token)) {
          localStorage.removeItem(LS_TOKEN);
          localStorage.removeItem(LS_CASE_CODE);
          localStorage.removeItem(LS_LABEL);
          // Don't restore session — leave it null
        } else {
          setSessionState({ token, case_code: caseCode, display_label: label || "Patient" });
          // Sync cookie for middleware profile gate
          document.cookie = `portal_token=${token}; path=/portal; SameSite=Lax; max-age=86400`;
        }
      } else {
        // Try legacy keys (demo mode backward compat)
        const caseId = localStorage.getItem(LS_LEGACY_CASE_ID);
        const patientName = localStorage.getItem(LS_LEGACY_NAME);
        const patientId = localStorage.getItem(LS_LEGACY_PID);
        if (caseId && patientName && patientId) {
          setSessionState({
            case_code: caseId, // In legacy mode, case_code falls back to case_id
            token: "", // No JWT in legacy/demo mode
            display_label: patientName,
            patient_id: patientId,
            case_id: caseId,
          });
        }
      }
    } catch {}
    setReady(true);
  }, []);

  function setSession(s: PortalSession | null) {
    setSessionState(s);
    if (s) {
      try {
        localStorage.setItem(LS_TOKEN, s.token);
        localStorage.setItem(LS_CASE_CODE, s.case_code);
        localStorage.setItem(LS_LABEL, s.display_label);
        // Also set legacy keys for backward compat
        if (s.case_id) localStorage.setItem(LS_LEGACY_CASE_ID, s.case_id);
        if (s.display_label) localStorage.setItem(LS_LEGACY_NAME, s.display_label);
        if (s.patient_id) localStorage.setItem(LS_LEGACY_PID, s.patient_id);
        // Set cookie for middleware profile gate (httpOnly=false so JS can clear it)
        if (s.token) {
          document.cookie = `portal_token=${s.token}; path=/portal; SameSite=Lax; max-age=86400`;
        }
      } catch {}
    }
  }

  function signOut() {
    try {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_CASE_CODE);
      localStorage.removeItem(LS_LABEL);
      localStorage.removeItem(LS_LEGACY_CASE_ID);
      localStorage.removeItem(LS_LEGACY_NAME);
      localStorage.removeItem(LS_LEGACY_PID);
      // Clear middleware cookies
      document.cookie = "portal_token=; path=/portal; max-age=0";
      document.cookie = "portal_profile_complete=; path=/portal; max-age=0";
    } catch {}
    setSessionState(null);
    router.push("/portal/onboarding");
  }

  function authHeader(): string | null {
    if (!session?.token) return null;
    return `Bearer ${session.token}`;
  }

  if (!ready) return null;

  // Map session to legacy identity for child components during transition
  const identity = session
    ? {
        patient_id: session.patient_id ?? "",
        patient_name: session.display_label,
        case_id: session.case_id ?? session.case_code,
      }
    : null;

  return (
    <PortalIdentityContext.Provider value={{ session, setSession, signOut, authHeader }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c12; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .patient-shell { min-height:100vh; background:#080c12; color:#e2e8f0; font-family:'DM Sans',system-ui; position:relative; }
        .fade-in { animation:fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-1 { animation:fadeUp 0.45s 0.08s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-2 { animation:fadeUp 0.45s 0.16s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-in-3 { animation:fadeUp 0.45s 0.24s cubic-bezier(0.16,1,0.3,1) both; }
        .card { border-radius:16px; border:1px solid #1a1e2a; background:#0d1018; padding:20px 22px; }
        .label { font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:8px; font-family:'DM Mono',monospace; }
        .section-title { font-size:13px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:14px; font-family:'DM Mono',monospace; }
        .input-field {
          width:100%; padding:12px 14px; border-radius:10px;
          border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04);
          color:#e2e8f0; font-family:'DM Sans',system-ui; font-size:14px;
          transition:border-color .15s, background .15s; outline:none;
        }
        .input-field:focus { border-color:rgba(56,189,248,0.4); background:rgba(56,189,248,0.04); }
        .input-field::placeholder { color:rgba(255,255,255,0.25); }
        .btn-primary {
          padding:13px 28px; border-radius:12px; border:1px solid rgba(56,189,248,0.33);
          background:linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.08));
          color:white; font-size:15px; font-weight:800; cursor:pointer; font-family:'Sora',system-ui;
          transition:all .2s ease; letter-spacing:-.2px;
        }
        .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg, rgba(56,189,248,0.28), rgba(56,189,248,0.12)); box-shadow:0 0 24px rgba(56,189,248,0.18); }
        .btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
        .skeleton { background:linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:5px; }
        @media (max-width: 480px) {
          .portal-header { padding: 10px 14px !important; }
          .portal-brand-text { display: none !important; }
          .portal-badge { display: none !important; }
          .portal-patient-name { display: none !important; }
          .portal-signout { font-size: 11px !important; padding: 4px 8px !important; }
        }
      `}</style>

      <div className="patient-shell">

        <header className="portal-header" style={{
          position: "relative",
          zIndex: 10,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(10px)",
          background: "rgba(8,8,16,0.7)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `linear-gradient(135deg, ${ACCENT}, #7c5cfc)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, flexShrink: 0,
            }}>&#9678;</div>
            <span className="portal-brand-text" style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3, color: "#e2e8f0" }}>empathAI</span>
            <span className="portal-badge" style={{ fontSize: 11, fontWeight: 600, color: ACCENT, opacity: 0.8, marginLeft: 4, fontFamily: "'DM Mono',monospace" }}>Patient Portal</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {identity && (
              <>
                <PatientNav />
                <span className="portal-patient-name" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                  {identity.patient_name}
                </span>
                <button
                  className="portal-signout"
                  onClick={signOut}
                  style={{
                    fontSize: 12, fontWeight: 600,
                    color: "rgba(255,255,255,0.3)",
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7,
                    padding: "5px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all .15s",
                  }}
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </header>

        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </div>
    </PortalIdentityContext.Provider>
  );
}
