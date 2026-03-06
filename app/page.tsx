/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isDemoMode, enableDemoMode, disableDemoMode, DEMO_CONFIG } from "@/lib/demo/demoMode";
import { setRole, clearRole } from "@/lib/roleContext";

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
    icon: "◈",
    tagline: "Signal, not noise",
    description: "Practice health scores, at-risk patterns, and engagement trends — the insights you wish you had, finally surfaced.",
    accent: "#f5a623",
    accentRgb: "245,166,35",
    highlights: ["Practice health scores", "At-risk trend patterns", "Engagement benchmarks"],
    cta: "Coming soon",
    badge: "Coming soon",
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
      className="persona-card-wrap"
      onClick={() => onSelect(persona.id)}
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
          ? `0 0 0 1px rgba(var(--accent-rgb),0.2), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(var(--accent-rgb),0.08)`
          : "0 4px 24px rgba(0,0,0,0.3)",
        animationDelay: `${index * 120}ms`,
        animationName: "fadeSlideUp",
        animationDuration: "0.6s",
        animationFillMode: "both",
        animationTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
        display: "flex",
        flexDirection: "column",
      } as React.CSSProperties}
    >
      {/* Coming soon badge */}
      {"badge" in persona && persona.badge && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          padding: "3px 9px", borderRadius: 999,
          fontSize: 10, fontWeight: 700, letterSpacing: 1,
          textTransform: "uppercase" as const,
          background: `rgba(var(--accent-rgb), 0.12)`,
          border: `1px solid rgba(var(--accent-rgb), 0.35)`,
          color: persona.accent,
        }}>
          {persona.badge}
        </div>
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


// ── Demo Story ────────────────────────────────────────────────────────────────

type DemoStepDef = {
  step: number;
  role: string;
  icon: string;
  title: string;
  detail: string;
  color: string;
  colorRgb: string;
};

const DEMO_STEPS: DemoStepDef[] = [
  {
    step: 1,
    role: "Patient",
    icon: "♡",
    title: "A patient submits their weekly check-in",
    detail: "Monday morning — they rate their mood, log sleep quality, and flag a new work stressor.",
    color: "#38bdf8",
    colorRgb: "56,189,248",
  },
  {
    step: 2,
    role: "AI Engine",
    icon: "✦",
    title: "EmpathAI detects changes and signals risk",
    detail: "The system surfaces a theme shift (sleep → work stress) and flags low engagement — before the therapist even opens the chart.",
    color: "#7c5cfc",
    colorRgb: "124,92,252",
  },
  {
    step: 3,
    role: "Therapist",
    icon: "◎",
    title: "AI generates session prep for the therapist",
    detail: "Structured briefing with goal progress, barriers, and suggested focus — linked to the signals that drove them.",
    color: "#00c8a0",
    colorRgb: "0,200,160",
  },
  {
    step: 4,
    role: "Manager",
    icon: "⬡",
    title: "The practice manager sees the impact in THS",
    detail: "THS updates in real time — showing what moved the score and which actions to take this week.",
    color: "#f5a623",
    colorRgb: "245,166,35",
  },
];

type StepTarget = {
  step: number;
  href?: string;
  loading?: boolean;
};

function GuidedDemoPanel({ router }: { router: ReturnType<typeof useRouter> }) {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [stepTarget, setStepTarget] = useState<StepTarget | null>(null);
  const [navData, setNavData] = useState<{ patientHref?: string; therapistHref?: string; caseHref?: string; practiceHref?: string } | null>(null);
  const [navLoading, setNavLoading] = useState(false);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }, []);

  async function resolveNavData() {
    if (navData || navLoading) return;
    setNavLoading(true);
    try {
      const [therapistsRes, practicesRes] = await Promise.all([
        fetch("/api/therapists", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/practices", { cache: "no-store" }).then(r => r.json()),
      ]);
      const therapists: Therapist[] = Array.isArray(therapistsRes?.data) ? therapistsRes.data : [];
      const practices: Practice[] = Array.isArray(practicesRes?.data) ? practicesRes.data : (Array.isArray(practicesRes) ? practicesRes : []);
      const therapist = therapists[0] ?? null;
      const practice = therapist ? practices.find(p => p.id === therapist.practice_id) ?? practices[0] : practices[0];

      // Fetch a case for the caseHref
      let caseHref: string | undefined;
      if (practice) {
        const casesRes = await fetch(`/api/cases?practice_id=${practice.id}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
        const cases = Array.isArray(casesRes?.data) ? casesRes.data : [];
        if (cases[0]?.id) {
          caseHref = `/cases/${cases[0].id}?week_start=${weekStart}`;
        }
      }

      setNavData({
        patientHref: "/portal",
        therapistHref: therapist ? `/dashboard/therapists/${therapist.id}/care?week_start=${weekStart}` : undefined,
        caseHref,
        practiceHref: practice ? `/practices/${practice.id}/health-score?week_start=${weekStart}` : undefined,
      });

      // Pre-store selection
      if (therapist?.practice_id) {
        try { localStorage.setItem("selected_practice_id", therapist.practice_id); } catch {}
        try { localStorage.setItem("selected_therapist_id", therapist.id); } catch {}
      }
    } catch {
      // no-op
    } finally {
      setNavLoading(false);
    }
  }

  function handleStepClick(step: number) {
    setActiveStep(step);
    resolveNavData();
  }

  function handleEnterStep(step: number) {
    const hrefs: Record<number, string | undefined> = {
      1: navData?.patientHref,
      2: navData?.caseHref,
      3: navData?.therapistHref,
      4: navData?.practiceHref,
    };
    const href = hrefs[step];
    if (href) {
      setStepTarget({ step, loading: true });
      setTimeout(() => router.push(href), 200);
    } else if (navLoading) {
      setStepTarget({ step, loading: true });
    }
  }

  return (
    <div style={{ marginBottom: 24, borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(10px)", overflow: "hidden", animation: "fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
      {/* Scenario header */}
      <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00c8a0", boxShadow: "0 0 8px #00c8a0", animation: "pulseRing 2s ease-out infinite", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace" }}>
            Demo Scenario
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginTop: 2, letterSpacing: -0.3, fontFamily: "'Sora', system-ui" }}>
            Monday morning at a therapy practice
          </div>
        </div>
        <div className="demo-header-hint" style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>
          Click a step to explore →
        </div>
      </div>

      {/* Steps */}
      <div className="demo-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
        {DEMO_STEPS.map((s, idx) => {
          const isActive = activeStep === s.step;
          return (
            <div
              key={s.step}
              className="demo-step-cell"
              onClick={() => handleStepClick(s.step)}
              style={{
                padding: "20px 18px",
                borderRight: idx < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
                cursor: "pointer",
                background: isActive ? `rgba(${s.colorRgb},0.06)` : "transparent",
                borderBottom: isActive ? `2px solid ${s.color}` : "2px solid transparent",
                transition: "all 0.2s ease",
                position: "relative" as const,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13,
                  background: `rgba(${s.colorRgb},0.12)`,
                  border: `1px solid rgba(${s.colorRgb},0.2)`,
                  color: s.color,
                }}>
                  {s.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: 1.2, textTransform: "uppercase" as const, fontFamily: "'DM Mono', monospace" }}>
                  Step {s.step}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", lineHeight: 1.4, marginBottom: 6, letterSpacing: -0.2 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
                {s.detail}
              </div>
              {isActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleEnterStep(s.step); }}
                  disabled={navLoading && !navData}
                  style={{
                    marginTop: 14, display: "flex", alignItems: "center", gap: 6,
                    fontSize: 12, fontWeight: 700,
                    color: s.color,
                    background: `rgba(${s.colorRgb},0.10)`,
                    border: `1px solid rgba(${s.colorRgb},0.3)`,
                    borderRadius: 8, padding: "7px 14px",
                    cursor: navLoading && !navData ? "not-allowed" : "pointer",
                    fontFamily: "'Sora', system-ui",
                    transition: "all 0.15s",
                    opacity: stepTarget?.step === s.step && stepTarget.loading ? 0.6 : 1,
                  }}
                >
                  {stepTarget?.step === s.step && stepTarget.loading ? "Opening…" : navLoading && !navData ? "Loading…" : "Enter this step →"}
                </button>
              )}
            </div>
          );
        })}
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
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(isDemoMode());
  }, []);

  // Practice picker state (manager single-practice mode)
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practicesLoading, setPracticesLoading] = useState(false);

  const weekStart = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);

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

  function handlePersonaSelect(id: string) {
    if (id === "patient") {
      storeRole("patient");
      setSelected(id); setLaunched(true);
      setTimeout(() => router.push("/portal/onboarding"), 300);
      return;
    }
    if (id === "admin") {
      // Admin role comes from JWT only — do not call setRole()
      // Clear any stale sessionStorage role so getRole() falls through to JWT
      clearRole();
      setSelected(id); setLaunched(true);
      try { localStorage.setItem("selected_persona", "admin"); } catch {}
      setTimeout(() => router.push("/admin"), 300);
      return;
    }
    if (id === "analytics") {
      // Coming soon — just select, don't route
      setSelected((prev) => (prev === id ? null : id));
      return;
    }
    if (id === "therapist") {
      storeRole("therapist");
      setSelected(id); setLaunched(true);
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
      return;
    }
    if (id === "manager") {
      // First click selects and shows manager sub-mode action bar.
      // The action bar Launch button calls handleLaunch() which routes.
      // But if already selected, treat as a direct launch to /admin/status.
      if (selected === "manager") {
        storeRole("manager");
        setLaunched(true);
        setTimeout(() => router.push("/admin/status"), 300);
        return;
      }
      setSelected("manager");
      return;
    }
    setSelected((prev) => (prev === id ? null : id));
  }

function handleLaunch() {
    if (!selected) return;
    if (selected === "manager" && managerMode === "multi") {
      storeRole("manager");
      try { localStorage.setItem("selected_manager_mode", "multi"); } catch {}
      setLaunched(true);
      setTimeout(() => router.push("/admin/status"), 300);
    } else if (selected === "manager" && managerMode === "single" && harperPractice) {
      storeRole("manager");
      try { localStorage.setItem("selected_manager_mode", "single"); } catch {}
      try { localStorage.setItem("selected_practice_id", harperPractice.id); } catch {}
      setLaunched(true);
      setTimeout(() => router.push(`/admin/status?practice_id=${encodeURIComponent(harperPractice.id)}`), 300);
    }
  }

  const selectedPersona = PERSONAS.find((p) => p.id === selected);
  const showActionBar = selected === "manager";
  const canLaunch = showActionBar && (
    managerMode === "multi" ||
    (managerMode === "single" && !!harperPractice)
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
        @keyframes pulseRing { 0% { transform: scale(0.95); opacity: 0.6; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes launchPulse { 0% { transform: scale(1); } 50% { transform: scale(0.96); } 100% { transform: scale(1); } }
        .persona-card-wrap:active { transform: scale(0.97) !important; }
        @media (max-width: 640px) {
          .hero-h1 { letter-spacing: -0.8px !important; }
          .hero-section-gap { margin-top: 24px !important; }
          .action-bar { flex-direction: column !important; align-items: stretch !important; }
          .action-bar-launch { width: 100% !important; justify-content: center !important; }
          .persona-grid { grid-template-columns: 1fr !important; }
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
        minHeight: "100vh", background: "#080810", color: "white",
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

          {/* ── Guided demo story — visible only in demo mode ── */}
          {isDemo && (
            <div style={{ marginTop: 28, animation: "fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
              <GuidedDemoPanel router={router} />
            </div>
          )}

          {/* ── Manager action bar ── */}
          {showActionBar && (
            <div className="action-bar" style={{
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

        {/* Floating demo toggle */}
        <DemoToggle />
      </div>
    </>
  );
}

// ── Demo Toggle (bottom-right pill) ──────────────────────────────────────────

function DemoToggle() {
  const [demoOn, setDemoOn] = useState(false);

  useEffect(() => {
    setDemoOn(isDemoMode());
  }, []);

  const handleClick = useCallback(() => {
    if (demoOn) {
      disableDemoMode();
      window.location.reload();
    } else {
      enableDemoMode();
      window.location.href = `/dashboard/manager?practice_id=${DEMO_CONFIG.practiceId}`;
    }
  }, [demoOn]);

  return (
    <button
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 16px",
        borderRadius: 999,
        border: demoOn
          ? "1px solid rgba(34,197,94,0.35)"
          : "1px solid rgba(255,255,255,0.12)",
        background: demoOn
          ? "rgba(34,197,94,0.10)"
          : "rgba(255,255,255,0.05)",
        backdropFilter: "blur(12px)",
        color: demoOn ? "#22c55e" : "rgba(255,255,255,0.45)",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'DM Mono', 'Fira Mono', monospace",
        cursor: "pointer",
        transition: "all 0.2s ease",
        letterSpacing: 0.3,
      }}
    >
      <span style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: demoOn ? "#22c55e" : "rgba(255,255,255,0.25)",
        boxShadow: demoOn ? "0 0 8px #22c55e" : "none",
        flexShrink: 0,
      }} />
      {demoOn ? "Demo On" : "Try Demo"}
    </button>
  );
}
