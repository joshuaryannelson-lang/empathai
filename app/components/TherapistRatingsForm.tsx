/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface TherapistRatingsFormProps {
  caseId: string;
  weekIndex: number;
  therapistId?: string | null;
  onClose: () => void;
}

// ── Score color helper (matching existing portal pattern) ────────────────────

function scoreColor(s: number | null) {
  if (s === null) return { fg: "#6b7280", bg: "#111420", border: "#1f2533" };
  if (s <= 2)     return { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" };
  if (s <= 3)     return { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" };
  if (s <= 5)     return { fg: "#eab308", bg: "#1a1500", border: "#3d3200" };
  return           { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" };
}

// ── Rating slider questions ──────────────────────────────────────────────────

const QUESTIONS = [
  { key: "S" as const, label: "How engaged was this session?", sublabel: "Rate the patient's participation and presence." },
  { key: "O" as const, label: "How much progress on goals this week?", sublabel: "Based on movement toward the patient's active goals." },
  { key: "T" as const, label: "How would you rate the working relationship?", sublabel: "The sense of trust, collaboration, and rapport." },
];

// ── Rating slider component ──────────────────────────────────────────────────

function RatingSlider({ label, sublabel, value, onChange }: { label: string; sublabel: string; value: number | null; onChange: (v: number) => void }) {
  const sc = scoreColor(value);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4 }}>{label}</div>
        {value !== null && (
          <span style={{ fontFamily: "'Sora', system-ui", fontSize: 20, fontWeight: 800, color: sc.fg }}>{value}</span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>{sublabel}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }} role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, i) => i).map(n => {
          const isActive = value === n;
          const c = scoreColor(n);
          return (
            <button
              key={n}
              role="radio"
              aria-checked={isActive}
              aria-label={`${n} out of 10`}
              onClick={() => onChange(n)}
              style={{
                width: 36, height: 36, borderRadius: 8,
                border: isActive ? `1px solid ${c.border}` : "1px solid rgba(255,255,255,0.1)",
                background: isActive ? c.bg : "rgba(255,255,255,0.03)",
                color: isActive ? c.fg : "rgba(255,255,255,0.25)",
                fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                cursor: "pointer", transition: "all 0.15s ease",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>0 — Not at all</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>10 — Excellent</span>
      </div>
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function TherapistRatingsForm({ caseId, weekIndex, therapistId, onClose }: TherapistRatingsFormProps) {
  const storageKey = `therapist_ratings_${caseId}_${weekIndex}`;

  const [S, setS] = useState<number | null>(null);
  const [O, setO] = useState<number | null>(null);
  const [T, setT] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  // Pre-fill from server, then fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ratings?week_index=${weekIndex}`);
        const json = await res.json();
        const rows = json?.data;
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          const r = rows[0];
          if (typeof r.s_rating === "number") setS(r.s_rating);
          if (typeof r.o_rating === "number") setO(r.o_rating);
          if (typeof r.t_rating === "number") setT(r.t_rating);
          setSubmitted(true);
          setIsEdit(false);
          return;
        }
      } catch { /* fall through to localStorage */ }

      // Fallback: localStorage
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.S === "number") setS(parsed.S);
          if (typeof parsed.O === "number") setO(parsed.O);
          if (typeof parsed.T === "number") setT(parsed.T);
          setSubmitted(true);
          setIsEdit(false);
        }
      } catch { /* noop */ }
    }
    load();
    return () => { cancelled = true; };
  }, [caseId, weekIndex, storageKey]);

  const allRated = S !== null && O !== null && T !== null;

  async function handleSubmit() {
    if (!allRated) return;
    setSubmitting(true);
    setError(null);
    try {
      // Persist to server
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_id: therapistId ?? null,
          week_index: weekIndex,
          S, O, T,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message ?? "Save failed");

      // Also store in localStorage as cache
      localStorage.setItem(storageKey, JSON.stringify({ S, O, T, savedAt: new Date().toISOString() }));

      // Trigger THS recalculation — fire and forget
      const params = new URLSearchParams({ S: String(S), O: String(O), T: String(T) });
      fetch(`/api/cases/${encodeURIComponent(caseId)}/ths?${params.toString()}`, { cache: "no-store" }).catch(() => {});

      // Dispatch storage event for cross-component reactivity
      window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));

      setSubmitted(true);
      setIsEdit(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit() {
    setSubmitted(false);
    setIsEdit(true);
  }

  // ── Confirmation state ──
  if (submitted && !isEdit) {
    return (
      <div style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", padding: 20, maxWidth: 460 }}>
        <div style={{ textAlign: "center", padding: "24px 16px" }}>
          <div style={{ fontSize: 28, color: "#4ade80" }}>{"\u2713"}</div>
          <div style={{ fontSize: 16, fontFamily: "'Sora', system-ui", fontWeight: 700, color: "#38bdf8", marginTop: 8 }}>
            Ratings saved for Week {weekIndex}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
            The Practice Health Score has been updated.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <button
              onClick={handleEdit}
              aria-label="Edit ratings"
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1f2533", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Edit ratings
            </button>
            <button
              onClick={onClose}
              aria-label="Done"
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(56,189,248,0.33)", background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.08))", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form state ──
  return (
    <div style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", padding: 20, maxWidth: 460 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Sora', system-ui", fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>Rate this session</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            Week {weekIndex} &middot; Takes about 30 seconds
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close ratings form"
          style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
        >
          &times;
        </button>
      </div>

      {/* Sliders */}
      {QUESTIONS.map(q => (
        <RatingSlider
          key={q.key}
          label={q.label}
          sublabel={q.sublabel}
          value={q.key === "S" ? S : q.key === "O" ? O : T}
          onChange={v => q.key === "S" ? setS(v) : q.key === "O" ? setO(v) : setT(v)}
        />
      ))}

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>Couldn&apos;t save: {error}</div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allRated || submitting}
        aria-label={allRated ? (isEdit ? "Update ratings" : "Save ratings") : "Rate all three to save"}
        style={{
          width: "100%", padding: "14px 28px", borderRadius: 12, marginTop: 8,
          border: "1px solid rgba(56,189,248,0.33)",
          background: allRated ? "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.08))" : "rgba(255,255,255,0.03)",
          color: allRated ? "white" : "rgba(255,255,255,0.25)",
          fontFamily: "'Sora', system-ui", fontSize: 15, fontWeight: 800,
          cursor: allRated && !submitting ? "pointer" : "not-allowed",
          opacity: !allRated ? 0.4 : submitting ? 0.6 : 1,
          transition: "all 0.15s ease",
        }}
      >
        {submitting ? "Saving\u2026" : !allRated ? "Rate all three to save" : isEdit ? "Update ratings" : "Save ratings"}
      </button>
    </div>
  );
}
