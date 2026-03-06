// docs/ui-specs/screen-1-session-prep-detail.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1: Session Prep Detail — Component Spec
// Updates the existing case detail AI Session Prep panel (app/cases/[id]/ui.tsx)
// to consume the new SessionPrepOutput structure.
// ═══════════════════════════════════════════════════════════════════════════════
//
// This file is a SPEC — not a production component. Frontend-developer implements
// from this. All copy, props, and layout are final.

import React from "react";

// ── Data contract (from ai-engineer) ─────────────────────────────────────────

interface SessionPrepOutput {
  rating_trend: "improving" | "stable" | "declining" | "insufficient_data";
  rating_delta: number | null;
  notable_themes: string[];    // max 3
  suggested_focus: string;     // one sentence
  data_source: string;         // e.g. "from last 2 check-ins"
  confidence: "high" | "medium" | "low";
  flags: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 1: SessionPrepCard (top-level container)
// ═══════════════════════════════════════════════════════════════════════════════

interface SessionPrepCardProps {
  caseId: string;
  weekStart: string;                     // ISO date
  data: SessionPrepOutput | null;
  isLoading: boolean;
  error: string | null;
  isReviewed: boolean;
  onMarkReviewed: () => void;
  onRefresh: () => void;
}

// Layout:
//   flex-direction: column
//   gap: 12px
//   Container: border-radius 12, border 1px solid #1a1e2a, bg #0d1018
//
// Component hierarchy:
//   SessionPrepCard
//   ├── SessionPrepHeader
//   ├── RatingTrendRow
//   ├── ThemeChips
//   ├── SuggestedFocusBlock (with ReviewGate)
//   ├── ConfidenceBadge + DataSourceCitation
//   └── (states: loading skeleton, error alert, empty state)

// ── STATES ───────────────────────────────────────────────────────────────────

// Loading state:
//   Show shimmer skeleton matching the layout shape
//   Header visible (not shimmer), body is 3 shimmer bars

// Error state:
//   Card with InlineAlert (existing component from ui.tsx):
//   title: "Couldn't load session prep"
//   message: {error string}
//   tone: "warn"

// Empty state (no check-ins yet):
//   Card with centered content:
//   Icon: 📋 (emoji, 24px)
//   Heading: "No check-in data yet"  (14px, weight 700, text.secondary)
//   Body: "Once the patient completes their first check-in, session prep will appear here."
//         (13px, text.tertiary, max-width 280px, text-align center)

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 2: SessionPrepHeader
// ═══════════════════════════════════════════════════════════════════════════════

interface SessionPrepHeaderProps {
  isLoading: boolean;
  onRefresh: () => void;
}

// Layout:
//   flex-direction: row, align-items center, gap 10
//   padding: 14px 18px
//   border-bottom: 1px solid #131720
//   background: linear-gradient(160deg, #0a0e1c, #0d1018)
//
// Content:
//   Left: Icon badge (28x28, radius 8, gradient #3b4fd4→#6d3fc4, text "✦")
//   Center:
//     Title: "Session Prep" — font 12px, weight 700, #9ca3af, uppercase, ls 0.8
//     Subtitle: "Structured insights from patient check-ins" — font 11px, #374151
//   Right: Refresh button (existing pattern from ui.tsx, "↻ Refresh")
//   Far right (if loading): pulse dot + "Generating…" (existing pattern)

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 3: RatingTrendRow
// ═══════════════════════════════════════════════════════════════════════════════

interface RatingTrendRowProps {
  trend: SessionPrepOutput["rating_trend"];
  delta: number | null;
}

// Layout:
//   flex-direction: row, align-items center, gap 10, padding 14px 18px
//
// Visual treatment per trend value:
//
//   "improving":
//     Arrow: "↑" — color: trend.improving.fg (#4ade80)
//     Label: "Improving"
//     Background: trend.improving.bg (#061a0b)
//     Border: 1px solid trend.improving.border (#0e2e1a)
//     NOTE: calm green, NOT bright/alarming
//
//   "stable":
//     Arrow: "→" — color: trend.stable.fg (#a5b4fc)
//     Label: "Stable"
//     Background: trend.stable.bg (#0d0f1a)
//     Border: 1px solid trend.stable.border (#1f2240)
//     NOTE: muted indigo/periwinkle, neutral feel
//
//   "declining":
//     Arrow: "↓" — color: trend.declining.fg (#c4b5a0)
//     Label: "Declining"
//     Background: trend.declining.bg (#141210)
//     Border: 1px solid trend.declining.border (#2e2820)
//     NOTE: warm muted tan — NOT red, NOT alarming
//     This is intentional — a declining trend is information, not an emergency.
//     The therapist processes this calmly.
//
//   "insufficient_data":
//     Arrow: "—" — color: trend.noData.fg (#6b7280)
//     Label: "More data needed"
//     Background: trend.noData.bg (#111420)
//     Border: 1px solid trend.noData.border (#1f2533)
//
// Rating delta display (next to trend pill):
//   If delta !== null:
//     Text: "+2" or "-1" (with sign)
//     Font: DM Mono, 14px, weight 700
//     Color: same as trend arrow color
//   If delta === null:
//     Text: "First check-in"
//     Font: DM Mono, 12px, weight 600
//     Color: text.muted
//
// Trend pill layout:
//   Inline-flex, align-items center, gap 6
//   Padding: 6px 12px, border-radius 999 (pill)
//   Font: 13px, weight 700

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 4: ThemeChips
// ═══════════════════════════════════════════════════════════════════════════════

interface ThemeChipsProps {
  themes: string[];  // max 3
}

// Layout:
//   flex-direction: row, flex-wrap wrap, gap 8, padding 0 18px
//
// Each chip:
//   Inline-flex, padding 5px 12px, border-radius 999
//   Background: rgba(255,255,255,0.04)
//   Border: 1px solid rgba(255,255,255,0.1)
//   Color: text.secondary (rgba(255,255,255,0.65))
//   Font: 13px, weight 600
//
// Section label above chips:
//   "Key themes" — uses .label style (11px, uppercase, DM Mono, text.muted)
//
// Empty state (0 themes):
//   Show: "No patterns identified yet" — 13px, text.tertiary
//
// COPY RULE: These chips display behavioral observations like
//   "difficulty sleeping" or "increased social activity"
//   — NEVER diagnostic labels. The model is instructed accordingly,
//   but the UI should also sanitize: if a chip contains any term from
//   the banned DSM list, replace the entire chip with "Pattern noted".

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 5: SuggestedFocusBlock (with ReviewGate)
// ═══════════════════════════════════════════════════════════════════════════════

interface SuggestedFocusBlockProps {
  focus: string;
  isReviewed: boolean;
  onMarkReviewed: () => void;
}

// Layout:
//   padding: 14px 18px
//   border-radius: 10px
//   margin: 0 18px
//
// ── UNREVIEWED STATE ──
//   border-left: 3px solid rgba(165,180,252,0.4)
//   background: rgba(165,180,252,0.04)
//
//   Header row (flex, space-between):
//     Left: Label "AI-suggested focus" — font 11px, DM Mono, uppercase, #a5b4fc
//     Right: Badge [Unreviewed] — pill, bg rgba(165,180,252,0.12), fg #a5b4fc,
//            font 10px, weight 700
//
//   Body: {focus text} — font 14px, weight 500, color text.secondary, line-height 1.6
//         Slightly blurred: filter blur(2px)
//         Overlay text: "Mark as reviewed to use this suggestion"
//                       font 12px, weight 700, #a5b4fc, centered
//
//   Action: Button "Mark as reviewed"
//           Style: secondary button (border #1f2533, bg transparent, text #a5b4fc)
//           padding 8px 16px, font 12px, weight 600
//
// ── REVIEWED STATE ──
//   border-left: 3px solid rgba(74,222,128,0.3)
//   background: rgba(74,222,128,0.02)
//
//   Header row:
//     Left: Label "AI-suggested focus" — same style
//     Right: Badge [Reviewed ✓] — pill, bg rgba(74,222,128,0.12), fg #4ade80
//
//   Body: {focus text} — fully visible, no blur
//         font 14px, weight 500, color text.primary, line-height 1.6
//
// NEVER render SuggestedFocusBlock without the review gate.

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 6: ConfidenceBadge + DataSourceCitation
// ═══════════════════════════════════════════════════════════════════════════════

interface ConfidenceRowProps {
  confidence: "high" | "medium" | "low";
  dataSource: string;
}

// Layout:
//   flex-direction: row, align-items center, gap 10, padding 8px 18px 14px
//
// ConfidenceBadge:
//   Pill badge, inline-flex, padding 3px 8px, border-radius 999
//
//   "high":   bg confidence.high.bg,   border confidence.high.border,   fg confidence.high.fg
//             Text: "High confidence"
//   "medium": bg confidence.medium.bg, border confidence.medium.border, fg confidence.medium.fg
//             Text: "Medium confidence"
//   "low":    bg confidence.low.bg,    border confidence.low.border,    fg confidence.low.fg
//             Text: "Low confidence"
//             TOOLTIP (on hover/tap):
//               "Based on fewer than 2 check-ins — more data needed for reliable trends."
//               bg #1a1e2a, border #1f2533, padding 8px 12px, radius 8
//               font 12px, weight 500, color text.secondary, max-width 240px
//
// DataSourceCitation (to the right of badge):
//   Text: {dataSource} — e.g. "from last 2 check-ins"
//   Font: DM Mono, 11px, weight 500, color text.muted
//   Always visible.

// ═══════════════════════════════════════════════════════════════════════════════
// FULL COMPONENT TREE
// ═══════════════════════════════════════════════════════════════════════════════
//
//   <SessionPrepCard>
//     <SessionPrepHeader />
//     {isLoading ? <SkeletonBody /> :
//      error ? <InlineAlert title="Couldn't load session prep" message={error} /> :
//      !data ? <EmptyState /> :
//      <>
//        <RatingTrendRow trend={data.rating_trend} delta={data.rating_delta} />
//        <ThemeChips themes={data.notable_themes} />
//        <SuggestedFocusBlock
//          focus={data.suggested_focus}
//          isReviewed={isReviewed}
//          onMarkReviewed={onMarkReviewed}
//        />
//        <ConfidenceRow confidence={data.confidence} dataSource={data.data_source} />
//      </>
//     }
//   </SessionPrepCard>

// ═══════════════════════════════════════════════════════════════════════════════
// ALL COPY
// ═══════════════════════════════════════════════════════════════════════════════
export const COPY = {
  header: {
    title: "Session Prep",
    subtitle: "Structured insights from patient check-ins",
    refreshButton: "↻ Refresh",
    generatingLabel: "Generating…",
  },
  trend: {
    improving: "Improving",
    stable: "Stable",
    declining: "Declining",
    insufficient_data: "More data needed",
    firstCheckin: "First check-in",
  },
  themes: {
    sectionLabel: "Key themes",
    empty: "No patterns identified yet",
    fallbackChip: "Pattern noted",  // used if DSM term slips through
  },
  focus: {
    label: "AI-suggested focus",
    unreviewedBadge: "Unreviewed",
    reviewedBadge: "Reviewed ✓",
    unreviewedOverlay: "Mark as reviewed to use this suggestion",
    markReviewedButton: "Mark as reviewed",
  },
  confidence: {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    lowTooltip: "Based on fewer than 2 check-ins — more data needed for reliable trends.",
  },
  empty: {
    icon: "📋",
    heading: "No check-in data yet",
    body: "Once the patient completes their first check-in, session prep will appear here.",
  },
  error: {
    title: "Couldn't load session prep",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// API INTEGRATION NOTES
// ═══════════════════════════════════════════════════════════════════════════════
//
// Endpoint: POST /api/cases/{caseId}/session-prep
// No request body needed — the route fetches check-in data server-side.
//
// Response: { data: SessionPrepOutput, error: null }
//
// The "reviewed" state is CLIENT-SIDE only for pilot.
// Store in localStorage: `sessionprep-reviewed-${caseId}-${weekStart}`
// Future: persist to a `reviewed_artifacts` table.
//
// BACKEND FLAG: The route currently also supports the legacy { prompt, stream }
// request shape for backward compatibility. The new flow sends an empty POST
// body and receives structured SessionPrepOutput. Frontend should use the new
// shape exclusively.
