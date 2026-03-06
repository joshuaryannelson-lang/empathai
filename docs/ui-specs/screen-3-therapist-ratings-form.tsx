// docs/ui-specs/screen-3-therapist-ratings-form.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3: Therapist Ratings Form — Component Spec
// New form for therapists to submit S, O, T component ratings per case per week.
// Designed to complete in under 60 seconds.
// ═══════════════════════════════════════════════════════════════════════════════

import React from "react";

// ── Data contract ────────────────────────────────────────────────────────────

interface TherapistRatings {
  S: number;   // Session engagement, 0–10
  O: number;   // Outcome progress, 0–10
  T: number;   // Therapeutic alliance, 0–10
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 1: TherapistRatingsForm (top-level)
// ═══════════════════════════════════════════════════════════════════════════════

interface TherapistRatingsFormProps {
  caseId: string;
  weekIndex: number;
  /** Pre-filled if editing a previously submitted rating */
  initialValues: Partial<TherapistRatings> | null;
  onSubmit: (ratings: TherapistRatings) => void;
  isSubmitting: boolean;
  submitError: string | null;
  /** True after successful save */
  isSubmitted: boolean;
  onEdit: () => void;       // re-enter edit mode after submission
  onClose: () => void;      // dismiss form (back to case detail)
}

// Layout:
//   Presented as: modal overlay OR inline panel within case detail
//   Recommended: inline panel below THSScoreWidget (avoids modal fatigue)
//
//   Container:
//     border-radius: 12px
//     border: 1px solid #1a1e2a
//     background: #0d1018
//     padding: 20px
//     max-width: 460px
//
// Component hierarchy:
//   TherapistRatingsForm
//   ├── FormHeader
//   ├── RatingSlider × 3 (S, O, T)
//   ├── SubmitButton
//   ├── ConfirmationState (post-submit)
//   └── ErrorDisplay

// ── STATES ───────────────────────────────────────────────────────────────────

// Empty state:
//   All 3 sliders at null (no selection yet)
//   Submit button disabled
//   Header shows "Week {N}" context

// In-progress:
//   1–2 sliders have values, at least one still null
//   Submit button disabled
//   Completed sliders show their value prominently

// Submitted:
//   Form replaced with ConfirmationState
//   Shows "Ratings saved for Week {N}"
//   Edit button available

// Edit mode:
//   Same as in-progress but pre-filled with previous values
//   Submit button label: "Update ratings"

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 2: FormHeader
// ═══════════════════════════════════════════════════════════════════════════════

// Layout:
//   margin-bottom: 20px
//
// Content:
//   Title: "Rate this session" — font Sora, 18px, weight 800, text.heading
//   Subtitle: "Week {weekIndex} · Takes about 30 seconds"
//             Font: 12px, DM Mono, weight 500, text.muted
//   Close button (top-right): "×" — font 18px, text.tertiary, hover text.secondary

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 3: RatingSlider
// ═══════════════════════════════════════════════════════════════════════════════

interface RatingSliderProps {
  label: string;         // question text
  sublabel: string;      // helper text
  value: number | null;
  onChange: (value: number) => void;
}

// Layout:
//   margin-bottom: 20px
//
// Question label:
//   Font: 14px, weight 600, color text.primary, line-height 1.4
//   Margin-bottom: 6px
//
// Sublabel:
//   Font: 12px, weight 500, color text.tertiary
//   Margin-bottom: 12px
//
// Control: Segmented button row (0–10), similar to check-in score buttons
//   Display: flex, gap 4, flex-wrap wrap
//
//   Each segment:
//     Width: 36px, Height: 36px (slightly smaller than check-in's 44px)
//     Border-radius: 8px
//     Font: DM Mono, 12px, weight 700
//
//     Unselected:
//       Background: rgba(255,255,255,0.03)
//       Border: 1px solid rgba(255,255,255,0.1)
//       Color: text.disabled
//
//     Selected:
//       Background: scored color bg (same scoreColor pattern from check-in)
//       Border: 1px solid scored color border
//       Color: scored color fg
//       Transition: all 0.15s ease
//
//     Hover (unselected):
//       Background: rgba(255,255,255,0.06)
//       Border: 1px solid rgba(255,255,255,0.15)
//
//   End labels (below the row):
//     Left: "0 — Not at all" — font 10px, text.faint
//     Right: "10 — Excellent" — font 10px, text.faint
//     Display: flex, justify-content space-between
//
// Current value display (when selected):
//   To the right of the question label
//   Large: font Sora, 20px, weight 800
//   Color: scored color fg
//   Format: just the number, e.g. "7"

// ── Questions (exact copy) ──

// S — Session Engagement:
//   label: "How engaged was this session?"
//   sublabel: "Rate the patient's participation and presence."
//
// O — Outcome Progress:
//   label: "How much progress on goals this week?"
//   sublabel: "Based on movement toward the patient's active goals."
//
// T — Therapeutic Alliance:
//   label: "How would you rate the working relationship?"
//   sublabel: "The sense of trust, collaboration, and rapport."

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 4: SubmitButton
// ═══════════════════════════════════════════════════════════════════════════════

// Layout:
//   margin-top: 8px
//   width: 100%
//
// Button:
//   Uses .btn-primary pattern (existing)
//   padding: 14px 28px
//   font: Sora, 15px, weight 800
//
// States:
//   Disabled (not all 3 rated):
//     Label: "Rate all three to save"
//     Opacity: 0.4
//
//   Enabled (all 3 rated):
//     Label: "Save ratings"
//     Full opacity
//
//   Submitting:
//     Label: "Saving…"
//     Opacity: 0.6, cursor: wait
//
//   Edit mode:
//     Label: "Update ratings"

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT 5: ConfirmationState
// ═══════════════════════════════════════════════════════════════════════════════

// Replaces the form body after successful submit.
//
// Layout:
//   text-align: center, padding: 24px 16px
//
// Content:
//   Checkmark: "✓" — font 28px, color success.fg (#4ade80)
//   Heading: "Ratings saved for Week {weekIndex}"
//            Font: 16px, Sora, weight 700, color accent.DEFAULT
//   Subtext: "The Practice Health Score has been updated."
//            Font: 13px, weight 500, text.tertiary
//            margin-top: 6px
//
// Actions (flex row, gap 10, justify center, margin-top 16px):
//   Edit button:
//     Label: "Edit ratings"
//     Style: secondary (border #1f2533, bg transparent, text text.tertiary)
//     font: 12px, weight 600
//   Done button:
//     Label: "Done"
//     Style: primary accent
//     font: 12px, weight 600

// ═══════════════════════════════════════════════════════════════════════════════
// ALL COPY
// ═══════════════════════════════════════════════════════════════════════════════
export const COPY = {
  header: {
    title: "Rate this session",
    subtitle: (week: number) => `Week ${week} · Takes about 30 seconds`,
  },
  sliders: {
    S: {
      label: "How engaged was this session?",
      sublabel: "Rate the patient's participation and presence.",
    },
    O: {
      label: "How much progress on goals this week?",
      sublabel: "Based on movement toward the patient's active goals.",
    },
    T: {
      label: "How would you rate the working relationship?",
      sublabel: "The sense of trust, collaboration, and rapport.",
    },
    scaleMin: "0 — Not at all",
    scaleMax: "10 — Excellent",
  },
  submit: {
    disabled: "Rate all three to save",
    enabled: "Save ratings",
    submitting: "Saving…",
    editMode: "Update ratings",
  },
  confirmation: {
    checkmark: "✓",
    heading: (week: number) => `Ratings saved for Week ${week}`,
    subtext: "The Practice Health Score has been updated.",
    editButton: "Edit ratings",
    doneButton: "Done",
  },
  error: {
    prefix: "Couldn't save: ",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// API INTEGRATION NOTES
// ═══════════════════════════════════════════════════════════════════════════════
//
// ── PILOT (current) ──
// Therapist ratings are stored CLIENT-SIDE in localStorage:
//   Key: `therapist-ratings-${caseId}-${weekIndex}`
//   Value: JSON.stringify({ S: number, O: number, T: number, savedAt: ISO })
//
// When ratings exist, the THSScoreWidget passes them as query params:
//   GET /api/cases/{caseId}/ths?S=7&O=8&T=6
//
// Edit is allowed until end of week (Sunday 23:59 local time).
//
// ── GA (future) ──
// Backend needs:
//   POST /api/cases/{caseId}/ratings
//   Body: { week_index: number, S: number, O: number, T: number }
//   Table: therapist_session_ratings (case_id, week_index, S, O, T, created_at, updated_at)
//   GET /api/cases/{caseId}/ratings?week_index=4 to pre-fill
//
// ── BACKEND FLAG ──
// This endpoint does not exist yet. Flagged for backend-architect.
// For pilot, localStorage is sufficient (single device per therapist).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
//
// This form appears in one of two places:
//
// 1. INLINE in Case Detail page (below THSScoreWidget):
//    Triggered by clicking PendingRatingsPrompt or "Edit ratings"
//    Animated slide-down, same card styling as adjacent widgets
//
// 2. SIDEBAR panel on Therapist Overview page:
//    When therapist clicks a case row, ratings form appears in right panel
//    alongside the THSScoreWidget
//
// For pilot: option 1 (inline) is simpler and recommended.
