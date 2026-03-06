// docs/ui-specs/screen-2-ths-score-widget.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2: THS Score Widget — Component Spec
// New widget placed on Therapist Home / Case Detail page.
// ═══════════════════════════════════════════════════════════════════════════════

import React from "react";

// ── Data contract (from ai-engineer) ─────────────────────────────────────────

interface THSOutput {
  score: number;                          // 0–10, one decimal
  components: { W: number; S: number; O: number; T: number };
  confidence: "high" | "medium" | "low";
  narrative: string | null;               // 2–3 sentences
  week_index: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 1: THSScoreWidget (top-level)
// ═══════════════════════════════════════════════════════════════════════════════

interface THSScoreWidgetProps {
  caseId: string;
  data: THSOutput | null;
  isLoading: boolean;
  error: string | null;
  isReviewed: boolean;
  onMarkReviewed: () => void;
  /** True if S, O, or T are still at 0 (not yet submitted by therapist) */
  hasPendingRatings: boolean;
  onOpenRatingsForm: () => void;
}

// Layout:
//   border-radius: 12px
//   border: 1px solid #1a1e2a
//   background: #0d1018
//   padding: 0 (inner components handle padding)
//   max-width: 380px (sidebar widget) or 100% (full-width in case detail)
//
// Component hierarchy:
//   THSScoreWidget
//   ├── THSHeader
//   ├── ScoreDisplay
//   ├── ComponentBreakdown
//   ├── NarrativeBlock (with ReviewGate)
//   ├── PendingRatingsPrompt (conditional)
//   └── (states: loading, error, partial, low-confidence)

// ── STATES ───────────────────────────────────────────────────────────────────

// Loading:
//   THSHeader visible
//   Body: large circle shimmer (64px) + 4 bar shimmers (for components)
//   Narrative: 2-line shimmer

// Error:
//   InlineAlert: title "Couldn't load score", tone "warn"

// Partial (missing therapist ratings):
//   Score still displays (using 0 for missing components)
//   ComponentBreakdown shows pending state for missing items
//   PendingRatingsPrompt visible below components

// Low-confidence:
//   Score displays with muted treatment
//   ConfidenceBadge shows "Low confidence" with notice

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 2: THSHeader
// ═══════════════════════════════════════════════════════════════════════════════

// Layout:
//   flex-direction: row, align-items center, gap 8
//   padding: 12px 16px
//   border-bottom: 1px solid #131720
//
// Content:
//   Label: "Practice Health Score" — font 11px, DM Mono, uppercase, ls 0.8, #9ca3af
//   NEVER: "Patient Health Score", "Diagnostic Score", "Clinical Score"
//   Right: Week label "Week {week_index}" — pill badge, bg #111420, border #1f2533,
//          font 11px, DM Mono, weight 700, #6b7280
//   If week_index is null: show "Current" instead

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 3: ScoreDisplay
// ═══════════════════════════════════════════════════════════════════════════════

interface ScoreDisplayProps {
  score: number;
  confidence: "high" | "medium" | "low";
}

// Layout:
//   flex-direction: column, align-items center, padding 20px 16px 12px
//
// Score number:
//   Font: Sora, 42px, weight 900, letter-spacing -1px
//   Color: Based on score range (matches existing scoreColor pattern):
//     0–3:  #f87171 (red — this is score quality, not trend direction)
//     3–5:  #fb923c (orange)
//     5–7:  #eab308 (yellow)
//     7–10: #4ade80 (green)
//
//   Format: one decimal place always — "7.8", "5.0", "10.0"
//
//   Below score: "/10" — font 14px, DM Mono, weight 600, text.muted
//
// ConfidenceBadge (directly below score, centered):
//   Same spec as Screen 1 ConfidenceBadge
//   If "low": add notice text below badge:
//     "Score based on partial data — component ratings pending."
//     Font: 12px, weight 500, color confidence.low.fg, text-align center
//     max-width: 260px

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 4: ComponentBreakdown
// ═══════════════════════════════════════════════════════════════════════════════

interface ComponentBreakdownProps {
  components: { W: number; S: number; O: number; T: number };
  /** Which components have been submitted by therapist (S, O, T) */
  submitted: { S: boolean; O: boolean; T: boolean };
}

// Layout:
//   display: grid, grid-template-columns: repeat(4, 1fr), gap 8
//   padding: 0 16px 16px
//
// Each component cell:
//   border-radius: 10px
//   border: 1px solid #1a1e2a
//   background: #111420
//   padding: 10px
//   text-align: center
//
//   Value: font Sora, 18px, weight 800
//          Color: same scoreColor logic as main score
//   Label: font 10px, DM Mono, weight 600, uppercase, ls 0.6
//          Color: text.muted
//
// Component labels (plain, non-clinical):
//   W: "Wellbeing"          — subtext: "from check-ins"
//   S: "Engagement"         — subtext: "therapist-rated"
//   O: "Goal Progress"      — subtext: "therapist-rated"
//   T: "Alliance"           — subtext: "therapist-rated"
//
//   Subtext: font 9px, weight 500, text.faint, below label
//
// Pending state (S, O, or T not submitted):
//   Value: "—" in text.disabled color
//   Label: normal
//   Border: 1px dashed rgba(165,180,252,0.25)
//   Background: rgba(165,180,252,0.02)

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 5: NarrativeBlock (with ReviewGate)
// ═══════════════════════════════════════════════════════════════════════════════

interface NarrativeBlockProps {
  narrative: string | null;
  isReviewed: boolean;
  onMarkReviewed: () => void;
}

// Layout:
//   padding: 0 16px 16px
//
// Inner block:
//   Same ReviewGate pattern as SessionPrep SuggestedFocusBlock
//   border-radius: 10px
//   padding: 14px
//
// Section label: "Score summary"
//   NEVER: "AI analysis", "Clinical insight", "AI interpretation"
//   Font: 11px, DM Mono, uppercase, text.muted
//
// Narrative text: 14px, weight 400, color text.secondary, line-height 1.65
//
// If narrative is null:
//   Show: "Narrative unavailable — score computed from partial data."
//   Font: 13px, weight 500, text.tertiary
//
// ReviewGate: same unreviewed/reviewed visual treatment as Screen 1

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 6: PendingRatingsPrompt
// ═══════════════════════════════════════════════════════════════════════════════

interface PendingRatingsPromptProps {
  onOpenRatingsForm: () => void;
}

// Visibility: only when hasPendingRatings === true
//
// Layout:
//   margin: 0 16px 16px
//   padding: 12px 14px
//   border-radius: 10px
//   border: 1px dashed rgba(165,180,252,0.25)
//   background: rgba(165,180,252,0.03)
//   display: flex, align-items center, gap 10
//
// Icon: "📝" — font 16px
// Text: "Rate this session to complete the score"
//        Font: 13px, weight 600, color #a5b4fc
// Action: Clickable — entire row is a button (cursor pointer)
//         Hover: background rgba(165,180,252,0.06)
//
// Clicking opens the TherapistRatingsForm (Screen 3).

// ═══════════════════════════════════════════════════════════════════════════════
// ALL COPY
// ═══════════════════════════════════════════════════════════════════════════════
export const COPY = {
  header: {
    title: "Practice Health Score",
    weekPrefix: "Week",
    weekCurrent: "Current",
  },
  score: {
    suffix: "/10",
    lowConfidenceNotice: "Score based on partial data — component ratings pending.",
  },
  components: {
    W: { label: "Wellbeing",      sub: "from check-ins" },
    S: { label: "Engagement",     sub: "therapist-rated" },
    O: { label: "Goal Progress",  sub: "therapist-rated" },
    T: { label: "Alliance",       sub: "therapist-rated" },
    pendingValue: "—",
  },
  narrative: {
    sectionLabel: "Score summary",
    unavailable: "Narrative unavailable — score computed from partial data.",
  },
  pendingPrompt: {
    icon: "📝",
    text: "Rate this session to complete the score",
  },
  confidence: {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    lowTooltip: "Based on fewer than 2 check-ins — more data needed for reliable trends.",
  },
  error: {
    title: "Couldn't load score",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// API INTEGRATION NOTES
// ═══════════════════════════════════════════════════════════════════════════════
//
// Endpoint: GET /api/cases/{caseId}/ths?S=7&O=8&T=6&narrative=true
//
// For pilot: S, O, T come from the TherapistRatingsForm (Screen 3) and are
// passed as query params. W is computed server-side from check-ins.
//
// Response: { data: THSOutput, error: null }
//
// "Reviewed" state: localStorage `ths-reviewed-${caseId}-${weekIndex}`
//
// hasPendingRatings: True when any of S, O, T are not yet stored locally
// for this caseId+week. Check localStorage `therapist-ratings-${caseId}-${weekIndex}`.
//
// ── BACKEND FLAG ──
// The THS endpoint currently accepts S, O, T as query params. For GA,
// these should come from a `therapist_session_ratings` table.
// Backend needs: POST /api/cases/{caseId}/ratings endpoint to persist
// S, O, T per week. This is flagged for the backend-architect.
