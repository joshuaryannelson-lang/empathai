"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { enableDemoMode, DEMO_CONFIG } from "@/lib/demo/demoMode";
import { setRole } from "@/lib/roleContext";
import {
  TOUR_SCRIPTS,
  writeTourState,
  clearTourState,
  type DemoPersona,
} from "@/lib/demo/tourScripts";

// ── Persona cards ────────────────────────────────────────────────────────────
const PERSONAS: {
  id: DemoPersona;
  label: string;
  eyebrowColor: string;
  icon: string;
  tagline: string;
  description: string;
  cta: string;
  accent: string;
  accentRgb: string;
  minHeight: number;
  indent: number;
}[] = [
  {
    id: "practice_owner",
    label: "PRACTICE OWNER",
    eyebrowColor: "#d97706",
    icon: "\u25C7",
    tagline: "Your organization, fully visible",
    description:
      "Oversee every practice in your network. Spot risk signals across locations before they escalate.",
    cta: "Start organization tour",
    accent: "#f5a623",
    accentRgb: "245,166,35",
    minHeight: 180,
    indent: 0,
  },
  {
    id: "manager",
    label: "PRACTICE MANAGER",
    eyebrowColor: "#4ade80",
    icon: "\u2B21",
    tagline: "Your whole practice, one view",
    description:
      "See every therapist, every case, every risk signal \u2014 and act before small problems become big ones.",
    cta: "Start practice manager tour",
    accent: "#00c8a0",
    accentRgb: "0,200,160",
    minHeight: 160,
    indent: 48,
  },
  {
    id: "therapist",
    label: "THERAPIST",
    eyebrowColor: "#6b82d4",
    icon: "\u25CE",
    tagline: "Know your patients. Really know them.",
    description:
      "Walk into every session prepared. Surface the patients who need you most before they slip through.",
    cta: "Start therapist tour",
    accent: "#7c5cfc",
    accentRgb: "124,92,252",
    minHeight: 160,
    indent: 96,
  },
  {
    id: "patient",
    label: "PATIENT",
    eyebrowColor: "#38bdf8",
    icon: "\u2661",
    tagline: "Your care, your way.",
    description:
      "Check in, track your goals, and stay connected with your therapist \u2014 privately and securely.",
    cta: "Start patient tour",
    accent: "#38bdf8",
    accentRgb: "56,189,248",
    minHeight: 140,
    indent: 144,
  },
];

function readTourComplete(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem("empathai_tour_complete") === "1"; } catch { return false; }
}

// ── Silent auth helpers ──────────────────────────────────────────────────────

function authAsTherapist() {
  enableDemoMode();
  setRole("therapist");
  localStorage.setItem("selected_persona", "therapist");
  localStorage.setItem("selected_therapist_id", DEMO_CONFIG.therapistId);
}

function authAsPatient() {
  enableDemoMode();
  setRole("patient");
  localStorage.setItem("selected_persona", "patient");
  // Set portal session (demo mode — empty token)
  localStorage.setItem("portal_token", "");
  localStorage.setItem("portal_case_code", "demo-case-02");
  localStorage.setItem("portal_label", "Jordan");
  localStorage.setItem("patient_case_id", "demo-case-02");
  localStorage.setItem("patient_name", "Jordan");
  localStorage.setItem("patient_id", "demo-patient-02");
}

function authAsManager() {
  enableDemoMode();
  setRole("manager");
  localStorage.setItem("selected_persona", "manager");
  localStorage.setItem("selected_manager_mode", "multi");
  document.cookie = "empathAI_role=admin; path=/; SameSite=Lax; max-age=3600";
  sessionStorage.setItem("empathAI_selected_role", "manager");
}

function authAsPracticeOwner() {
  enableDemoMode();
  setRole("manager");
  localStorage.setItem("selected_persona", "manager");
  localStorage.setItem("selected_manager_mode", "single");
  localStorage.setItem("selected_practice_id", DEMO_CONFIG.practiceId);
  document.cookie = "empathAI_role=admin; path=/; SameSite=Lax; max-age=3600";
  sessionStorage.setItem("empathAI_selected_role", "manager");
}

const AUTH_FNS: Record<DemoPersona, () => void> = {
  therapist: authAsTherapist,
  patient: authAsPatient,
  manager: authAsManager,
  practice_owner: authAsPracticeOwner,
};

export default function DemoPage() {
  const router = useRouter();
  const [tourComplete, setTourComplete] = useState(readTourComplete);
  const [loadingPersona, setLoadingPersona] = useState<DemoPersona | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On mount: clear any lingering tour state/overlays from prior sessions
  useEffect(() => {
    clearTourState();
    try { sessionStorage.removeItem("demoTourActive"); } catch {}
    // Remove any lingering overlay elements from the DOM
    document.querySelectorAll("[data-demo-overlay]").forEach(el => el.remove());
  }, []);

  function startTour(persona: DemoPersona) {
    setLoadingPersona(persona);
    setError(null);

    try {
      // Silent auth
      AUTH_FNS[persona]();

      // Initialize tour state
      const tour = TOUR_SCRIPTS[persona];
      writeTourState({
        persona,
        step: 0,
        startedAt: new Date().toISOString(),
      });

      try {
        sessionStorage.removeItem("empathai_tour_complete");
        sessionStorage.setItem("demoTourActive", "1");
      } catch {}

      // Short delay for visual feedback
      setTimeout(() => {
        router.push(tour.steps[0].page);
      }, 400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start tour");
      setLoadingPersona(null);
    }
  }

  function dismissComplete() {
    try { sessionStorage.removeItem("empathai_tour_complete"); } catch {}
    setTourComplete(false);
  }

  // ── Tour complete state ──
  if (tourComplete) {
    return (
      <>
        <style>{`          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #080c12; }
          @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
          @keyframes scaleIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
        `}</style>
        <div style={{
          minHeight: "100vh", background: "#080c12",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 24px", fontFamily: "'DM Sans', system-ui",
        }}>
          <div style={{ maxWidth: 520, width: "100%", textAlign: "center", animation: "scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{
              borderRadius: 20, border: "1px solid rgba(74,222,128,0.2)",
              background: "radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.06) 0%, transparent 60%), rgba(255,255,255,0.02)",
              padding: "48px 36px 40px",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(74,222,128,0.12)", border: "2px solid rgba(74,222,128,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px", fontSize: 32, color: "#4ade80",
                animation: "fadeUp 0.4s 0.1s cubic-bezier(0.16,1,0.3,1) both",
              }}>&#10003;</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, color: "rgba(255,255,255,0.95)", fontFamily: "'Sora', system-ui", marginBottom: 12, animation: "fadeUp 0.4s 0.15s cubic-bezier(0.16,1,0.3,1) both" }}>
                You&apos;ve seen EmpathAI in action
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 28, animation: "fadeUp 0.4s 0.2s cubic-bezier(0.16,1,0.3,1) both" }}>
                From a manager&apos;s Monday briefing to a patient&apos;s 60-second check-in &mdash; every signal connected, every action tracked.
              </p>
              <div style={{ display: "grid", gap: 12, textAlign: "left", marginBottom: 32, animation: "fadeUp 0.4s 0.25s cubic-bezier(0.16,1,0.3,1) both" }}>
                {[
                  { icon: "\u2B21", color: "#00c8a0", text: "Practice-wide visibility into every case, every risk signal" },
                  { icon: "\u2726", color: "#f5a623", text: "AI-powered session prep and task generation \u2014 zero manual work" },
                  { icon: "\u2661", color: "#38bdf8", text: "Patient check-ins that take 60 seconds, no app required" },
                ].map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <span style={{ fontSize: 16, color: v.color, flexShrink: 0, marginTop: 1 }}>{v.icon}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{v.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animation: "fadeUp 0.4s 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
                <a href="mailto:hello@empathai.care" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 28px", borderRadius: 12, background: "#4ade80", border: "1px solid #4ade80", color: "#080c12", fontSize: 14, fontWeight: 800, textDecoration: "none", fontFamily: "'Sora', system-ui", letterSpacing: -0.2, cursor: "pointer" }}>
                  Get in touch &#8594;
                </a>
                <button type="button" onClick={dismissComplete} style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', system-ui", letterSpacing: -0.2 }}>
                  Back to demo
                </button>
              </div>
            </div>
            <div style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", animation: "fadeUp 0.4s 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>
              hello@empathai.care &middot; We&apos;re onboarding pilot practices now
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main demo page ──
  return (
    <>
      <style>{`        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c12; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes headerReveal { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes cardPulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        .demo-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-left-color 0.2s ease;
          border-left: 2px solid transparent;
        }
        .demo-card:hover:not(.demo-card-loading) {
          transform: translateX(4px);
          border-left-color: var(--card-accent) !important;
        }
        .demo-card:active:not(.demo-card-loading) { transform: translateX(2px); }
        .demo-card-loading { pointer-events: none; animation: cardPulse 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .demo-card-loading { animation: none; opacity: 0.6; }
        }
        /* Tablet: halve indentation */
        @media (max-width: 1023px) and (min-width: 640px) {
          .cascade-card { --indent-scale: 0.5; }
        }
        /* Mobile: no indentation */
        @media (max-width: 639px) {
          .cascade-card { --indent-scale: 0; }
          .cascade-connector { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080c12", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Header */}
        <header style={{ width: "100%", maxWidth: 960, padding: "48px 24px 0", textAlign: "center", animation: "headerReveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7c5cfc, #00c8a0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: "white", boxShadow: "0 0 20px rgba(124,92,252,0.35)", fontFamily: "'Sora', system-ui" }}>
              {"\u2B21"}
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, color: "rgba(255,255,255,0.95)", fontFamily: "'Sora', system-ui" }}>EmpathAI</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "#94a3b8", fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>
            LIVE DEMO
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.15, color: "rgba(255,255,255,0.97)", fontFamily: "'Sora', system-ui", maxWidth: 600, margin: "0 auto" }}>
            See EmpathAI{" "}
            <span style={{ background: "linear-gradient(135deg, #7c5cfc 20%, #00c8a0 80%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>in action</span>
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "12px auto 0", lineHeight: 1.6 }}>
            Explore any perspective &mdash; all data is synthetic.
          </p>
        </header>

        {/* Persona cards */}
        <section style={{ width: "100%", maxWidth: 960, padding: "40px 24px 0" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", marginBottom: 16, textAlign: "center" }}>
            EXPLORE BY ROLE
          </div>

          {error && (
            <div style={{ maxWidth: 480, margin: "0 auto 16px", padding: "10px 16px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", fontSize: 13, textAlign: "center" }}>
              {error}
            </div>
          )}

          <div style={{ position: "relative" }}>
            {/* Vertical connector line */}
            <div
              className="cascade-connector"
              style={{
                position: "absolute",
                left: 24,
                top: 0,
                bottom: 0,
                width: 1,
                background: "#1a2035",
                pointerEvents: "none",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {PERSONAS.map((p, i) => {
                const isLoading = loadingPersona === p.id;
                return (
                  <div
                    key={p.id}
                    className="cascade-card"
                    style={{
                      // Use CSS custom property for responsive indent scaling
                      ["--indent-scale" as string]: 1,
                      marginLeft: `calc(${p.indent}px * var(--indent-scale))`,
                      maxWidth: `calc(100% - ${p.indent}px * var(--indent-scale))`,
                      position: "relative",
                    }}
                  >
                    {/* Horizontal tick connector */}
                    {p.indent > 0 && (
                      <div
                        className="cascade-connector"
                        style={{
                          position: "absolute",
                          left: `calc(-${p.indent}px * var(--indent-scale) + 24px)`,
                          top: 24,
                          width: `calc(${p.indent}px * var(--indent-scale) - 24px)`,
                          height: 1,
                          background: "#1a2035",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    <button
                      type="button"
                      className={`demo-card${isLoading ? " demo-card-loading" : ""}`}
                      onClick={() => startTour(p.id)}
                      disabled={loadingPersona !== null}
                      style={{
                        ["--card-accent" as string]: p.accent,
                        textAlign: "left",
                        width: "100%",
                        border: `1px solid #1a2035`,
                        background: `radial-gradient(ellipse at 30% 0%, rgba(${p.accentRgb}, 0.06) 0%, transparent 70%), #0d1018`,
                        borderRadius: 18,
                        padding: "24px 22px",
                        minHeight: p.minHeight,
                        cursor: loadingPersona ? "not-allowed" : "pointer",
                        color: "inherit",
                        fontFamily: "inherit",
                        animation: `fadeUp 0.5s ${i * 100}ms cubic-bezier(0.16,1,0.3,1) both`,
                        display: "flex",
                        flexDirection: "column",
                        opacity: loadingPersona && !isLoading ? 0.4 : 1,
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: `rgba(${p.accentRgb}, 0.12)`, border: `1px solid rgba(${p.accentRgb}, 0.2)`, color: p.accent, marginBottom: 16 }}>
                        {p.icon}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: p.eyebrowColor, fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: "rgba(255,255,255,0.95)", fontFamily: "'Sora', system-ui", lineHeight: 1.2, marginBottom: 8 }}>
                        {p.tagline}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.5)", marginBottom: 20, flex: 1 }}>
                        {p.description}
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: p.accent, fontFamily: "'Sora', system-ui" }}>
                        {isLoading ? (
                          <>
                            <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${p.accent}`, borderTopColor: "transparent", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
                            Loading...
                          </>
                        ) : (
                          <>{p.cta} {"\u2192"}</>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ width: "100%", maxWidth: 960, padding: "56px 24px 48px", textAlign: "center", animation: "fadeUp 0.5s 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div style={{ borderRadius: 18, border: "1px solid rgba(124,92,252,0.15)", background: "radial-gradient(ellipse at 50% 0%, rgba(124,92,252,0.06) 0%, transparent 70%), rgba(255,255,255,0.02)", padding: "40px 32px" }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, color: "rgba(255,255,255,0.9)", fontFamily: "'Sora', system-ui", marginBottom: 8 }}>
              Interested in EmpathAI?
            </h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 24, lineHeight: 1.5 }}>
              We&apos;re onboarding pilot practices now.
            </p>
            <a href="mailto:hello@empathai.care" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(124,92,252,0.35)", background: "linear-gradient(135deg, rgba(124,92,252,0.18), rgba(124,92,252,0.06))", color: "white", fontSize: 14, fontWeight: 800, textDecoration: "none", fontFamily: "'Sora', system-ui", letterSpacing: -0.2, cursor: "pointer" }}>
              Request a pilot {"\u2192"}
            </a>
          </div>
          <div style={{ marginTop: 32, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace" }}>
            EmpathAI &middot; AI-powered therapy practice management
          </div>
        </footer>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
