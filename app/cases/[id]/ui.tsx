// app/cases/[id]/ui.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SessionPrepCard from "@/app/components/SessionPrepCard";
import THSScoreWidget from "@/app/components/THSScoreWidget";
import TherapistRatingsForm from "@/app/components/TherapistRatingsForm";

type SourcedBullet = { text: string; source: string };

type AiSummaryResponse = {
  case_id: string;
  week_start: string;
  changes_since_last?: SourcedBullet[];
  goal_progress?: SourcedBullet[];
  barriers?: SourcedBullet[];
  session_focus?: SourcedBullet[];
  risk_signals?: SourcedBullet[];
  // legacy fields (backward compat with old API shape)
  summary?: string;
  changes?: string[];
  risks?: string[];
  next_actions?: string[];
};

type CaseContextResponse = {
  case: { id: string; title: string | null; status: string | null };
  practice: { id: string | null; name: string | null };
  therapist: { id: string; name: string | null } | null;
};

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return toYYYYMMDD(d);
}
function isYYYYMMDD(s: string | null) { return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s); }

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(typeof json?.error === "string" ? json.error : JSON.stringify(json?.error ?? json));
  }
  return json;
}

function Badge({ children, tone = "neutral" }: { children: any; tone?: "neutral" | "warn" | "bad" | "good" }) {
  const styles = {
    bad:     { bg: "#1a0808", border: "#3d1a1a", color: "#f87171" },
    warn:    { bg: "#1a1000", border: "#3d2800", color: "#fb923c" },
    good:    { bg: "#061a0b", border: "#0e2e1a", color: "#4ade80" },
    neutral: { bg: "#0d1018", border: "#1a1e2a", color: "#9ca3af" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, border: `1px solid ${styles.border}`, background: styles.bg, color: styles.color, fontSize: 12, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function SourceTag({ source }: { source: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontWeight: 700, fontFamily: "monospace",
      color: "#4b5563", background: "rgba(75,85,99,0.12)",
      border: "1px solid rgba(75,85,99,0.2)", borderRadius: 5,
      padding: "1px 6px", marginLeft: 6, whiteSpace: "nowrap" as const,
      verticalAlign: "middle" as const,
    }}>
      source: {source}
    </span>
  );
}

function AiSection({
  icon,
  label,
  color,
  items,
  loading,
}: {
  icon: string;
  label: string;
  color: string;
  items?: SourcedBullet[];
  loading: boolean;
}) {
  const bullets = items ?? [];
  return (
    <div style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderBottom: "1px solid #131720" }}>
        <span style={{ fontSize: 13, color }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" as const, color }}>{label}</span>
      </div>
      <div style={{ padding: "12px 14px" }}>
        {loading && bullets.length === 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ height: 12, width: "75%", borderRadius: 5, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
            <div style={{ height: 12, width: "60%", borderRadius: 5, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          </div>
        ) : bullets.length === 0 ? (
          <div style={{ fontSize: 13, color: "#374151" }}>—</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {bullets.map((b, i) => (
              <li key={i} style={{ fontSize: 13, color: "#c8d0e0", lineHeight: 1.55 }}>
                <span style={{ color: "#4b5563", marginRight: 6 }}>·</span>
                {b.text}
                <SourceTag source={b.source} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InlineAlert({ title, message, tone = "warn" }: { title: string; message: string; tone?: "warn" | "bad" }) {
  const bg = tone === "bad" ? "#1a0808" : "#1a1000";
  const border = tone === "bad" ? "#3d1a1a" : "#3d2800";
  const color = tone === "bad" ? "#f87171" : "#fb923c";
  return (
    <div style={{ marginTop: 12, borderRadius: 14, border: `1px solid ${border}`, background: bg, padding: 12, color }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>{title}</div>
      <div style={{ opacity: 0.95, fontSize: 13, whiteSpace: "pre-wrap" }}>{message}</div>
    </div>
  );
}

export default function CaseDetailClient({ caseId }: { caseId: string }) {
  const searchParams = useSearchParams();
  const defaultWeekStartISO = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);
  const initialWeekStart = useMemo(() => {
    const fromUrl = searchParams?.get("week_start");
    return isYYYYMMDD(fromUrl) ? (fromUrl as string) : defaultWeekStartISO;
  }, [searchParams, defaultWeekStartISO]);

  const [pickedDateISO, setPickedDateISO] = useState(initialWeekStart);
  const [weekStartISO, setWeekStartISO] = useState(initialWeekStart);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiSummaryResponse | null>(null);
  const [ctx, setCtx] = useState<CaseContextResponse | null>(null);
  const [showRatingsForm, setShowRatingsForm] = useState(false);

  const practiceIdFromCtx = ctx?.practice?.id ?? null;
  const backHref = useMemo(() => {
    if (practiceIdFromCtx) {
      return `/practices/${encodeURIComponent(practiceIdFromCtx)}/therapist-overview?week_start=${encodeURIComponent(weekStartISO)}`;
    }
    return "/practices";
  }, [practiceIdFromCtx, weekStartISO]);

  async function loadContext() {
    if (!caseId) return;
    setLoadingCtx(true);
    setCtxError(null);
    try {
      const json = await fetchJson(`/api/cases/${encodeURIComponent(caseId)}/context`);
      setCtx(json?.data ?? null);
    } catch (e: any) {
      setCtxError(e?.message ?? String(e));
      setCtx(null);
    } finally {
      setLoadingCtx(false);
    }
  }

  async function loadAi() {
    if (!caseId || !isYYYYMMDD(weekStartISO)) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const json = await fetchJson(`/api/cases/${encodeURIComponent(caseId)}/ai-summary?week_start=${encodeURIComponent(weekStartISO)}`);
      setAi(json?.data ?? null);
    } catch (e: any) {
      setAiError(e?.message ?? String(e));
      setAi(null);
    } finally {
      setLoadingAi(false);
    }
  }

  useEffect(() => { loadContext(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId]);
  useEffect(() => { loadAi(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId, weekStartISO]);

  const title = ctx?.case?.title ?? "Case";
  const status = ctx?.case?.status ?? null;
  const isUnassigned = !ctx?.therapist;
  const therapistLabel = useMemo(() => {
    if (!ctx?.therapist) return "Unassigned";
    return ctx.therapist.name ?? ctx.therapist.id;
  }, [ctx]);
  const practiceLabel = useMemo(() => {
    if (loadingCtx) return "Loading…";
    if (!ctx?.practice?.id && !ctx?.practice?.name) return "—";
    return ctx?.practice?.name ?? ctx?.practice?.id ?? "—";
  }, [ctx, loadingCtx]);

  return (
    <main style={{ padding: "40px 48px 80px", maxWidth: 1200, background: "#080c12", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        input[type="date"] { color-scheme: dark; }
      `}</style>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <Link href={backHref} style={{ textDecoration: "none", fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 0.5, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
            ← Back
          </Link>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#f1f3f8", letterSpacing: -0.4 }}>{title}</h1>
          <div style={{ marginTop: 4, fontSize: 11, color: "#374151", fontFamily: "monospace" }}>Case {caseId}</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>Week</label>
          <input type="date" value={pickedDateISO}
            onChange={(e) => { const s = e.target.value; setPickedDateISO(s); setWeekStartISO(toMondayYYYYMMDD(s)); }}
            style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid #1f2533", background: "#0d1018", color: "inherit" }}
          />
          <button onClick={loadAi} disabled={loadingAi}
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #1f2533", background: "#0d1018", color: "inherit", cursor: loadingAi ? "not-allowed" : "pointer", opacity: loadingAi ? 0.6 : 1, fontWeight: 600, fontFamily: "inherit" }}>
            {loadingAi ? "Generating…" : "↻ Refresh AI"}
          </button>
        </div>
      </div>

      {ctxError && <InlineAlert title="Context issue" message={ctxError} tone="warn" />}
      {aiError && <InlineAlert title="AI issue" message={aiError} tone="bad" />}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, alignItems: "start" }}>

        {/* ── Left column: Case context + THS ── */}
        <div style={{ display: "grid", gap: 14 }}>

        {/* ── Left: Case context ── */}
        <div style={{ borderRadius: 12, border: "1px solid #1a1e2a", background: "#0d1018", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #131720" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8 }}>Case context</div>
          </div>
          <div style={{ padding: "14px 16px", display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {status && <Badge tone="neutral">{status}</Badge>}
              <Badge tone="neutral">week {weekStartISO}</Badge>
              {isUnassigned ? <Badge tone="warn">Unassigned</Badge> : <Badge tone="good">Assigned</Badge>}
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Practice</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#c8d0e0" }}>{practiceLabel}</div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Therapist</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#c8d0e0" }}>{loadingCtx ? "Loading…" : therapistLabel}</div>
            </div>

            {isUnassigned && (
              <div style={{ borderRadius: 10, border: "1px solid #3d2800", background: "#1a1000", padding: 12 }}>
                <div style={{ fontWeight: 900, color: "#fb923c", fontSize: 13 }}>Assignment needed</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#fb923c", opacity: 0.85 }}>
                  Once assigned, therapist-level dashboards and AI prep become fully actionable.
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.6 }}>
              This panel is the facts anchor — keeps AI output grounded and helps you spot routing issues fast.
            </div>
          </div>
        </div>

        {/* ── Left below: THS Score + Ratings ── */}
        <THSScoreWidget
          caseId={caseId}
          weekIndex={null}
          onOpenRatingsForm={() => setShowRatingsForm(true)}
        />
        {showRatingsForm && (
          <TherapistRatingsForm
            caseId={caseId}
            weekIndex={1}
            onClose={() => setShowRatingsForm(false)}
          />
        )}

        </div>{/* end left column */}

        {/* ── Right: AI Session Prep ── */}
        <div style={{ display: "grid", gap: 10 }}>
          {/* Header */}
          <div style={{ borderRadius: 12, border: "1px solid #1a2240", background: "linear-gradient(160deg, #0a0e1c, #0d1018)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #3b4fd4, #6d3fc4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✦</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" }}>AI Session Prep</div>
              <div style={{ fontSize: 11, color: "#374151", marginTop: 1 }}>Generated from patient check-ins · Source-verified signals</div>
            </div>
            {loadingAi && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563" }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#6d3fc4", animation: "pulse 1.2s ease-in-out infinite" }} />
                Generating…
              </div>
            )}
          </div>

          {/* 5-section grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <AiSection icon="◈" label="Changes since last session" color="#6b82d4" items={ai?.changes_since_last} loading={loadingAi} />
            <AiSection icon="◎" label="Goal progress"              color="#00c8a0" items={ai?.goal_progress}      loading={loadingAi} />
            <AiSection icon="⊘" label="Potential barriers"         color="#fb923c" items={ai?.barriers}           loading={loadingAi} />
            <AiSection icon="◉" label="Risk signals"               color="#f87171" items={ai?.risk_signals}       loading={loadingAi} />
          </div>

          {/* Session focus — full width */}
          <AiSection icon="→" label="Suggested session focus" color="#4ade80" items={ai?.session_focus} loading={loadingAi} />

          {/* ── Structured Session Prep (new AI output) ── */}
          <SessionPrepCard caseId={caseId} weekStart={weekStartISO} />
        </div>
      </div>
    </main>
  );
}
