"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_CONFIG } from "@/lib/demo/demoMode";
import { TOUR_STEPS, TOUR_SS_KEY } from "@/lib/demo/tourSteps";

// ── Persona cards ────────────────────────────────────────────────────────────
const PERSONAS = [
  {
    id: "manager",
    label: "Practice Manager",
    icon: "\u2B21",
    tagline: "Your whole practice, one view",
    description:
      "See every therapist, every case, every risk signal \u2014 and act before small problems become big ones.",
    accent: "#00c8a0",
    accentRgb: "0,200,160",
    href: `/admin/status?demo=true&practice_id=${DEMO_CONFIG.practiceId}`,
  },
  {
    id: "therapist",
    label: "Therapist",
    icon: "\u25CE",
    tagline: "Know your patients. Really know them.",
    description:
      "Walk into every session prepared. Surface the patients who need you most before they slip through the cracks.",
    accent: "#7c5cfc",
    accentRgb: "124,92,252",
    href: `/dashboard/therapists/${DEMO_CONFIG.therapistId}/care?demo=true`,
  },
  {
    id: "patient",
    label: "Patient",
    icon: "\u2661",
    tagline: "Your care, your way.",
    description:
      "Check in with how you\u2019re feeling, review session notes, track goals, and stay connected with your therapist.",
    accent: "#38bdf8",
    accentRgb: "56,189,248",
    href: "/portal/checkin?demo=true",
  },
];

function readTourComplete(): boolean {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem("empathai_tour_complete") === "1"; } catch { return false; }
}

export default function DemoPage() {
  const router = useRouter();
  const [tourComplete, setTourComplete] = useState(readTourComplete);

  function startTour() {
    const first = TOUR_STEPS[0];
    try {
      sessionStorage.setItem(TOUR_SS_KEY, "1");
      sessionStorage.removeItem("empathai_tour_complete");
    } catch {}
    setTourComplete(false);
    router.push(first.href);
  }

  function dismissComplete() {
    try { sessionStorage.removeItem("empathai_tour_complete"); } catch {}
    setTourComplete(false);
  }

  if (tourComplete) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600;700&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #080810; }
          @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
          @keyframes scaleIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
        `}</style>
        <div style={{
          minHeight: "100vh",
          background: "#080810",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          fontFamily: "'DM Sans', system-ui",
        }}>
          <div style={{
            maxWidth: 520,
            width: "100%",
            textAlign: "center",
            animation: "scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            <div style={{
              borderRadius: 20,
              border: "1px solid rgba(74,222,128,0.2)",
              background: "radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.06) 0%, transparent 60%), rgba(255,255,255,0.02)",
              padding: "48px 36px 40px",
            }}>
              {/* Green checkmark */}
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(74,222,128,0.12)",
                border: "2px solid rgba(74,222,128,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                fontSize: 32,
                color: "#4ade80",
                animation: "fadeUp 0.4s 0.1s cubic-bezier(0.16,1,0.3,1) both",
              }}>
                &#10003;
              </div>

              <h1 style={{
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: -0.8,
                color: "rgba(255,255,255,0.95)",
                fontFamily: "'Sora', system-ui",
                marginBottom: 12,
                animation: "fadeUp 0.4s 0.15s cubic-bezier(0.16,1,0.3,1) both",
              }}>
                You&apos;ve seen EmpathAI in action
              </h1>

              <p style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.6,
                marginBottom: 28,
                animation: "fadeUp 0.4s 0.2s cubic-bezier(0.16,1,0.3,1) both",
              }}>
                From a manager&apos;s Monday briefing to a patient&apos;s 60-second check-in &mdash; every signal connected, every action tracked.
              </p>

              {/* Value props */}
              <div style={{
                display: "grid",
                gap: 12,
                textAlign: "left",
                marginBottom: 32,
                animation: "fadeUp 0.4s 0.25s cubic-bezier(0.16,1,0.3,1) both",
              }}>
                {[
                  { icon: "\u2B21", color: "#00c8a0", text: "Practice-wide visibility into every case, every risk signal" },
                  { icon: "\u2726", color: "#f5a623", text: "AI-powered session prep and task generation — zero manual work" },
                  { icon: "\u2661", color: "#38bdf8", text: "Patient check-ins that take 60 seconds, no app required" },
                ].map((v, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}>
                    <span style={{ fontSize: 16, color: v.color, flexShrink: 0, marginTop: 1 }}>{v.icon}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{v.text}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
                animation: "fadeUp 0.4s 0.3s cubic-bezier(0.16,1,0.3,1) both",
              }}>
                <a
                  href="mailto:hello@empathai.care"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 28px",
                    borderRadius: 12,
                    background: "#4ade80",
                    border: "1px solid #4ade80",
                    color: "#080810",
                    fontSize: 14,
                    fontWeight: 800,
                    textDecoration: "none",
                    fontFamily: "'Sora', system-ui",
                    letterSpacing: -0.2,
                    cursor: "pointer",
                  }}
                >
                  Get in touch &#8594;
                </a>
                <button
                  type="button"
                  onClick={dismissComplete}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Sora', system-ui",
                    letterSpacing: -0.2,
                  }}
                >
                  Back to demo
                </button>
              </div>
            </div>

            {/* Contact info */}
            <div style={{
              marginTop: 24,
              fontSize: 12,
              color: "rgba(255,255,255,0.25)",
              fontFamily: "'DM Mono', monospace",
              animation: "fadeUp 0.4s 0.35s cubic-bezier(0.16,1,0.3,1) both",
            }}>
              hello@empathai.care &middot; We&apos;re onboarding pilot practices now
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080810; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes headerReveal { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        .demo-card:hover { transform: translateY(-4px) scale(1.01); box-shadow: 0 16px 48px rgba(0,0,0,0.5); }
        .demo-card:active { transform: scale(0.98); }
        .start-tour-btn:hover { box-shadow: 0 0 24px rgba(74,222,128,0.25); filter: brightness(1.1); }
        @media (max-width: 700px) {
          .persona-row { flex-direction: column !important; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#080810",
          color: "#e2e8f0",
          fontFamily: "'DM Sans', system-ui",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* ── Header ── */}
        <header
          style={{
            width: "100%",
            maxWidth: 960,
            padding: "48px 24px 0",
            textAlign: "center",
            animation: "headerReveal 0.6s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #7c5cfc, #00c8a0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
                fontWeight: 900,
                color: "white",
                boxShadow: "0 0 20px rgba(124,92,252,0.35)",
                fontFamily: "'Sora', system-ui",
              }}
            >
              {"\u2B21"}
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: -0.4,
                color: "rgba(255,255,255,0.95)",
                fontFamily: "'Sora', system-ui",
              }}
            >
              EmpathAI
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(24px, 3.5vw, 40px)",
              fontWeight: 900,
              letterSpacing: -1.2,
              lineHeight: 1.15,
              color: "rgba(255,255,255,0.97)",
              fontFamily: "'Sora', system-ui",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            See EmpathAI{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, #7c5cfc 20%, #00c8a0 80%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              in action
            </span>
          </h1>

          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              color: "rgba(255,255,255,0.45)",
              maxWidth: 520,
              margin: "12px auto 0",
              lineHeight: 1.6,
            }}
          >
            AI-powered therapy practice management. Surface at-risk cases early,
            automate session prep, and keep every practice running at its best.
          </p>

          {/* Synthetic data disclaimer */}
          <div
            style={{
              marginTop: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 14px",
              borderRadius: 999,
              border: "1px solid rgba(245,166,35,0.25)",
              background: "rgba(245,166,35,0.06)",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(245,166,35,0.8)",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: 0.3,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#f5a623",
                flexShrink: 0,
              }}
            />
            All data shown is synthetic — no real patient information
          </div>
        </header>

        {/* ── Section 1: Persona cards ── */}
        <section
          style={{
            width: "100%",
            maxWidth: 960,
            padding: "40px 24px 0",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'DM Mono', monospace",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Choose a perspective
          </div>

          <div
            className="persona-row"
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
            }}
          >
            {PERSONAS.map((p, i) => (
              <a
                key={p.id}
                href={p.href}
                className="demo-card"
                style={{
                  flex: "1 1 0",
                  maxWidth: 300,
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: 18,
                  padding: "24px 22px",
                  border: `1.5px solid rgba(${p.accentRgb}, 0.15)`,
                  background: `radial-gradient(ellipse at 30% 0%, rgba(${p.accentRgb}, 0.08) 0%, transparent 70%), rgba(255,255,255,0.02)`,
                  cursor: "pointer",
                  transition:
                    "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease",
                  animation: `fadeUp 0.5s ${i * 100}ms cubic-bezier(0.16,1,0.3,1) both`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    background: `rgba(${p.accentRgb}, 0.12)`,
                    border: `1px solid rgba(${p.accentRgb}, 0.2)`,
                    color: p.accent,
                    marginBottom: 16,
                  }}
                >
                  {p.icon}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.6,
                    textTransform: "uppercase",
                    color: p.accent,
                    fontFamily: "'DM Mono', monospace",
                    marginBottom: 6,
                  }}
                >
                  {p.label}
                </div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    letterSpacing: -0.4,
                    color: "rgba(255,255,255,0.95)",
                    fontFamily: "'Sora', system-ui",
                    lineHeight: 1.2,
                    marginBottom: 8,
                  }}
                >
                  {p.tagline}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 20,
                    flex: 1,
                  }}
                >
                  {p.description}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 800,
                    color: p.accent,
                    fontFamily: "'Sora', system-ui",
                  }}
                >
                  Open {p.label.toLowerCase()} view
                  <span style={{ fontSize: 15 }}>{"\u2192"}</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ── Section 2: Guided Tour ── */}
        <section
          style={{
            width: "100%",
            maxWidth: 960,
            padding: "48px 24px 0",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 24,
              animation: "fadeUp 0.5s 0.3s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'DM Mono', monospace",
                marginBottom: 8,
              }}
            >
              Guided Tour
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: -0.5,
                color: "rgba(255,255,255,0.9)",
                fontFamily: "'Sora', system-ui",
              }}
            >
              Monday morning at a therapy practice
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                marginTop: 6,
                marginBottom: 20,
              }}
            >
              Follow a real workflow from check-in to action — 5 steps, 3
              minutes.
            </p>

            {/* Start tour CTA */}
            <button
              type="button"
              className="start-tour-btn"
              onClick={startTour}
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#080810",
                background: "#4ade80",
                border: "1px solid #4ade80",
                borderRadius: 12,
                padding: "12px 32px",
                cursor: "pointer",
                fontFamily: "'Sora', system-ui",
                letterSpacing: -0.2,
                transition: "all 0.2s ease",
              }}
            >
              Start guided tour {"\u2192"}
            </button>
          </div>

          {/* Step list (informational) */}
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              overflow: "hidden",
              animation: "fadeUp 0.5s 0.4s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            {TOUR_STEPS.map((s, idx) => (
              <div
                key={s.step}
                style={{
                  padding: "16px 22px",
                  borderBottom:
                    idx < TOUR_STEPS.length - 1
                      ? "1px solid rgba(255,255,255,0.05)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    background: `rgba(${s.colorRgb}, 0.12)`,
                    border: `1px solid rgba(${s.colorRgb}, 0.2)`,
                    color: s.color,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: s.color,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      Step {s.step}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.25)",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {s.role}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 2,
                      letterSpacing: -0.2,
                    }}
                  >
                    {s.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer: Waitlist CTA ── */}
        <footer
          style={{
            width: "100%",
            maxWidth: 960,
            padding: "56px 24px 48px",
            textAlign: "center",
            animation: "fadeUp 0.5s 0.5s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(124,92,252,0.15)",
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(124,92,252,0.06) 0%, transparent 70%), rgba(255,255,255,0.02)",
              padding: "40px 32px",
            }}
          >
            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: -0.4,
                color: "rgba(255,255,255,0.9)",
                fontFamily: "'Sora', system-ui",
                marginBottom: 8,
              }}
            >
              Interested in EmpathAI?
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.45)",
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              We&apos;re onboarding pilot practices now. Get in touch to learn
              more.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <a
                href="mailto:hello@empathai.care"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 24px",
                  borderRadius: 12,
                  border: "1px solid rgba(124,92,252,0.35)",
                  background:
                    "linear-gradient(135deg, rgba(124,92,252,0.18), rgba(124,92,252,0.06))",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                  fontFamily: "'Sora', system-ui",
                  letterSpacing: -0.2,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Get in touch {"\u2192"}
              </a>
            </div>
          </div>

          <div
            style={{
              marginTop: 32,
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            EmpathAI · AI-powered therapy practice management
          </div>
        </footer>
      </div>
    </>
  );
}
