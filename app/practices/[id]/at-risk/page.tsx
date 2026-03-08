// app/practices/[id]/at-risk/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SkeletonPage } from "@/app/components/ui/Skeleton";

type AtRiskRow = {
  case_id: string;
  case_title: string;
  therapist_id: string | null;
  therapist_name: string | null;

  week_checkins: number;
  week_avg_score: number | null;
  week_min_score: number | null;

  last_checkin_at: string | null;
  last_score: number | null;
};

type ApiResponse = {
  practice_id: string;
  week_start: string;
  queue: AtRiskRow[];
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

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(JSON.stringify(json?.error ?? json));
  return json;
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "warn" | "neutral";
}) {
  const styles: Record<string, any> = {
    danger: {
      background: "#1a0808",
      border: "1px solid #3d1a1a",
      color: "#f87171",
    },
    warn: {
      background: "#1a1000",
      border: "1px solid #3d2800",
      color: "#fb923c",
    },
    neutral: {
      background: "#0d1018",
      border: "1px solid #1a1e2a",
      color: "#9ca3af",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.2,
        ...styles[tone],
      }}
    >
      {label}
    </span>
  );
}

function PracticeAtRiskPage() {
  const params = useParams();
  const search = useSearchParams();

  const practiceId = params?.id as string;

  const defaultWeekStartISO = useMemo(() => {
    return toMondayYYYYMMDD(toYYYYMMDD(new Date()));
  }, []);

  const initialWeek = useMemo(() => {
    const fromUrl = search?.get("week_start");
    return fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl) ? fromUrl : defaultWeekStartISO;
  }, [search, defaultWeekStartISO]);

  const [pickedDateISO, setPickedDateISO] = useState(initialWeek);
  const [weekStartISO, setWeekStartISO] = useState(initialWeek);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);


  async function load() {
    if (!practiceId) return;

    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson(
        `/api/practices/${encodeURIComponent(practiceId)}/at-risk?week_start=${encodeURIComponent(weekStartISO)}`
      );
      setData(json.data ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId, weekStartISO]);

  const queue = data?.queue ?? [];

  return (
    <main style={{ padding: "40px 20px" }}>
      <style>{`
        @media (max-width: 767px) {
          .atrisk-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .atrisk-table > div { min-width: 600px; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link href={`/practices/${practiceId}/therapist-overview?week_start=${encodeURIComponent(weekStartISO)}`} style={{ opacity: 0.9 }}>
          ← Back to Manager
        </Link>

        <h1 style={{ margin: 0 }}>At-Risk Queue</h1>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
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
              padding: 10,
              borderRadius: 9,
              border: "1px solid #1f2533",
              background: "transparent",
              color: "inherit",
            }}
          />
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 9,
              border: "1px solid #1f2533",
              background: "transparent",
              color: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
        Cases with any check-in score ≤ 3 for the selected week — sorted worst-first. Each row is one patient case.
      </div>

      {error && (
        <pre className="error-box">{error}</pre>
      )}

      {/* Summary */}
      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Badge label={`At-risk cases: ${queue.length}`} tone={queue.length ? "danger" : "neutral"} />
        <Badge label="Definition: any score ≤ 3" tone="neutral" />
      </div>

      {/* Table */}
      <div className="atrisk-table" style={{ marginTop: 22 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 1.4fr 1fr 1fr 1.4fr 1fr",
            padding: "10px 12px",
            borderBottom: "1px solid #1f2533",
            fontWeight: 800,
            opacity: 0.75,
          }}
        >
          <div>Case</div>
          <div>Therapist</div>
          <div style={{ textAlign: "right" }}>Min score</div>
          <div style={{ textAlign: "right" }}>Avg score</div>
          <div style={{ textAlign: "right" }}>Last check-in</div>
          <div style={{ textAlign: "right" }}>Last score</div>
        </div>

        {queue.map((row) => {
          const min = row.week_min_score;
          const avg = row.week_avg_score;

          const minTone =
            typeof min === "number" && min <= 2 ? "danger" : "warn";

          return (
            <div
              key={row.case_id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1.4fr 1fr 1fr 1.4fr 1fr",
                padding: "12px",
                borderBottom: "1px solid #1a1e2a",
                alignItems: "center",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>{row.case_title}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge label={`At-risk`} tone="danger" />
                  <Badge label={`Check-ins this week: ${row.week_checkins}`} tone="neutral" />
                  {!row.therapist_id && <Badge label="Unassigned" tone="warn" />}
                </div>
              </div>

              <div style={{ opacity: 0.95, fontWeight: 800 }}>
                {row.therapist_name ?? "—"}
              </div>

              <div style={{ textAlign: "right" }}>
                {min === null ? "—" : <Badge label={min.toFixed(1)} tone={minTone as any} />}
              </div>

              <div style={{ textAlign: "right", fontWeight: 900 }}>
                {avg === null ? "—" : avg.toFixed(1)}
              </div>

              <div style={{ textAlign: "right", opacity: 0.85 }}>
                {formatDateTime(row.last_checkin_at)}
              </div>

              <div style={{ textAlign: "right", fontWeight: 900 }}>
                {typeof row.last_score === "number" ? row.last_score.toFixed(1) : "—"}
              </div>
            </div>
          );
        })}

        {!loading && !error && queue.length === 0 && (
          <div style={{ marginTop: 14, opacity: 0.75 }}>
            No at-risk cases for this week 🎉
          </div>
        )}

        {loading && <div style={{ marginTop: 14, opacity: 0.75 }}>Loading…</div>}
      </div>

    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <PracticeAtRiskPage />
    </Suspense>
  );
}