/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeDisplayText, containsBannedClinicalTerm } from "@/lib/phiDisplayGuard";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionPrepOutput {
  rating_trend: "improving" | "stable" | "declining" | "insufficient_data";
  rating_delta: number | null;
  data_source: string;
  confidence: "high" | "medium" | "low";
  flags: string[];
  open_with: string | null;
  watch_for: string | null;
  try_this: string | null;
  send_this: string | null;
}

interface SessionPrepCardProps {
  caseId: string;
  weekStart: string;
}

// ── Design tokens ────────────────────────────────────────────────────────────

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

const CARD_META = [
  { key: "open_with" as const, icon: "\uD83D\uDCAC", label: "OPEN WITH",  accent: "#4ade80", accentBg: "rgba(74,222,128,0.06)",  accentBorder: "rgba(74,222,128,0.18)" },
  { key: "watch_for" as const, icon: "\uD83D\uDC41",  label: "WATCH FOR", accent: "#fb923c", accentBg: "rgba(251,146,60,0.06)",  accentBorder: "rgba(251,146,60,0.18)" },
  { key: "try_this"  as const, icon: "\uD83C\uDFAF", label: "TRY THIS",  accent: "#a78bfa", accentBg: "rgba(167,139,250,0.06)", accentBorder: "rgba(167,139,250,0.18)" },
  { key: "send_this" as const, icon: "\uD83D\uDCE8", label: "SEND THIS", accent: "#38bdf8", accentBg: "rgba(56,189,248,0.06)",  accentBorder: "rgba(56,189,248,0.18)" },
];

const REVIEW_GATE = {
  unreviewed: { border: "1px solid rgba(165,180,252,0.25)", bg: "rgba(165,180,252,0.03)", badgeBg: "rgba(165,180,252,0.12)", badgeFg: "#a5b4fc" },
  reviewed:   { border: "1px solid rgba(74,222,128,0.2)",   bg: "rgba(74,222,128,0.02)",  badgeBg: "rgba(74,222,128,0.12)",  badgeFg: "#4ade80" },
};

// ── Shimmer skeleton ─────────────────────────────────────────────────────────

function Shimmer({ width = "100%", height = 12 }: { width?: string | number; height?: number }) {
  return (
    <div style={{ height, width, borderRadius: 5, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
  );
}

// ── Safe text helper ─────────────────────────────────────────────────────────

function safeCardText(text: string | null, context: string): string | null {
  if (!text) return null;
  if (containsBannedClinicalTerm(text)) {
    console.error(`[SessionPrepCard] Banned clinical term in ${context}: "${text.slice(0, 50)}..."`);
    return null;
  }
  return safeDisplayText(text, context);
}

// ── Copy button for SEND THIS ────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      style={{
        marginTop: 10,
        padding: "6px 12px",
        borderRadius: 7,
        border: copied ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(56,189,248,0.2)",
        background: copied ? "rgba(74,222,128,0.08)" : "rgba(56,189,248,0.08)",
        color: copied ? "#4ade80" : "#38bdf8",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s ease",
      }}
    >
      {copied ? "\u2713 Copied" : "Copy message"}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

// Content hash for reviewed gate — ties reviewed state to specific AI output
function contentHash(d: SessionPrepOutput): string {
  const raw = [d.open_with ?? "", d.watch_for ?? "", d.try_this ?? "", d.send_this ?? ""].join("|");
  let h = 0;
  for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h + raw.charCodeAt(i)) | 0; }
  return h.toString(36);
}

export default function SessionPrepCard({ caseId, weekStart }: SessionPrepCardProps) {
  const searchParams = useSearchParams();
  const isDemo = searchParams?.get("demo") === "true";
  const [data, setData] = useState<SessionPrepOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  const storageKey = `reviewed_session_prep_${caseId}_${weekStart}`;

  // Check reviewed state against content hash
  useEffect(() => {
    if (!data) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setReviewed(parsed.hash === contentHash(data));
      } else {
        setReviewed(false);
      }
    } catch { setReviewed(false); }
  }, [storageKey, data]);

  const markReviewed = useCallback(() => {
    if (!data) return;
    setReviewed(true);
    try { localStorage.setItem(storageKey, JSON.stringify({ hash: contentHash(data), reviewed: true })); } catch { /* noop */ }
  }, [storageKey, data]);

  const loadPrep = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const demoSuffix = isDemo ? "?demo=true" : "";
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/session-prep${demoSuffix}`, {
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
  }, [caseId, isDemo]);

  useEffect(() => { loadPrep(); }, [loadPrep]);

  const gate = reviewed ? REVIEW_GATE.reviewed : REVIEW_GATE.unreviewed;
  const t = data ? TREND[data.rating_trend] : null;
  const c = data ? CONFIDENCE[data.confidence] : null;

  return (
    <div style={{ borderRadius: 12, border: gate.border, background: gate.bg, overflow: "hidden" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @media (max-width: 768px) { .sp-grid { grid-template-columns: 1fr !important; grid-template-rows: auto !important; } }`}</style>

      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #131720", background: "linear-gradient(160deg, #0a0e1c, #0d1018)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #3b4fd4, #6d3fc4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "white" }}>{"\u2726"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", letterSpacing: 0.5, textTransform: "uppercase" }}>Session Prep</span>
            <span style={{ display: "inline-flex", padding: "2px 6px", borderRadius: 4, background: "rgba(107,130,212,0.15)", border: "1px solid rgba(107,130,212,0.25)", color: "#6b82d4", fontSize: 10, fontWeight: 800 }}>AI</span>
          </div>
          {data && c && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 800 }}>
                {c.text}
              </span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)" }}>
                {data.data_source}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563" }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#6d3fc4", animation: "pulse 1.2s ease-in-out infinite" }} />
              Generating&hellip;
            </div>
          )}
          <button
            onClick={loadPrep}
            disabled={loading}
            aria-label="Regenerate session prep"
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #1f2533", background: "#0d1018", color: "inherit", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontWeight: 600, fontFamily: "inherit", fontSize: 13 }}
          >
            {"\u21BB"} Regenerate
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && !data ? (
        <div style={{ padding: 18, display: "grid", gap: 12 }}>
          <Shimmer width="40%" height={24} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ borderRadius: 10, border: "1px solid #1a1e2a", padding: 14 }}>
                <Shimmer width="50%" height={10} />
                <div style={{ marginTop: 10 }}><Shimmer width="90%" height={12} /></div>
                <div style={{ marginTop: 6 }}><Shimmer width="70%" /></div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div style={{ margin: 14, borderRadius: 14, border: "1px solid #3d2800", background: "#1a1000", padding: 12, color: "#fb923c" }}>
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
        <div style={{ position: "relative" }}>
          {/* Trend row */}
          {t && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px" }}>
              <span
                aria-label={`Rating trend: ${t.label}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.fg, fontSize: 12, fontWeight: 700 }}
              >
                <span aria-hidden="true">{t.arrow}</span> {t.label}
              </span>
              {data.rating_delta !== null && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: t.fg }}>
                  {data.rating_delta > 0 ? "+" : ""}{data.rating_delta}
                </span>
              )}
            </div>
          )}

          {/* 4-card grid */}
          <div className="sp-grid" style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 10,
            padding: "4px 18px 14px",
            filter: reviewed ? "none" : "blur(3px)",
            userSelect: reviewed ? "auto" : "none",
            transition: "filter 0.2s ease",
          }}>
            {CARD_META.map(({ key, icon, label, accent, accentBg, accentBorder }) => {
              const rawText = data[key];
              const cardText = safeCardText(rawText, key);
              if (cardText === null && key !== "open_with") return null;

              return (
                <div key={key} style={{
                  borderRadius: 10,
                  border: `1px solid ${accentBorder}`,
                  background: accentBg,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: accent, fontFamily: "'DM Mono', monospace" }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.65, color: "#d1d5db", flex: 1 }}>
                    {cardText ?? "Not enough check-in data yet"}
                  </div>
                  {key === "send_this" && cardText && <CopyButton text={cardText} />}
                </div>
              );
            })}
          </div>

          {/* Review gate overlay */}
          {!reviewed && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "rgba(8,12,18,0.5)",
              zIndex: 2,
            }}>
              <span style={{
                display: "inline-flex",
                padding: "3px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                background: REVIEW_GATE.unreviewed.badgeBg,
                color: REVIEW_GATE.unreviewed.badgeFg,
              }}>
                Unreviewed
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc", textAlign: "center", maxWidth: 280 }}>
                AI-generated content requires therapist review before use
              </span>
              <button
                onClick={markReviewed}
                aria-label="Mark session prep as reviewed"
                style={{
                  padding: "10px 20px",
                  borderRadius: 9,
                  border: "1px solid #1f2533",
                  background: "rgba(165,180,252,0.08)",
                  color: "#a5b4fc",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Mark as reviewed
              </button>
            </div>
          )}

          {/* Reviewed badge */}
          {reviewed && (
            <div style={{ padding: "0 18px 14px", display: "flex", justifyContent: "flex-end" }}>
              <span style={{
                display: "inline-flex",
                padding: "3px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                background: REVIEW_GATE.reviewed.badgeBg,
                color: REVIEW_GATE.reviewed.badgeFg,
              }}>
                Reviewed {"\u2713"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
