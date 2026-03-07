/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setRole } from "@/lib/roleContext";

// ── Data ──────────────────────────────────────────────────────────────────────
type Practice = { id: string; name: string | null };
type Therapist = { id: string; name: string; practice_id: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json as any)?.error) throw new Error((json as any)?.error?.message ?? JSON.stringify(json));
  return ((json as any)?.data ?? json) as T;
}

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(s: string) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}

// ── Personas ──────────────────────────────────────────────────────────────────
const PERSONAS = [
  {
    id: "manager",
    label: "Practice Manager",
    descriptor: "Practice health & reporting",
    icon: "⬡",
    tagline: "Your whole practice, one view",
    description: "Stop flying blind. See every therapist, every case, every risk signal — and act before small problems become big ones.",
    accent: "#00c8a0",
    accentRgb: "0,200,160",
    highlights: ["Live roster overview", "Utilization & capacity", "Multi-therapist signals"],
    cta: "Launch my dashboard",
  },
  {
    id: "therapist",
    label: "Therapist",
    descriptor: "Cases, sessions & clinical tools",
    icon: "◎",
    tagline: "Know your patients. Really know them.",
    description: "Walk into every session prepared. Surface the patients who need you most before they slip through the cracks.",
    accent: "#7c5cfc",
    accentRgb: "124,92,252",
    highlights: ["Weekly engagement signals", "AI session prep notes", "Risk & alert flags"],
    cta: "Open my caseload",
  },
  {
    id: "patient",
    label: "Patient",
    descriptor: "Your care portal",
    icon: "♡",
    tagline: "Your care, your way.",
    description: "Check in with how you're feeling, review notes from your sessions, track your goals, and stay connected with your therapist.",
    accent: "#38bdf8",
    accentRgb: "56,189,248",
    highlights: ["Daily check-ins", "Session notes", "Treatment goals"],
    cta: "Open my portal",
  },
  {
    id: "admin",
    label: "Admin",
    descriptor: "Full system access",
    icon: "⬢",
    tagline: "Total system control",
    description: "Configure practices, manage your therapist roster, and keep patient assignments clean — all from one place.",
    accent: "#e879f9",
    accentRgb: "232,121,249",
    highlights: ["Practice configuration", "Therapist management", "Patient administration"],
    cta: "Open admin console",
  },
  {
    id: "analytics",
    label: "Analytics",
    descriptor: "Data insights & benchmarks",
    icon: "◈",
    tagline: "Signal, not noise",
    description: "Real-time signal intelligence across your practice — health scores, risk patterns, utilization, and benchmarks.",
    accent: "#f5a623",
    accentRgb: "245,166,35",
    highlights: ["Practice health scores", "At-risk trend patterns", "Engagement benchmarks"],
    cta: "Open analytics",
  },
];
type Persona = typeof PERSONAS[number];

// ── Noise ─────────────────────────────────────────────────────────────────────
function Noise() {
  return (
    <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, opacity: 0.028 }} xmlns="http://www.w3.org/2000/svg">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  );
}

// ── PersonaCard ───────────────────────────────────────────────────────────────
function PersonaCard({ persona, index, selected, onSelect }: {
  persona: Persona;
  index: number;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const isSelected = selected === persona.id;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      ref={ref}
      className={`persona-card-wrap${isSelected ? ' persona-card-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Sign in as ${persona.label}`}
      onClick={() => onSelect(persona.id)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(persona.id); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); const next = (e.currentTarget.nextElementSibling as HTMLElement); if (next) next.focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const prev = (e.currentTarget.previousElementSibling as HTMLElement); if (prev) prev.focus(); }
      }}
      style={{
        "--accent": persona.accent,
        "--accent-rgb": persona.accentRgb,
        "--mx": "50%", "--my": "50%",
        position: "relative",
        borderRadius: 20,
        padding: 22,
        cursor: "pointer",
        transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease",
        transform: isSelected ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)",
        border: isSelected
          ? `1.5px solid color-mix(in srgb, ${persona.accent} 60%, transparent)`
          : "1.5px solid rgba(255,255,255,0.08)",
        background: isSelected
          ? `radial-gradient(circle at var(--mx) var(--my), rgba(var(--accent-rgb),0.12) 0%, rgba(0,0,0,0) 70%), rgba(255,255,255,0.04)`
          : `radial-gradient(circle at var(--mx) var(--my), rgba(var(--accent-rgb),0.06) 0%, rgba(0,0,0,0) 60%), rgba(255,255,255,0.02)`,
        boxShadow: isSelected
          ? undefined
          : "0 4px 24px rgba(0,0,0,0.3)",
        ...(isSelected
          ? {}
          : {
              animationDelay: `${index * 120}ms`,
              animationName: "fadeSlideUp",
              animationDuration: "0.6s",
              animationFillMode: "both",
              animationTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
            }),
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
      } as React.CSSProperties}
    >
      {/* Pulse ring overlay */}
      {isSelected && (
        <span
          style={{
            position: "absolute",
            inset: -1,
            borderRadius: 20,
            border: `2px solid ${persona.accent}`,
            opacity: 0,
            animation: "pulseRing 1.8s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
          background: `rgba(var(--accent-rgb), 0.12)`,
          border: `1px solid rgba(var(--accent-rgb), 0.2)`,
          color: persona.accent,
          transition: "transform 0.2s ease",
          transform: isSelected ? "rotate(-8deg) scale(1.1)" : "none",
        }}>
          {persona.icon}
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: isSelected ? persona.accent : "rgba(255,255,255,0.2)",
          boxShadow: isSelected ? `0 0 10px ${persona.accent}` : "none",
          transition: "all 0.3s ease", marginTop: 6,
        }} />
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: persona.accent, opacity: 0.9, fontFamily: "'DM Mono', 'Fira Mono', monospace" }}>
          {persona.label}
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: "#94a3b8", fontFamily: "'DM Sans', system-ui", fontWeight: 400 }}>
          {persona.descriptor}
        </div>
        <div style={{ marginTop: 6, fontSize: 19, fontWeight: 900, letterSpacing: -0.6, color: "rgba(255,255,255,0.97)", lineHeight: 1.15, fontFamily: "'Sora', 'DM Sans', system-ui" }}>
          {persona.tagline}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.62)", fontFamily: "'DM Sans', system-ui" }}>
          {persona.description}
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 5 }}>
        {persona.highlights.map((h) => (
          <span key={h} style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
            background: `rgba(var(--accent-rgb), 0.1)`,
            border: `1px solid rgba(var(--accent-rgb), 0.18)`,
            color: `rgba(var(--accent-rgb), 1)`,
            fontFamily: "'DM Mono', monospace",
            width: "fit-content",
          }}>{h}</span>
        ))}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 22 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 14, fontWeight: 800,
          color: isSelected ? persona.accent : "rgba(255,255,255,0.5)",
          transition: "color 0.25s ease", fontFamily: "'Sora', system-ui",
          letterSpacing: -0.2,
        }}>
          {persona.cta}
          <span style={{ display: "inline-block", transition: "transform 0.25s ease", transform: isSelected ? "translateX(5px)" : "none", fontSize: 16 }}>→</span>
        </div>
      </div>
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────
export default function DemoLanding() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const [managerMode, setManagerMode] = useState<"multi" | "single">("multi");
  const ctaRef = useRef<HTMLDivElement>(null);

  // Practice picker state (manager single-practice mode)
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practicesLoading, setPracticesLoading] = useState(false);

  const weekStart = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);

  // Scroll CTA into view when a persona is selected
  useEffect(() => {
    if (selected) {
      // Wait a tick for the action bar to render
      requestAnimationFrame(() => {
        ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [selected]);

  // Filter practices for demo modes
  const harperPractice = practices.find(p => p.name?.toLowerCase().includes("harper"));

  // Fetch practices as soon as manager + single is selected (to auto-resolve Harper)
  useEffect(() => {
    if (selected !== "manager" || managerMode !== "single" || practices.length > 0) return;
    setPracticesLoading(true);
    fetchJson<Practice[]>("/api/practices")
      .then((data) => setPractices(data ?? []))
      .catch(() => {})
      .finally(() => setPracticesLoading(false));
  }, [selected, managerMode, practices.length]);

  function storeRole(role: "therapist" | "manager" | "patient") {
    setRole(role);
    // Backward compat: keep localStorage keys until all consumers migrate to getRole()
    try { localStorage.setItem("user_role", role); } catch {}
    try { localStorage.setItem("selected_persona", role); } catch {}
  }

  function launchRole(id: string) {
    if (id === "patient") {
      storeRole("patient");
      setLaunched(true);
      setTimeout(() => router.push("/portal/onboarding"), 300);
    } else if (id === "admin") {
      // Set admin role in cookie + storage BEFORE navigating.
      // We cannot use setRole() because it rejects "admin" (JWT-only by design),
      // so we write the cookie and storage directly for demo mode.
      document.cookie = "empathAI_role=admin; path=/; max-age=3600";
      try { sessionStorage.setItem("empathAI_selected_role", "admin"); } catch {}
      try { localStorage.setItem("selected_persona", "admin"); } catch {}

      // Verify the cookie was actually written before navigating
      const verify = document.cookie
        .split("; ")
        .find(r => r.startsWith("empathAI_role="));
      console.log("[admin] cookie verified:", verify);

      setLaunched(true);
      if (verify) {
        router.push("/admin");
      } else {
        // cookie failed to write — retry once
        setTimeout(() => router.push("/admin"), 100);
      }
    } else if (id === "therapist") {
      storeRole("therapist");
      setLaunched(true);
      fetch("/api/therapists", { cache: "no-store" })
        .then((res) => res.json())
        .then((json) => {
          const list: Therapist[] = Array.isArray(json?.data) ? json.data : [];
          if (list.length > 0) {
            const t = list[Math.floor(Math.random() * list.length)];
            try { localStorage.setItem("selected_practice_id", t.practice_id); } catch {}
            try { localStorage.setItem("selected_therapist_id", t.id); } catch {}
            router.push(`/dashboard/therapists/${encodeURIComponent(t.id)}/care?week_start=${encodeURIComponent(weekStart)}`);
          } else {
            setLaunched(false); setSelected(null);
          }
        })
        .catch(() => { setLaunched(false); setSelected(null); });
    } else if (id === "manager") {
      if (managerMode === "single" && harperPractice) {
        storeRole("manager");
        try { localStorage.setItem("selected_manager_mode", "single"); } catch {}
        try { localStorage.setItem("selected_practice_id", harperPractice.id); } catch {}
        setLaunched(true);
        setTimeout(() => router.push(`/admin/status?practice_id=${encodeURIComponent(harperPractice.id)}`), 300);
      } else {
        storeRole("manager");
        try { localStorage.setItem("selected_manager_mode", "multi"); } catch {}
        setLaunched(true);
        setTimeout(() => router.push("/admin/status"), 300);
      }
    }
  }

  function handlePersonaSelect(id: string) {
    if (id === "analytics") {
      if (selected === id) {
        setLaunched(true);
        setTimeout(() => router.push("/analytics"), 300);
      } else {
        setSelected(id);
      }
      return;
    }
    // If already selected, treat second click as launch
    if (selected === id) {
      launchRole(id);
      return;
    }
    // First click: just select (show description + action bar)
    setSelected(id);
  }

  function handleLaunch() {
    if (!selected) return;
    if (selected === "analytics") {
      setLaunched(true);
      setTimeout(() => router.push("/analytics"), 300);
      return;
    }
    launchRole(selected);
  }

  const selectedPersona = PERSONAS.find((p) => p.id === selected);
  const showActionBar = !!selected;
  const canLaunch = showActionBar && (
    selected !== "manager" || managerMode === "multi" || (managerMode === "single" && !!harperPractice)
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes headerReveal {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes orb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.08); } }
        @keyframes orb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,40px) scale(1.05); } }
        @keyframes orb3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,50px) scale(1.1); } }
        @keyframes pulseRing { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.04); opacity: 0; } }
        @keyframes launchPulse { 0% { transform: scale(1); } 50% { transform: scale(0.96); } 100% { transform: scale(1); } }
        .persona-card-wrap:active { transform: scale(0.97) !important; }
        .persona-card-wrap:focus-visible {
          outline: 2px solid #6b82d4;
          outline-offset: 3px;
        }
        .persona-card-wrap:not(.persona-card-selected):hover {
          box-shadow: 0 0 0 1.5px #6b82d4, 0 4px 24px rgba(107,130,212,0.15) !important;
          transition: all 200ms ease !important;
        }
        @keyframes accentPulse {
          0%, 100% { box-shadow: 0 0 0 1.5px rgba(var(--accent-rgb),0.35), 0 0 20px rgba(var(--accent-rgb),0.08); }
          50% { box-shadow: 0 0 0 2px rgba(var(--accent-rgb),0.7), 0 0 30px rgba(var(--accent-rgb),0.18); }
        }
        .persona-card-selected {
          animation: accentPulse 2s ease-in-out infinite !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .persona-card-selected {
            animation: none !important;
            box-shadow: 0 0 0 2px rgba(var(--accent-rgb),0.5), 0 0 20px rgba(var(--accent-rgb),0.12) !important;
          }
        }
        @media (max-width: 640px) {
          .hero-h1 { letter-spacing: -0.8px !important; }
          .hero-section-gap { margin-top: 24px !important; }
          .action-bar { flex-direction: column !important; align-items: stretch !important; }
          .action-bar-launch { width: 100% !important; justify-content: center !important; }
          .persona-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .demo-steps-grid { grid-template-columns: 1fr !important; }
          .demo-step-cell { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .demo-header-hint { display: none; }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .persona-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .demo-steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "#080c12", color: "white",
        fontFamily: "'DM Sans', system-ui", position: "relative", overflow: "auto",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "32px 24px",
      }}>
        <Noise />

        {/* Ambient orbs */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,92,252,0.18) 0%, transparent 65%)", top: "-15%", left: "-10%", animation: "orb1 18s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,160,0.12) 0%, transparent 65%)", bottom: "-10%", right: "5%", animation: "orb2 22s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.10) 0%, transparent 65%)", top: "40%", right: "20%", animation: "orb3 16s ease-in-out infinite" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1320, display: "flex", flexDirection: "column" }}>

          {/* Hero */}
          <div style={{ textAlign: "center", animation: "headerReveal 0.7s cubic-bezier(0.16,1,0.3,1) both" }}>

            {/* Wordmark */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: "linear-gradient(135deg, #7c5cfc, #00c8a0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, color: "white",
                boxShadow: "0 0 24px rgba(124,92,252,0.4)",
                fontFamily: "'Sora', system-ui",
              }}>⬡</div>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "rgba(255,255,255,0.95)", fontFamily: "'Sora', system-ui" }}>
                EmpathAI
              </span>
            </div>

            {/* Main headline */}
            <h1 className="hero-h1" style={{ fontSize: "clamp(26px, 3.5vw, 44px)", fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.1, color: "rgba(255,255,255,0.97)", fontFamily: "'Sora', system-ui", maxWidth: 680, margin: "0 auto" }}>
              AI-powered therapy{" "}
              <span style={{ background: "linear-gradient(135deg, #7c5cfc 20%, #00c8a0 80%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                practice management
              </span>
            </h1>

            {/* Sub-headline */}
            <p style={{ marginTop: 12, fontSize: 14, color: "rgba(255,255,255,0.42)", maxWidth: 460, margin: "12px auto 0", lineHeight: 1.5 }}>
              Surface at-risk cases early, automate session prep, and keep every practice running at its best.
            </p>

            {/* Sign In link */}
            <div style={{ marginTop: 20 }}>
              <Link
                href="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 28px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(107,130,212,0.22), rgba(107,130,212,0.08))",
                  border: "1px solid rgba(107,130,212,0.35)",
                  color: "#f1f5f9",
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', system-ui",
                  textDecoration: "none",
                  transition: "all 200ms ease",
                  cursor: "pointer",
                }}
              >
                Sign In
              </Link>
            </div>

            {/* Section label into role picker */}
            <div className="hero-section-gap" style={{ marginTop: 28, marginBottom: 4 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px",
                borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)",
                fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase" as const,
                color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00c8a0", boxShadow: "0 0 8px #00c8a0", display: "inline-block" }} />
                Choose your role to get started
              </div>
            </div>
          </div>

          {/* ── Manager action bar ── */}
          {showActionBar && (
            <div ref={ctaRef} className="action-bar" style={{
              marginTop: 20,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 16, flexWrap: "wrap",
              padding: "20px 24px", borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
              backdropFilter: "blur(10px)",
              animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
            }}>
              <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Manager mode toggle */}
                    {selected === "manager" && (
                      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {(["multi", "single"] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => { setManagerMode(mode); }}
                            style={{
                              padding: "6px 14px", borderRadius: 7, border: "none",
                              background: managerMode === mode ? "rgba(0,200,160,0.15)" : "transparent",
                              color: managerMode === mode ? "#00c8a0" : "rgba(255,255,255,0.4)",
                              fontWeight: 700, fontSize: 12, cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {mode === "multi" ? "Multiple practice" : "Single practice"}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Status text */}
                    {selectedPersona ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ position: "relative", width: 10, height: 10 }}>
                          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: selectedPersona.accent, animation: "pulseRing 1.4s ease-out infinite" }} />
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: selectedPersona.accent, position: "relative" }} />
                        </div>
                        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                          Entering as{" "}
                          <span style={{ color: selectedPersona.accent, fontWeight: 700 }}>{selectedPersona.label}</span>
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Select a role above to continue</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="action-bar-launch"
                    onClick={handleLaunch}
                    disabled={!canLaunch || practicesLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "14px 28px", borderRadius: 14,
                      border: selectedPersona && canLaunch
                        ? `1px solid color-mix(in srgb, ${selectedPersona.accent} 40%, transparent)`
                        : "1px solid rgba(255,255,255,0.10)",
                      background: selectedPersona && canLaunch
                        ? `linear-gradient(135deg, rgba(${selectedPersona.accentRgb},0.22), rgba(${selectedPersona.accentRgb},0.08))`
                        : "rgba(255,255,255,0.03)",
                      color: canLaunch && !practicesLoading ? "white" : "rgba(255,255,255,0.3)",
                      fontWeight: 800, fontSize: 15,
                      cursor: canLaunch && !practicesLoading ? "pointer" : "not-allowed",
                      transition: "all 0.25s ease",
                      fontFamily: "'Sora', system-ui",
                      boxShadow: selectedPersona && canLaunch ? `0 0 30px rgba(${selectedPersona.accentRgb},0.15)` : "none",
                      animation: launched ? "launchPulse 0.4s ease" : "none",
                      minWidth: 180, justifyContent: "center",
                    }}
                  >
                    {launched ? "Launching…" : practicesLoading ? "Loading practice…" : selectedPersona ? selectedPersona.cta : "Launch experience"}
                    <span style={{ display: "inline-block", transition: "transform 0.25s ease", transform: canLaunch && !launched && !practicesLoading ? "translateX(2px)" : "none" }}>
                      {launched ? "⟳" : practicesLoading ? "⟳" : "→"}
                    </span>
                  </button>
                </>
            </div>
          )}

          {/* Selected persona description */}
          {selectedPersona && !launched && (
            <div style={{
              marginTop: 12,
              padding: "16px 24px",
              borderRadius: 16,
              border: `1px solid rgba(${selectedPersona.accentRgb}, 0.15)`,
              background: `rgba(${selectedPersona.accentRgb}, 0.03)`,
              animation: "fadeSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both",
            }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                {selectedPersona.description}
              </div>
            </div>
          )}

          {/* Persona cards */}
          <div className="persona-grid" style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {PERSONAS.map((persona, i) => (
              <PersonaCard key={persona.id} persona={persona} index={i} selected={selected} onSelect={handlePersonaSelect} />
            ))}
          </div>

          <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", animation: "fadeSlideUp 0.6s 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
            Demo environment · Data is synthetic · No real patient info
          </div>
        </div>

      </div>
    </>
  );
}

