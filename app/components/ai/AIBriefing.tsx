// app/components/ai/AIBriefing.tsx
// Structured AI briefing component — matches the visual language of
// /cases/[id] session prep. Labeled sections, clear hierarchy, scannable.
"use client";

// ── Design tokens ─────────────────────────────────────────────────────────────
const CARD_BG = "#0d1018";
const CARD_BORDER = "#1a2035";
const ACCENT = "#6b82d4";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "#94a3b8";

// ── Types ────────────────────────────────────────────────────────────────────
export interface AIBriefingData {
  priorityAlerts: Array<{
    firstName: string;
    score: number;
    note: string;
    recommendation: string;
  }>;
  positiveSignals: Array<{
    firstName: string;
    scoreTrend: string;
    detail: string;
  }>;
  stable: Array<{
    firstName: string;
    score: number;
    flag?: "missing" | null;
  }>;
  recommendedActions: string[];
  weekOf: string;
}

export interface AIBriefingProps {
  briefing: AIBriefingData | null;
  isLoading?: boolean;
  onRegenerate?: () => void;
  context?: "therapist" | "manager" | "owner";
}

// ── Shimmer skeleton ─────────────────────────────────────────────────────────
function Shimmer({ width = "100%", height = 14 }: { width?: string | number; height?: number }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 4,
      background: "linear-gradient(90deg,#1a2035 0%,#242d45 50%,#1a2035 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

function ShimmerSection() {
  return (
    <div style={{ padding: "14px 18px", display: "grid", gap: 10 }}>
      <Shimmer width="40%" height={10} />
      <Shimmer width="85%" />
      <Shimmer width="70%" />
    </div>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: CARD_BORDER }} />;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AIBriefing({ briefing, isLoading, onRegenerate, context = "therapist" }: AIBriefingProps) {
  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${CARD_BORDER}`,
      background: CARD_BG,
      overflow: "hidden",
      fontFamily: "'DM Sans', system-ui",
    }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @media (max-width: 640px) { .ai-briefing-date { display: none !important; } }
      `}</style>

      {/* 2px accent bar top */}
      <div style={{ height: 2, background: ACCENT }} />

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        borderBottom: `1px solid ${CARD_BORDER}`,
        flexWrap: "nowrap",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>✦</span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: TEXT_SECONDARY,
          }}>
            AI Briefing
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {briefing && (
            <span className="ai-briefing-date" style={{ fontSize: 11, color: "#4b5563", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
              Week of {briefing.weekOf}
            </span>
          )}
          {onRegenerate && !isLoading && (
            <button
              onClick={onRegenerate}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#4b5563",
                background: "none",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui",
                transition: "all .15s",
                whiteSpace: "nowrap",
              }}
            >
              ↺ Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && !briefing && (
        <>
          <ShimmerSection />
          <Divider />
          <ShimmerSection />
          <Divider />
          <ShimmerSection />
          <Divider />
          <ShimmerSection />
        </>
      )}

      {/* Briefing content */}
      {briefing && (
        <>
          {/* PRIORITY ATTENTION */}
          {briefing.priorityAlerts.length > 0 && (
            <>
              <div style={{ padding: "14px 18px" }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "#f87171",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span>⚠</span> Priority Attention
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {briefing.priorityAlerts.map((alert, i) => (
                    <div key={i} style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700 }}>{alert.firstName}</span>
                      <span style={{ color: TEXT_SECONDARY }}> — score dropped to {alert.score}</span>
                      {alert.note && (
                        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
                          Note: {alert.note}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: ACCENT, marginTop: 2 }}>
                        → {alert.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* POSITIVE SIGNALS */}
          {briefing.positiveSignals.length > 0 && (
            <>
              <div style={{ padding: "14px 18px" }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "#4ade80",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span>↑</span> Positive Signals
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {briefing.positiveSignals.map((signal, i) => (
                    <div key={i} style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700 }}>{signal.firstName}</span>
                      <span style={{ color: TEXT_SECONDARY }}> — {signal.scoreTrend}. {signal.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* STABLE */}
          {briefing.stable.length > 0 && (
            <>
              <div style={{ padding: "14px 18px" }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: TEXT_SECONDARY,
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span>→</span> Stable
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {briefing.stable.map((s, i) => (
                    <span key={i} style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                      {s.firstName} · {s.score}
                      {s.flag === "missing" && (
                        <span style={{ color: "#fb923c", marginLeft: 4 }}>· missing check-in</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* RECOMMENDED ACTIONS */}
          {briefing.recommendedActions.length > 0 && (
            <div style={{ padding: "14px 18px" }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: ACCENT,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span>💡</span> Recommended Actions
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {briefing.recommendedActions.map((action, i) => (
                  <li key={i} style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.6 }}>
                    <span style={{ color: TEXT_SECONDARY, marginRight: 6 }}>•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && !briefing && (
        <div style={{ padding: "24px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#374151" }}>
            No briefing data available. Click regenerate to generate a new briefing.
          </div>
        </div>
      )}
    </div>
  );
}
