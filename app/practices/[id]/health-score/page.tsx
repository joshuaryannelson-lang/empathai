// app/practices/[id]/health-score/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Therapist = { id: string; name: string };

type ThsResponse = {
  practice_id: string;
  week_start: string; // Monday YYYY-MM-DD
  // score is ignored intentionally (we're removing scoring from UI)
  score?: number | null;
  drivers: {
    avg_checkin_score: number | null;
    therapists_count: number;
    cases_count: number;
    unassigned_cases_count: number;
    avg_cases_per_therapist: number;
    workload_spread: number;
    cases_by_therapist: Record<string, number>;
  };
  insights?: {
    bullets?: string[];
    recommendations?: Array<{
      id: string;
      title: string;
      details?: string;
    }>;
  };
};

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toMondayYYYYMMDD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 Sun..6 Sat
  const diffToMonday = (day + 6) % 7; // Monday => 0
  d.setDate(d.getDate() - diffToMonday);
  return toYYYYMMDD(d);
}

function formatWeekForHumans(isoYYYYMMDD: string) {
  const d = new Date(`${isoYYYYMMDD}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error("Failed to fetch");
  return json;
}

function formatValue(value: any, digits = 1) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toFixed(digits);
  return String(value);
}

function MetricRow({ label, value }: { label: string; value: any }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 12px",
        border: "1px solid #1a1e2a",
        borderRadius: 12,
        background: "#0d1018",
      }}
    >
      <div style={{ opacity: 0.85 }}>{label}</div>
      <div style={{ fontWeight: 900 }}>{formatValue(value)}</div>
    </div>
  );
}

export default function PracticeThsPage() {
  const params = useParams();
  const practiceId = params?.id as string;

  const defaultWeekStartISO = useMemo(() => {
    const d = new Date();
    return toMondayYYYYMMDD(toYYYYMMDD(d));
  }, []);

  const [pickedDateISO, setPickedDateISO] = useState(defaultWeekStartISO);
  const [weekStartISO, setWeekStartISO] = useState(defaultWeekStartISO);

  const [ths, setThs] = useState<ThsResponse | null>(null);
  const [therapistNameById, setTherapistNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);


  async function load() {
    if (!practiceId) return;

    setLoading(true);
    try {
      const json = await fetchJson(
        `/api/practices/${encodeURIComponent(practiceId)}/ths?week_start=${encodeURIComponent(
          weekStartISO
        )}`
      );
      setThs(json.data ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function loadTherapistNames() {
    if (!practiceId) return;
    try {
      const json = await fetchJson(
        `/api/therapists?practice_id=${encodeURIComponent(practiceId)}`
      );
      const list: Therapist[] = json?.data ?? [];
      const map: Record<string, string> = {};
      list.forEach((t) => (map[t.id] = t.name));
      setTherapistNameById(map);
    } catch {
      // best-effort; fall back to IDs
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId, weekStartISO]);

  useEffect(() => {
    loadTherapistNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId]);

  const bucketISO = ths?.week_start ?? weekStartISO;

  return (
    <main style={{ padding: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href={`/practices/${practiceId}/therapist-overview?week_start=${encodeURIComponent(weekStartISO)}`} style={{ textDecoration: "none", opacity: 0.9 }}>
          ← Back to Manager
        </Link>

        <h1 style={{ margin: 0 }}>Care Signals</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Week</label>
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

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 13 }}>
        Manager view for this practice. Drill into a therapist to optimize care on their assigned cases.
      </div>

      <div style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>
        Practice ID: <span style={{ fontFamily: "monospace" }}>{practiceId}</span> • Week bucket (Monday):{" "}
        <span style={{ fontFamily: "monospace" }}>{bucketISO}</span>{" "}
        <span style={{ opacity: 0.75 }}>({formatWeekForHumans(bucketISO)})</span>
      </div>

      {/* Practice-level signals */}
      {ths?.drivers ? (
        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          <MetricRow label="Avg engagement (check-in score)" value={ths.drivers.avg_checkin_score} />
          <MetricRow label="Therapists" value={ths.drivers.therapists_count} />
          <MetricRow label="Active cases" value={ths.drivers.cases_count} />
          <MetricRow label="Unassigned cases" value={ths.drivers.unassigned_cases_count} />
          <MetricRow label="Avg cases per therapist" value={ths.drivers.avg_cases_per_therapist} />
          <MetricRow label="Caseload spread" value={ths.drivers.workload_spread} />
        </div>
      ) : (
        <div style={{ marginTop: 18, opacity: 0.7 }}>No signals yet.</div>
      )}

      {/* Caseload by therapist */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ margin: 0 }}>Caseload by therapist</h3>
        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
          Click a therapist to view their care signals for this same week.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {ths?.drivers?.cases_by_therapist && Object.keys(ths.drivers.cases_by_therapist).length ? (
            Object.entries(ths.drivers.cases_by_therapist).map(([therapistId, count]) => {
              const name = therapistNameById[therapistId];
              const display = name ?? therapistId;
              const isFallback = !name;

              return (
                <div
                  key={therapistId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    border: "1px solid #1a1e2a",
                    borderRadius: 12,
                    background: "#0d1018",
                    alignItems: "center",
                  }}
                >
                  <Link
                    href={`/dashboard/therapists/${therapistId}/care?week_start=${encodeURIComponent(bucketISO)}`}
                    style={{
                      fontWeight: 800,
                      textDecoration: "none",
                      borderBottom: "1px dotted rgba(255,255,255,0.3)",
                      fontFamily: isFallback ? "monospace" : "inherit",
                    }}
                    title={isFallback ? "Therapist name not loaded yet" : therapistId}
                  >
                    {display}
                  </Link>

                  <div style={{ fontWeight: 900 }}>{count}</div>
                </div>
              );
            })
          ) : (
            <div style={{ opacity: 0.7 }}>No therapist assignments yet.</div>
          )}
        </div>
      </div>

      {loading && <div style={{ marginTop: 16, opacity: 0.7 }}>Loading…</div>}
    </main>
  );
}