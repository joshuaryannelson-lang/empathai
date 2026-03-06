/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { safeDisplayText } from "@/lib/phiDisplayGuard";

// ── Types ────────────────────────────────────────────────────────────────────

export interface THSOutput {
  score: number;
  components: { W: number; S: number; O: number; T: number };
  confidence: "high" | "medium" | "low";
  narrative: string | null;
  week_index: number | null;
}

interface THSScoreWidgetProps {
  caseId: string;
  weekIndex: number | null;
  onOpenRatingsForm: () => void;
}

// ── Design tokens ────────────────────────────────────────────────────────────

const CONFIDENCE = {
  high:   { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a", text: "High confidence" },
  medium: { fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240", text: "Medium confidence" },
  low:    { fg: "#d4a574", bg: "#141008", border: "#2e2418", text: "Low confidence" },
};

const REVIEW_GATE = {
  unreviewed: { borderLeft: "3px solid rgba(165,180,252,0.4)", bg: "rgba(165,180,252,0.04)", badgeBg: "rgba(165,180,252,0.12)", badgeFg: "#a5b4fc" },
  reviewed:   { borderLeft: "3px solid rgba(74,222,128,0.3)",  bg: "rgba(74,222,128,0.02)",  badgeBg: "rgba(74,222,128,0.12)",  badgeFg: "#4ade80" },
};

const COMP_META: Record<string, { label: string; sub: string; therapistRated: boolean }> = {
  W: { label: "Wellbeing",      sub: "from check-ins",   therapistRated: false },
  S: { label: "Engagement",     sub: "therapist-rated",  therapistRated: true },
  O: { label: "Goal Progress",  sub: "therapist-rated",  therapistRated: true },
  T: { label: "Alliance",       sub: "therapist-rated",  therapistRated: true },
};

function scoreColor(s: number | null) {
  if (s === null) return { fg: "#6b7280" };
  if (s <= 3)     return { fg: "#f87171" };
  if (s <= 5)     return { fg: "#fb923c" };
  if (s <= 7)     return { fg: "#eab308" };
  return           { fg: "#4ade80" };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Shimmer({ width = "100%", height = 12 }: { width?: string | number; height?: number }) {
  return <div style={{ height, width, borderRadius: 5, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />;
}

function ScoreDisplay({ score, confidence }: { score: number; confidence: "high" | "medium" | "low" }) {
  const c = CONFIDENCE[confidence];
  const sc = scoreColor(score);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 12px" }}>
      <div style={{ fontFamily: "'Sora', system-ui", fontSize: 42, fontWeight: 900, letterSpacing: "-1px", color: sc.fg }}>
        {score.toFixed(1)}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.35)", marginTop: -4 }}>/10</div>
      <span
        tabIndex={confidence === "low" ? 0 : undefined}
        role={confidence === "low" ? "button" : undefined}
        aria-label={`${c.text}${confidence === "low" ? ". Based on fewer than 2 check-ins." : ""}`}
        onMouseEnter={() => confidence === "low" && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => confidence === "low" && setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        style={{ position: "relative", display: "inline-flex", marginTop: 8, padding: "3px 8px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 800, cursor: confidence === "low" ? "help" : "default" }}
      >
        {c.text}
        {showTooltip && confidence === "low" && (
          <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1a1e2a", border: "1px solid #1f2533", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)", maxWidth: 240, whiteSpace: "normal", zIndex: 10 }}>
            Based on fewer than 2 check-ins — more data needed for reliable trends.
          </div>
        )}
      </span>
      {confidence === "low" && (
        <div style={{ fontSize: 12, fontWeight: 500, color: c.fg, textAlign: "center", marginTop: 8, maxWidth: 260, lineHeight: 1.5 }}>
          Score based on partial data — component ratings pending.
        </div>
      )}
    </div>
  );
}

function ComponentBreakdown({ components, submitted }: { components: { W: number; S: number; O: number; T: number }; submitted: { S: boolean; O: boolean; T: boolean } }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 16px 16px" }}>
      {(["W", "S", "O", "T"] as const).map(key => {
        const meta = COMP_META[key];
        const isPending = meta.therapistRated && !submitted[key as "S" | "O" | "T"];
        const val = components[key];
        const sc = scoreColor(isPending ? null : val);
        return (
          <div
            key={key}
            style={{ borderRadius: 10, border: isPending ? "1px dashed rgba(165,180,252,0.25)" : "1px solid #1a1e2a", background: isPending ? "rgba(165,180,252,0.02)" : "#111420", padding: 10, textAlign: "center" }}
          >
            <div style={{ fontFamily: "'Sora', system-ui", fontSize: 18, fontWeight: 800, color: sc.fg }}>
              {isPending ? "\u2014" : val}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 9, fontWeight: 500, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
              {meta.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NarrativeBlock({ narrative, isReviewed, onMarkReviewed }: { narrative: string | null; isReviewed: boolean; onMarkReviewed: () => void }) {
  const gate = isReviewed ? REVIEW_GATE.reviewed : REVIEW_GATE.unreviewed;

  if (!narrative) {
    return (
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ borderRadius: 10, padding: 14, background: "#111420" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
            Score summary
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)" }}>
            Narrative unavailable — score computed from partial data.
          </div>
        </div>
      </div>
    );
  }

  const safeNarrative = safeDisplayText(narrative, "ths-narrative");

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ borderRadius: 10, padding: 14, borderLeft: gate.borderLeft, background: gate.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: isReviewed ? REVIEW_GATE.reviewed.badgeFg : REVIEW_GATE.unreviewed.badgeFg }}>
            Score summary
          </span>
          <span aria-label={isReviewed ? "Reviewed" : "Unreviewed"} style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: gate.badgeBg, color: gate.badgeFg }}>
            {isReviewed ? "Reviewed \u2713" : "Unreviewed"}
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.65, color: isReviewed ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.45)", filter: isReviewed ? "none" : "blur(2px)", userSelect: isReviewed ? "auto" : "none" }}>
            {safeNarrative}
          </div>
          {!isReviewed && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc" }}>Mark as reviewed to read this summary</span>
              <button
                onClick={onMarkReviewed}
                aria-label="Mark THS narrative as reviewed"
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1f2533", background: "transparent", color: "#a5b4fc", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Mark as reviewed
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingRatingsPrompt({ onOpenRatingsForm }: { onOpenRatingsForm: () => void }) {
  return (
    <button
      onClick={onOpenRatingsForm}
      aria-label="Rate this session to complete the score"
      style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 16px 16px", padding: "12px 14px", borderRadius: 10, border: "1px dashed rgba(165,180,252,0.25)", background: "rgba(165,180,252,0.03)", cursor: "pointer", width: "calc(100% - 32px)", fontFamily: "inherit", transition: "background 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(165,180,252,0.06)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(165,180,252,0.03)")}
    >
      <span style={{ fontSize: 16 }}>{"\uD83D\uDCDD"}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#a5b4fc" }}>Rate this session to complete the score</span>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function THSScoreWidget({ caseId, weekIndex, onOpenRatingsForm }: THSScoreWidgetProps) {
  const [data, setData] = useState<THSOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  const storageKey = `reviewed_ths_${caseId}_${weekIndex ?? "current"}`;
  const ratingsKey = `therapist_ratings_${caseId}_${weekIndex ?? "current"}`;

  useEffect(() => {
    try { setReviewed(localStorage.getItem(storageKey) === "true"); } catch { /* noop */ }
  }, [storageKey]);

  const markReviewed = useCallback(() => {
    setReviewed(true);
    try { localStorage.setItem(storageKey, "true"); } catch { /* noop */ }
  }, [storageKey]);

  // Check for saved therapist ratings
  const getSavedRatings = useCallback((): { S: number; O: number; T: number } | null => {
    try {
      const raw = localStorage.getItem(ratingsKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.S === "number" && typeof parsed.O === "number" && typeof parsed.T === "number") return parsed;
    } catch { /* noop */ }
    return null;
  }, [ratingsKey]);

  const loadTHS = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ratings = getSavedRatings();
      const params = new URLSearchParams();
      if (ratings) {
        params.set("S", String(ratings.S));
        params.set("O", String(ratings.O));
        params.set("T", String(ratings.T));
      }
      const url = `/api/cases/${encodeURIComponent(caseId)}/ths?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error?.message ?? JSON.stringify(json?.error ?? "Failed"));
      setData(json?.data ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, getSavedRatings]);

  useEffect(() => { loadTHS(); }, [loadTHS]);

  // Listen for storage changes (when ratings form saves)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === ratingsKey) loadTHS();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ratingsKey, loadTHS]);

  const savedRatings = getSavedRatings();
  const hasPending = !savedRatings;
  const submitted = {
    S: !!savedRatings,
    O: !!savedRatings,
    T: !!savedRatings,
  };

  return (
    <div style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #131720" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", color: "#9ca3af" }}>
          Practice Health Score
        </span>
        <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "#111420", border: "1px solid #1f2533", fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#6b7280" }}>
          {weekIndex != null ? `Week ${weekIndex}` : "Current"}
        </span>
      </div>

      {/* Body */}
      {loading && !data ? (
        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, width: "100%" }}>
            {[1,2,3,4].map(i => <Shimmer key={i} height={48} />)}
          </div>
          <Shimmer width="85%" /><Shimmer width="60%" />
        </div>
      ) : error ? (
        <div style={{ margin: 14, borderRadius: 14, border: "1px solid #3d2800", background: "#1a1000", padding: 12, color: "#fb923c" }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Couldn&apos;t load score</div>
          <div style={{ opacity: 0.95, fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : data ? (
        <>
          <ScoreDisplay score={data.score} confidence={data.confidence} />
          <ComponentBreakdown components={data.components} submitted={submitted} />
          <NarrativeBlock narrative={data.narrative} isReviewed={reviewed} onMarkReviewed={markReviewed} />
          {hasPending && <PendingRatingsPrompt onOpenRatingsForm={onOpenRatingsForm} />}
        </>
      ) : null}
    </div>
  );
}
