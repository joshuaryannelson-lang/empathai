// app/components/DemoTourOverlay.tsx
// Fixed bottom overlay for the investor demo guided tour.
// Mounted in root layout — only renders when sessionStorage has an active tour step.
"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TOUR_STEPS, TOUR_SS_KEY } from "@/lib/demo/tourSteps";

function readStep(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(TOUR_SS_KEY);
    return v ? Number(v) : null;
  } catch { return null; }
}

export default function DemoTourOverlay() {
  const router = useRouter();
  const pathname = usePathname();

  // _ver is bumped by local actions (goTo/exit) to force re-read.
  // pathname changes trigger re-render via usePathname(); useMemo re-derives.
  const [_ver, setVer] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname and _ver intentionally trigger re-read
  const step = useMemo(() => readStep(), [pathname, _ver]);

  if (step === null) return null;

  const current = TOUR_STEPS.find((s) => s.step === step);
  if (!current) return null;

  const isFirst = step === 1;
  const isLast = step === TOUR_STEPS.length;

  function goTo(nextStep: number) {
    const target = TOUR_STEPS.find((s) => s.step === nextStep);
    if (!target) return;
    try { sessionStorage.setItem(TOUR_SS_KEY, String(nextStep)); } catch {}
    setVer((v) => v + 1);
    router.push(target.href);
  }

  function exit() {
    try { sessionStorage.removeItem(TOUR_SS_KEY); } catch {}
    setVer((v) => v + 1);
    router.push("/demo");
  }

  function handleNext() {
    if (step === null) return;
    if (isLast) {
      try {
        sessionStorage.removeItem(TOUR_SS_KEY);
        sessionStorage.setItem("empathai_tour_complete", "1");
      } catch {}
      setVer((v) => v + 1);
      router.push("/demo");
      return;
    } else {
      goTo(step + 1);
    }
  }

  function handleBack() {
    if (step === null) return;
    if (!isFirst) goTo(step - 1);
  }

  return (
    <>
      <style>{`
        .tour-overlay-btn {
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .tour-overlay-btn:hover {
          filter: brightness(1.2);
        }
        @media (max-width: 640px) {
          .tour-overlay-inner {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .tour-overlay-buttons {
            width: 100% !important;
            justify-content: stretch !important;
          }
          .tour-overlay-buttons button,
          .tour-overlay-buttons a {
            flex: 1 !important;
            text-align: center !important;
            justify-content: center !important;
          }
        }
      `}</style>
      <div
        role="navigation"
        aria-label="Demo guided tour"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#0d1018",
          borderTop: "2px solid #4ade80",
          padding: "16px 24px",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <div
          className="tour-overlay-inner"
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* Left: step counter + callout */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  background: `rgba(${current.colorRgb}, 0.15)`,
                  border: `1px solid rgba(${current.colorRgb}, 0.3)`,
                  color: current.color,
                  flexShrink: 0,
                }}
              >
                {current.icon}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: "#4ade80",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                Step {step} of {TOUR_STEPS.length}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {current.role}
              </span>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#e2e8f0",
                letterSpacing: -0.2,
              }}
            >
              {current.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.45,
                marginTop: 2,
                maxWidth: 560,
              }}
            >
              {current.detail}
            </div>
          </div>

          {/* Right: Exit | Back | Next */}
          <div
            className="tour-overlay-buttons"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="tour-overlay-btn"
              onClick={exit}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.35)",
                background: "none",
                border: "none",
                padding: "8px 12px",
                fontFamily: "'DM Sans', system-ui",
              }}
            >
              Exit tour
            </button>

            {!isFirst && (
              <button
                type="button"
                className="tour-overlay-btn"
                onClick={handleBack}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.6)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontFamily: "'Sora', system-ui",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Back
              </button>
            )}

            <button
              type="button"
              className="tour-overlay-btn"
              onClick={handleNext}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: isLast ? "#080810" : "#e2e8f0",
                background: isLast
                  ? "#4ade80"
                  : `rgba(${current.colorRgb}, 0.15)`,
                border: isLast
                  ? "1px solid #4ade80"
                  : `1px solid rgba(${current.colorRgb}, 0.35)`,
                borderRadius: 8,
                padding: "8px 20px",
                fontFamily: "'Sora', system-ui",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {isLast ? "Finish tour" : "Next step \u2192"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
