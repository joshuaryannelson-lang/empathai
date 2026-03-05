// app/cases/[id]/ui.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type AiSummaryResponse = {
  case_id: string;
  week_start: string;
  summary: string;
  changes?: string[];
  risks?: string[];
  next_actions?: string[];
};

type CaseContextResponse = {
  case: { id: string; title: string | null; status: string | null };
  practice: { id: string | null; name: string | null };
  therapist: { id: string; name: string | null } | null;
};

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return toYYYYMMDD(d);
}

function isYYYYMMDD(s: string | null) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(typeof json?.error === "string" ? json.error : JSON.stringify(json?.error ?? json));
  }
  return json;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: any;
  tone?: "neutral" | "warn" | "bad" | "good";
}) {
  const bg =
    tone === "bad"
      ? "#1a0808"
      : tone === "warn"
      ? "#1a1000"
      : tone === "good"
      ? "#061a0b"
      : "#0d1018";

  const border =
    tone === "bad"
      ? "#3d1a1a"
      : tone === "warn"
      ? "#3d2800"
      : tone === "good"
      ? "#0e2e1a"
      : "#1a1e2a";

  const color =
    tone === "bad"
      ? "#f87171"
      : tone === "warn"
      ? "#fb923c"
      : tone === "good"
      ? "#4ade80"
      : "#9ca3af";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section
      style={{
        border: "1px solid #1a1e2a",
        borderRadius: 12,
        padding: 14,
        background: "#0d1018",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function BulletList({ items }: { items?: string[] }) {
  const list = (items ?? []).filter(Boolean);
  if (!list.length) return <div style={{ opacity: 0.65 }}>—</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, opacity: 0.9 }}>
      {list.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function InlineAlert({
  title,
  message,
  tone = "warn",
}: {
  title: string;
  message: string;
  tone?: "warn" | "bad";
}) {
  const bg = tone === "bad" ? "#1a0808" : "#1a1000";
  const border = tone === "bad" ? "#3d1a1a" : "#3d2800";
  const color = tone === "bad" ? "#f87171" : "#fb923c";

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 14,
        border: `1px solid ${border}`,
        background: bg,
        padding: 12,
        color,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 4 }}>{title}</div>
      <div style={{ opacity: 0.95, fontSize: 13, whiteSpace: "pre-wrap" }}>{message}</div>
    </div>
  );
}

export default function CaseDetailClient({ caseId }: { caseId: string }) {
  const searchParams = useSearchParams();

  const defaultWeekStartISO = useMemo(() => {
    const todayISO = toYYYYMMDD(new Date());
    return toMondayYYYYMMDD(todayISO);
  }, []);

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
      // tiny demo delay (optional)
      await new Promise((r) => setTimeout(r, 350));

      const json = await fetchJson(
        `/api/cases/${encodeURIComponent(caseId)}/ai-summary?week_start=${encodeURIComponent(weekStartISO)}`
      );

      setAi(json?.data ?? null);
    } catch (e: any) {
      setAiError(e?.message ?? String(e));
      setAi(null);
    } finally {
      setLoadingAi(false);
    }
  }

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    loadAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, weekStartISO]);

  async function copySummary() {
    const text = ai?.summary ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

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
    <main style={{ padding: 40, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link href={backHref} style={{ textDecoration: "none", opacity: 0.9 }}>
          ← Back
        </Link>

        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <div style={{ opacity: 0.6, fontSize: 12 }}>
            Case ID: <span style={{ fontFamily: "monospace" }}>{caseId}</span>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.75 }}>Week</label>
          <input
            type="date"
            value={pickedDateISO}
            onChange={(e) => {
              const selected = e.target.value;
              setPickedDateISO(selected);
              setWeekStartISO(toMondayYYYYMMDD(selected));
            }}
            style={{
              padding: "9px 10px",
              borderRadius: 9,
              border: "1px solid #1f2533",
              background: "transparent",
              color: "inherit",
            }}
          />

          <button
            onClick={loadAi}
            disabled={loadingAi}
            style={{
              padding: "9px 14px",
              borderRadius: 9,
              border: "1px solid #1f2533",
              background: "transparent",
              color: "inherit",
              cursor: loadingAi ? "not-allowed" : "pointer",
              opacity: loadingAi ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            {loadingAi ? "Generating…" : "Generate / Refresh"}
          </button>

          <button
            onClick={copySummary}
            disabled={!ai?.summary}
            style={{
              padding: "9px 14px",
              borderRadius: 9,
              border: "1px solid #1f2533",
              background: "#0d1018",
              color: "inherit",
              cursor: !ai?.summary ? "not-allowed" : "pointer",
              opacity: !ai?.summary ? 0.6 : 1,
              fontWeight: 900,
            }}
          >
            Copy summary
          </button>
        </div>
      </div>

      {/* Error callouts */}
      {ctxError && <InlineAlert title="Context issue" message={ctxError} tone="warn" />}
      {aiError && <InlineAlert title="AI issue" message={aiError} tone="bad" />}

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "0.9fr 1.4fr", gap: 12 }}>
        {/* Left column: context */}
        <Section title="Case context">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {status && <Badge tone="neutral">{status}</Badge>}
              <Badge tone="neutral">week {weekStartISO}</Badge>
              {isUnassigned ? <Badge tone="warn">Unassigned</Badge> : <Badge tone="good">Assigned</Badge>}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 800 }}>Practice</div>
              <div style={{ fontWeight: 900 }}>{practiceLabel}</div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 800 }}>Therapist</div>
              <div style={{ fontWeight: 900 }}>{loadingCtx ? "Loading…" : therapistLabel}</div>
            </div>

            {isUnassigned && (
              <div
                style={{
                  marginTop: 6,
                  borderRadius: 10,
                  border: "1px solid #3d2800",
                  background: "#1a1000",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900, color: "#fb923c" }}>Assignment needed</div>
                <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13, color: "#fb923c" }}>
                  This case isn’t routed yet. Once assigned, therapist-level dashboards and outreach workflows become much more useful.
                </div>
              </div>
            )}

            <div style={{ opacity: 0.7, fontSize: 12 }}>
              This panel is the “facts” anchor. It keeps the AI output grounded and helps you spot routing bugs fast.
            </div>
          </div>
        </Section>

        {/* Right column: AI */}
        <div style={{ display: "grid", gap: 12 }}>
          <Section title="AI summary">
            <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.4 }}>
              {ai?.summary ?? (loadingAi ? "Generating…" : "—")}
            </div>
          </Section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Section title="Changes">
              <BulletList items={ai?.changes} />
            </Section>
            <Section title="Risks / watchouts">
              <BulletList items={ai?.risks} />
            </Section>
          </div>

          <Section title="Next actions">
            <BulletList items={ai?.next_actions} />
          </Section>
        </div>
      </div>
    </main>
  );
}