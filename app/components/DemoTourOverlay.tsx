// app/components/DemoTourOverlay.tsx
// Positioned tooltip + spotlight overlay for persona-specific guided tours.
// Mounted in root layout — only renders when sessionStorage has an active tour.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { disableDemoMode } from "@/lib/demo/demoMode";
import { clearRole } from "@/lib/roleContext";
import {
  TOUR_SCRIPTS,
  readTourState,
  writeTourState,
  clearTourState,
  type DemoTourState,
  type TourStepDef,
} from "@/lib/demo/tourScripts";

// Design system tokens
const CARD_BG = "#0d1018";
const CARD_BORDER = "#1a2035";
const ACCENT = "#6b82d4";
const ACCENT_RGB = "107,130,212";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "#94a3b8";
const OVERLAY_BG = "rgba(8, 12, 18, 0.82)";

type HighlightRect = { top: number; left: number; width: number; height: number } | null;

export default function DemoTourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const [ver, setVer] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [highlightRect, setHighlightRect] = useState<HighlightRect>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Read tour state (re-derive on pathname change or local ver bump)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tourState = useMemo<DemoTourState | null>(() => readTourState(), [pathname, ver]);

  // Check mobile breakpoint
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth <= 640); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Find and measure target element — uses rAF with setTimeout fallback
  const updateHighlight = useCallback((selector?: string) => {
    if (!selector) { setHighlightRect(null); return; }

    function measure() {
      const el = document.querySelector(selector!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHighlightRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    }

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    // Use rAF to wait for the next paint, then try to find the element
    const rafId = requestAnimationFrame(() => {
      if (!measure()) {
        // Element not found after rAF — retry once with 100ms fallback
        fallbackTimer = setTimeout(() => {
          if (!measure()) {
            setHighlightRect(null);
          }
        }, 100);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  // Re-measure on pathname/step change
  useEffect(() => {
    if (!tourState) return;
    const tour = TOUR_SCRIPTS[tourState.persona];
    if (!tour) return;
    const step = tour.steps[tourState.step];
    if (!step) return;
    const cleanup = updateHighlight(step.targetSelector);
    // Also re-measure on scroll/resize
    function remeasure() {
      if (!step.targetSelector) return;
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHighlightRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
      }
    }
    window.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure, { passive: true });
    return () => {
      if (typeof cleanup === "function") cleanup();
      window.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
    };
  }, [tourState, pathname, ver, updateHighlight]);

  if (!tourState) return null;

  const tour = TOUR_SCRIPTS[tourState.persona];
  if (!tour) return null;
  const currentStep: TourStepDef | undefined = tour.steps[tourState.step];
  if (!currentStep) return null;

  const stepIndex = tourState.step;
  const totalSteps = tour.steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  function navigate(nextStep: number) {
    const nextDef = tour.steps[nextStep];
    if (!nextDef) return;
    // Reset spotlight BEFORE navigation to prevent stale cutout flash
    setHighlightRect(null);
    const newState: DemoTourState = { ...tourState!, step: nextStep };
    writeTourState(newState);
    setVer(v => v + 1);
    // Extract base path (without query params) for comparison
    const currentBase = currentStep?.page?.split("?")[0] ?? "";
    const nextBase = nextDef.page.split("?")[0];
    // Always navigate to get correct query params
    if (nextBase !== currentBase || nextDef.page !== currentStep?.page) {
      router.push(nextDef.page);
    }
  }

  function handleNext() {
    if (isLast) {
      // Tour complete — clean up
      clearTourState();
      try { sessionStorage.setItem("empathai_tour_complete", "1"); } catch {}
      try { sessionStorage.removeItem("demoTourActive"); } catch {}
      setVer(v => v + 1);
      router.push("/demo");
    } else {
      navigate(stepIndex + 1);
    }
  }

  function handlePrev() {
    if (!isFirst) navigate(stepIndex - 1);
  }

  function handleExit() {
    clearTourState();
    disableDemoMode();
    clearRole();
    // Clear sessionStorage key
    try { sessionStorage.removeItem("demoTourActive"); } catch {}
    // Clear portal session cookies
    if (typeof document !== "undefined") {
      document.cookie = "portal_token=; path=/portal; max-age=0";
      document.cookie = "portal_profile_complete=; path=/portal; max-age=0";
    }
    // Clear localStorage demo state
    try {
      localStorage.removeItem("selected_persona");
      localStorage.removeItem("selected_therapist_id");
      localStorage.removeItem("selected_practice_id");
      localStorage.removeItem("selected_manager_mode");
      localStorage.removeItem("portal_token");
      localStorage.removeItem("portal_case_code");
      localStorage.removeItem("portal_label");
      localStorage.removeItem("patient_case_id");
      localStorage.removeItem("patient_name");
      localStorage.removeItem("patient_id");
    } catch {}
    setVer(v => v + 1);
    router.push("/demo");
  }

  // Build clip-path for spotlight cutout
  const clipPath = highlightRect
    ? buildClipPath(highlightRect)
    : undefined;

  // Tooltip positioning: near highlight if available, otherwise fixed bottom-right
  const tooltipPosition = isMobile || !highlightRect
    ? { position: "fixed" as const, bottom: 24, right: 16, left: 16 }
    : {
        position: "absolute" as const,
        top: highlightRect.top + highlightRect.height + 16,
        left: Math.max(16, Math.min(highlightRect.left, window.innerWidth - 360)),
      };

  return (
    <>
      <style>{`
        @keyframes tourRingPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(${ACCENT_RGB},0.5), 0 0 16px rgba(${ACCENT_RGB},0.15); }
          50% { box-shadow: 0 0 0 3px rgba(${ACCENT_RGB},0.7), 0 0 24px rgba(${ACCENT_RGB},0.25); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tour-highlight-ring {
            animation: none !important;
            box-shadow: 0 0 0 2px rgba(${ACCENT_RGB},0.6), 0 0 16px rgba(${ACCENT_RGB},0.15) !important;
          }
        }
        .tour-tooltip-btn {
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
          font-family: 'DM Sans', system-ui;
        }
        .tour-tooltip-btn:hover { opacity: 0.85; }
      `}</style>

      {/* Full-screen overlay with spotlight cutout */}
      <div
        data-demo-overlay="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: clipPath ? undefined : OVERLAY_BG,
          pointerEvents: "none",
        }}
      >
        {clipPath && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: OVERLAY_BG,
              clipPath,
              transition: "clip-path 300ms ease, opacity 200ms ease",
            }}
          />
        )}
      </div>

      {/* Highlight ring around target element */}
      {highlightRect && (
        <div
          className="tour-highlight-ring"
          style={{
            position: "absolute",
            top: highlightRect.top - 6,
            left: highlightRect.left - 6,
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
            borderRadius: 8,
            border: `2px solid ${ACCENT}`,
            pointerEvents: "none",
            zIndex: 9999,
            animation: "tourRingPulse 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={`Demo tour step ${stepIndex + 1} of ${totalSteps}`}
        style={{
          ...tooltipPosition,
          zIndex: 9999,
          width: isMobile ? undefined : 320,
          maxWidth: "calc(100vw - 32px)",
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: "20px 24px",
          fontFamily: "'DM Sans', system-ui",
          boxShadow: `0 0 0 2px ${ACCENT}, 0 16px 40px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Step counter + Exit */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: TEXT_SECONDARY,
            fontFamily: "'DM Mono', monospace",
          }}>
            {stepIndex + 1} of {totalSteps} · {tour.label} tour
          </span>
          <button
            type="button"
            className="tour-tooltip-btn"
            onClick={handleExit}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#f87171",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 6,
              padding: "4px 10px",
              letterSpacing: 0.3,
            }}
          >
            Exit Demo
          </button>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 16,
          fontWeight: 800,
          color: TEXT_PRIMARY,
          letterSpacing: -0.3,
          fontFamily: "'Sora', system-ui",
          marginBottom: 6,
        }}>
          {currentStep.headline}
        </div>

        {/* Body */}
        <div style={{
          fontSize: 13,
          color: TEXT_SECONDARY,
          lineHeight: 1.6,
          marginBottom: 18,
        }}>
          {currentStep.body}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {/* Step dots */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {tour.steps.map((_, i) => {
              const isCompleted = i < stepIndex;
              const isCurrent = i === stepIndex;
              return (
                <div
                  key={i}
                  style={{
                    width: isCurrent ? 10 : 6,
                    height: isCurrent ? 10 : 6,
                    borderRadius: "50%",
                    background: isCompleted || isCurrent ? ACCENT : "transparent",
                    border: isCompleted || isCurrent ? "none" : `1.5px solid rgba(${ACCENT_RGB},0.4)`,
                    transition: "all 0.2s ease",
                  }}
                />
              );
            })}
          </div>

          {/* Prev / Next */}
          <div style={{ display: "flex", gap: 8 }}>
            {!isFirst && (
              <button
                type="button"
                className="tour-tooltip-btn"
                onClick={handlePrev}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT_SECONDARY,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 8,
                  padding: "7px 14px",
                }}
              >
                Prev
              </button>
            )}
            <button
              type="button"
              className="tour-tooltip-btn"
              onClick={handleNext}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isLast ? "#080c12" : TEXT_PRIMARY,
                background: isLast ? "#4ade80" : ACCENT,
                border: "none",
                borderRadius: 8,
                padding: "7px 18px",
              }}
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Build a CSS clip-path polygon that covers the full viewport
 * EXCEPT for a rectangular cutout around the target element.
 * Uses an inset box-shadow approach as fallback is not needed
 * since polygon() is widely supported.
 */
function buildClipPath(rect: NonNullable<HighlightRect>): string {
  const pad = 8;
  const t = Math.max(0, rect.top - pad);
  const l = Math.max(0, rect.left - pad);
  const r = rect.left + rect.width + pad;
  const b = rect.top + rect.height + pad;

  // Polygon: outer rectangle (clockwise) then cutout (counter-clockwise)
  return `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px
  )`;
}
