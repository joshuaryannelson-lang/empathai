/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { safeDisplayText, containsBannedClinicalTerm } from "@/lib/phiDisplayGuard";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionPrepOutput {
  rating_trend: "improving" | "stable" | "declining" | "insufficient_data";
  rating_delta: number | null;
  notable_themes: string[];
  suggested_focus: string;
  data_source: string;
  confidence: "high" | "medium" | "low";
  flags: string[];
}

interface SessionPrepCardProps {
  caseId: string;
  weekStart: string;
}

// ── Design tokens (inline, matching design-system-tokens.ts) ─────────────────

const TREND = {
  improving:         { arrow: "\u2191", label: "Improving",       fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },
  stable:            { arrow: "\u2192", label: "Stable",          fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240" },
  declining:         { arrow: "\u2193", label: "Declining",       fg: "#c4b5a0", bg: "#141210", border: "#2e2820" },
  insufficient_data: { arrow: "\u2014", label: "More data needed", fg: "#6b7280", bg: "#111420", border: "#1f2533" },
};

const CONFIDENCE = {
  high:   { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a", text: "High confidence" },
  medium: { fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240", text: "Medium confidence" },
  low:    { fg: "#d4a574", bg: "#141008", border: "#2e2418", text: "Low confidence" },
};

const REVIEW_GATE = {
  unreviewed: { borderLeft: "3px solid rgba(165,180,252,0.4)", bg: "rgba(165,180,252,0.04)", badgeBg: "rgba(165,180,252,0.12)", badgeFg: "#a5b4fc" },
  reviewed:   { borderLeft: "3px solid rgba(74,222,128,0.3)",  bg: "rgba(74,222,128,0.02)",  badgeBg: "rgba(74,222,128,0.12)",  badgeFg: "#4ade80" },
};

// ── Shimmer skeleton ─────────────────────────────────────────────────────────

function Shimmer({ width = "100%", height = 12 }: { width?: string | number; height?: number }) {
  return (
    <div style={{ height, width, borderRadius: 5, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RatingTrendRow({ trend, delta }: { trend: SessionPrepOutput["rating_trend"]; delta: number | null }) {
  const t = TREND[trend];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px" }}>
      <span
        aria-label={`Rating trend: ${t.label}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.fg, fontSize: 13, fontWeight: 700 }}
      >
        <span aria-hidden="true">{t.arrow}</span> {t.label}
      </span>
      {delta !== null ? (
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: t.fg }}>
          {delta > 0 ? "+" : ""}{delta}
        </span>
      ) : (
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
          First check-in
        </span>
      )}
    </div>
  );
}

function ThemeChips({ themes }: { themes: string[] }) {
  return (
    <div style={{ padding: "0 18px 8px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
        Key themes
      </div>
      {themes.length === 0 ? (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>No patterns identified yet</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {themes.slice(0, 3).map((theme, i) => {
            const isBanned = containsBannedClinicalTerm(theme);
            if (isBanned) console.error(`[SessionPrepCard] Banned clinical term detected in theme: "${theme}"`);
            const displayText = isBanned ? "Pattern noted" : safeDisplayText(theme, "theme-chip");
            return (
              <span
                key={i}
                style={{ display: "inline-flex", padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600 }}
              >
                {displayText}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SuggestedFocusBlock({ focus, isReviewed, onMarkReviewed }: { focus: string; isReviewed: boolean; onMarkReviewed: () => void }) {
  const gate = isReviewed ? REVIEW_GATE.reviewed : REVIEW_GATE.unreviewed;
  const safeFocus = safeDisplayText(focus, "suggested-focus");

  return (
    <div style={{ margin: "0 18px", padding: 14, borderRadius: 10, borderLeft: gate.borderLeft, background: gate.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: isReviewed ? REVIEW_GATE.reviewed.badgeFg : REVIEW_GATE.unreviewed.badgeFg }}>
          AI-suggested focus
        </span>
        <span
          aria-label={isReviewed ? "Reviewed" : "Unreviewed"}
          style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: gate.badgeBg, color: gate.badgeFg }}
        >
          {isReviewed ? "Reviewed \u2713" : "Unreviewed"}
        </span>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: isReviewed ? "#e2e8f0" : "rgba(255,255,255,0.65)", filter: isReviewed ? "none" : "blur(2px)", userSelect: isReviewed ? "auto" : "none" }}>
          {safeFocus}
        </div>
        {!isReviewed && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc" }}>Mark as reviewed to use this suggestion</span>
            <button
              onClick={onMarkReviewed}
              aria-label="Mark session prep as reviewed"
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1f2533", background: "transparent", color: "#a5b4fc", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Mark as reviewed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidenceRow({ confidence, dataSource }: { confidence: "high" | "medium" | "low"; dataSource: string }) {
  const c = CONFIDENCE[confidence];
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px 14px" }}>
      <span
        tabIndex={confidence === "low" ? 0 : undefined}
        role={confidence === "low" ? "button" : undefined}
        aria-label={`${c.text}${confidence === "low" ? ". Based on fewer than 2 check-ins — more data needed for reliable trends." : ""}`}
        onMouseEnter={() => confidence === "low" && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => confidence === "low" && setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        style={{ position: "relative", display: "inline-flex", padding: "3px 8px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 800, lineHeight: 1.2, cursor: confidence === "low" ? "help" : "default" }}
      >
        {c.text}
        {showTooltip && confidence === "low" && (
          <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1a1e2a", border: "1px solid #1f2533", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)", maxWidth: 240, whiteSpace: "normal", zIndex: 10 }}>
            Based on fewer than 2 check-ins — more data needed for reliable trends.
          </div>
        )}
      </span>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>
        {dataSource}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function SessionPrepCard({ caseId, weekStart }: SessionPrepCardProps) {
  const [data, setData] = useState<SessionPrepOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  const storageKey = `reviewed_session_prep_${caseId}_${weekStart}`;

  useEffect(() => {
    try { setReviewed(localStorage.getItem(storageKey) === "true"); } catch { /* noop */ }
  }, [storageKey]);

  const markReviewed = useCallback(() => {
    setReviewed(true);
    try { localStorage.setItem(storageKey, "true"); } catch { /* noop */ }
  }, [storageKey]);

  const loadPrep = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/session-prep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error?.message ?? JSON.stringify(json?.error ?? "Failed"));
      setData(json?.data ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { loadPrep(); }, [loadPrep]);

  return (
    <div style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #131720", background: "linear-gradient(160deg, #0a0e1c, #0d1018)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #3b4fd4, #6d3fc4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{"\u2726"}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" }}>Session Prep</div>
          <div style={{ fontSize: 11, color: "#374151", marginTop: 1 }}>Structured insights from patient check-ins</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#6d3fc4", animation: "pulse 1.2s ease-in-out infinite" }} />
              Generating&hellip;
            </div>
          )}
          <button
            onClick={loadPrep}
            disabled={loading}
            aria-label="Refresh session prep"
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #1f2533", background: "#0d1018", color: "inherit", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontWeight: 600, fontFamily: "inherit", fontSize: 13 }}
          >
            {"\u21BB"} Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && !data ? (
        <div style={{ padding: 18, display: "grid", gap: 12 }}>
          <Shimmer width="40%" height={24} />
          <div style={{ display: "flex", gap: 8 }}><Shimmer width={120} /><Shimmer width={100} /><Shimmer width={90} /></div>
          <Shimmer width="85%" height={16} />
          <Shimmer width="60%" />
        </div>
      ) : error ? (
        <div style={{ marginTop: 12, margin: 14, borderRadius: 14, border: "1px solid #3d2800", background: "#1a1000", padding: 12, color: "#fb923c" }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Couldn&apos;t load session prep</div>
          <div style={{ opacity: 0.95, fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : !data ? (
        <div style={{ padding: "32px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>{"\uD83D\uDCCB"}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>No check-in data yet</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6, maxWidth: 280, margin: "6px auto 0", lineHeight: 1.5 }}>
            Once the patient completes their first check-in, session prep will appear here.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <RatingTrendRow trend={data.rating_trend} delta={data.rating_delta} />
          <ThemeChips themes={data.notable_themes} />
          <SuggestedFocusBlock focus={data.suggested_focus} isReviewed={reviewed} onMarkReviewed={markReviewed} />
          <ConfidenceRow confidence={data.confidence} dataSource={data.data_source} />
        </div>
      )}
    </div>
  );
}
