// docs/ui-specs/design-system-tokens.ts
// Paste into Tailwind extend config or use as CSS custom properties.
// Based on existing portal + therapist dashboard patterns.

export const colors = {
  // ── Backgrounds ──
  bg: {
    deepest: "#080810",    // page-level background
    page: "#080c12",       // therapist page bg
    card: "#0d1018",       // card/panel surface
    surface: "#111420",    // skeleton, subtle fills
    elevated: "#131720",   // inner borders, card dividers
  },

  // ── Borders ──
  border: {
    subtle: "rgba(255,255,255,0.06)",
    DEFAULT: "#1a1e2a",
    emphasis: "#1f2533",
    focus: "rgba(56,189,248,0.4)",
  },

  // ── Text ──
  text: {
    primary: "#e2e8f0",
    heading: "rgba(255,255,255,0.9)",
    secondary: "rgba(255,255,255,0.65)",
    tertiary: "rgba(255,255,255,0.45)",
    muted: "rgba(255,255,255,0.35)",
    disabled: "rgba(255,255,255,0.25)",
    faint: "rgba(255,255,255,0.2)",
  },

  // ── Primary accent (cyan/sky) ──
  accent: {
    DEFAULT: "#38bdf8",
    muted: "rgba(56,189,248,0.6)",
    bg: "rgba(56,189,248,0.08)",
    border: "rgba(56,189,248,0.25)",
  },

  // ── Trend / directional (NEVER traffic-light red/green) ──
  trend: {
    improving: { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },
    stable:    { fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240" },
    declining: { fg: "#c4b5a0", bg: "#141210", border: "#2e2820" },
    noData:    { fg: "#6b7280", bg: "#111420", border: "#1f2533" },
  },

  // ── Confidence indicators ──
  confidence: {
    high:   { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },
    medium: { fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240" },
    low:    { fg: "#d4a574", bg: "#141008", border: "#2e2418" },
  },

  // ── Semantic ──
  error:   { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" },
  warning: { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" },
  success: { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },

  // ── Reviewed gate ──
  reviewed: {
    unreviewed: { bg: "rgba(165,180,252,0.06)", border: "rgba(165,180,252,0.2)", fg: "#a5b4fc" },
    reviewed:   { bg: "rgba(74,222,128,0.06)",  border: "rgba(74,222,128,0.2)",  fg: "#4ade80" },
  },

  // ── Crisis banner (calm, not alarming) ──
  crisis: {
    bg: "rgba(56,189,248,0.06)",
    border: "rgba(56,189,248,0.2)",
    fg: "#7dd3fc",
  },
} as const;

export const typography = {
  family: {
    display: "'Sora', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
    mono: "'DM Mono', monospace",
  },
  scale: {
    display: { size: "22px", weight: 800, letterSpacing: "-0.5px", lineHeight: 1.2 },
    body:    { size: "14px", weight: 400, letterSpacing: "0",      lineHeight: 1.6 },
    label:   { size: "11px", weight: 700, letterSpacing: "1.2px",  lineHeight: 1.2, textTransform: "uppercase" as const },
    caption: { size: "12px", weight: 600, letterSpacing: "0.3px",  lineHeight: 1.5 },
  },
} as const;

export const spacing = {
  unit: 4,  // base unit in px
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

// ── Component state definitions ──
export const states = {
  interactive: {
    default: { opacity: 1, cursor: "pointer" },
    hover: { opacity: 1, cursor: "pointer", transition: "all 0.15s ease" },
    focus: { outline: `2px solid rgba(56,189,248,0.4)`, outlineOffset: 2 },
    disabled: { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" as const },
    loading: { opacity: 0.6, cursor: "wait" },
  },
  reviewGate: {
    unreviewed: {
      borderLeft: "3px solid rgba(165,180,252,0.4)",
      background: "rgba(165,180,252,0.04)",
      badge: { text: "Unreviewed", bg: "rgba(165,180,252,0.12)", fg: "#a5b4fc" },
    },
    reviewed: {
      borderLeft: "3px solid rgba(74,222,128,0.3)",
      background: "rgba(74,222,128,0.02)",
      badge: { text: "Reviewed", bg: "rgba(74,222,128,0.12)", fg: "#4ade80" },
    },
  },
} as const;
