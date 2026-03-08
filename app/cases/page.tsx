// FILE: app/cases/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BUCKET, type Bucket } from "@/lib/constants";
import { NavSidebar } from "@/app/components/NavSidebar";
import { SkeletonPage } from "@/app/components/ui/Skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
type Practice = { id: string; name: string; created_at: string };
type Therapist = { id: string; name: string | null; practice_id: string };
type CaseRowApi = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  practice_id: string;
  therapist_id: string | null;
  patient_id: string | null;
  therapist_name?: string | null;
  patient_first_name?: string | null;
  latest_score?: number | null;
  latest_checkin?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(
      typeof json?.error === "string" ? json.error :
      json?.error?.message ? json.error.message :
      JSON.stringify(json?.error ?? json)
    );
  }
  return json;
}

function patientFullName(c: CaseRowApi) {
  return (c.patient_first_name ?? "").trim() || "—";
}

function patientInitials(c: CaseRowApi) {
  const f = (c.patient_first_name ?? "").trim()[0] ?? "";
  return f.toUpperCase() || "?";
}

function fmtScore(n: number | null | undefined): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return n;
}

function fmtCheckin(iso: string | null | undefined) {
  if (!iso) return null;
  const daysAgo = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7)  return `${daysAgo}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function scoreHue(s: number | null) {
  if (s === null) return { fg: "#6b7280", bg: "#111420", border: "#1f2533" };
  if (s <= 2)     return { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" };
  if (s <= 3)     return { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" };
  if (s <= 5)     return { fg: "#eab308", bg: "#1a1500", border: "#3d3200" };
  return           { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" };
}

// ─── Component ────────────────────────────────────────────────────────────────
function CasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const practiceIdFromUrl  = searchParams.get("practice_id") || "";
  const therapistIdFromUrl = searchParams.get("therapist_id") || "";
  const bucketFromUrl      = (searchParams.get("bucket") || "") as "" | Bucket;
  const weekStartFromUrl   = searchParams.get("week_start") || "";

  const [practices, setPractices]             = useState<Practice[]>([]);
  const [therapists, setTherapists]           = useState<Therapist[]>([]);
  const [selectedPracticeId, setSelectedPracticeId]   = useState(practiceIdFromUrl);
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapistIdFromUrl);
  const [selectedBucket, setSelectedBucket]   = useState<"" | Bucket>(bucketFromUrl);
  const [cases, setCases]                     = useState<CaseRowApi[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [search, setSearch]                   = useState("");

  const selectedPractice = useMemo(() => practices.find(p => p.id === selectedPracticeId) ?? null, [practices, selectedPracticeId]);

  const visibleCases = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(c =>
      patientFullName(c).toLowerCase().includes(q) ||
      (c.therapist_name ?? "").toLowerCase().includes(q) ||
      (c.title ?? "").toLowerCase().includes(q)
    );
  }, [cases, search]);

  const lowCount        = cases.filter(c => c.latest_score != null && c.latest_score <= 3).length;
  const missingCount    = cases.filter(c => !c.latest_checkin).length;
  const unassignedCount = cases.filter(c => !c.therapist_id).length;

  async function _loadPractices()             { return ((await fetchJson("/api/practices")).data ?? []) as Practice[]; }
  async function _loadTherapists(pid: string) { if (!pid) return [] as Therapist[]; return ((await fetchJson(`/api/therapists?practice_id=${encodeURIComponent(pid)}`)).data ?? []) as Therapist[]; }
  async function _loadCases(args: { practiceId: string; therapistId?: string; bucket?: "" | Bucket; weekStart?: string }) {
    const qs = new URLSearchParams();
    qs.set("practice_id", args.practiceId);
    if (args.bucket === BUCKET.UNASSIGNED) {
      qs.set("unassigned", "true");
    } else {
      if (args.therapistId) qs.set("therapist_id", args.therapistId);
      if (args.bucket)      qs.set("bucket", args.bucket);
    }
    if (args.weekStart) qs.set("week_start", args.weekStart);
    return ((await fetchJson(`/api/cases?${qs.toString()}`)).data ?? []) as CaseRowApi[];
  }

  function syncUrl(next: { practiceId: string; therapistId?: string; bucket?: "" | Bucket; weekStart?: string }) {
    const qs = new URLSearchParams();
    if (next.practiceId)  qs.set("practice_id", next.practiceId);
    if (next.therapistId) qs.set("therapist_id", next.therapistId);
    if (next.bucket)      qs.set("bucket", next.bucket);
    if (next.weekStart)   qs.set("week_start", next.weekStart);
    router.replace(`/cases${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  async function refreshAll(initial = false) {
    setLoading(true); setError(null);
    try {
      const ps = await _loadPractices();
      setPractices(ps);
      const pid = (initial ? practiceIdFromUrl : selectedPracticeId) || ps?.[0]?.id || "";
      setSelectedPracticeId(pid);
      const ts = await _loadTherapists(pid);
      setTherapists(ts);
      const desiredTid = initial ? therapistIdFromUrl : selectedTherapistId;
      const tid = desiredTid && ts.some(t => t.id === desiredTid) ? desiredTid : "";
      setSelectedTherapistId(tid);
      const bucket = (initial ? bucketFromUrl : selectedBucket) || "";
      setSelectedBucket(bucket);
      setCases(pid ? await _loadCases({ practiceId: pid, therapistId: tid || undefined, bucket: bucket || undefined, weekStart: weekStartFromUrl || undefined }) : []);
      syncUrl({ practiceId: pid, therapistId: tid || undefined, bucket: bucket || undefined, weekStart: weekStartFromUrl || undefined });
    } catch (e: any) { setError(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }

  async function onChangePractice(pid: string) {
    setSelectedPracticeId(pid); setSelectedTherapistId("");
    setLoading(true); setError(null);
    try {
      const ts = await _loadTherapists(pid);
      setTherapists(ts);
      setCases(pid ? await _loadCases({ practiceId: pid, bucket: selectedBucket || undefined, weekStart: weekStartFromUrl || undefined }) : []);
      syncUrl({ practiceId: pid, bucket: selectedBucket || undefined, weekStart: weekStartFromUrl || undefined });
    } catch (e: any) { setError(e?.message ?? String(e)); setCases([]); }
    finally { setLoading(false); }
  }

  async function onChangeTherapist(tid: string) {
    setSelectedTherapistId(tid);
    if (!selectedPracticeId) return;
    setLoading(true); setError(null);
    try {
      setCases(await _loadCases({ practiceId: selectedPracticeId, therapistId: tid || undefined, bucket: selectedBucket || undefined, weekStart: weekStartFromUrl || undefined }));
      syncUrl({ practiceId: selectedPracticeId, therapistId: tid || undefined, bucket: selectedBucket || undefined, weekStart: weekStartFromUrl || undefined });
    } catch (e: any) { setError(e?.message ?? String(e)); setCases([]); }
    finally { setLoading(false); }
  }

  async function onChangeBucket(b: "" | Bucket) {
    setSelectedBucket(b);
    if (!selectedPracticeId) return;
    setLoading(true); setError(null);
    try {
      setCases(await _loadCases({ practiceId: selectedPracticeId, therapistId: selectedTherapistId || undefined, bucket: b || undefined, weekStart: weekStartFromUrl || undefined }));
      syncUrl({ practiceId: selectedPracticeId, therapistId: selectedTherapistId || undefined, bucket: b || undefined, weekStart: weekStartFromUrl || undefined });
    } catch (e: any) { setError(e?.message ?? String(e)); setCases([]); }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshAll(true); }, []);

  const weekLabel = weekStartFromUrl
    ? new Date(weekStartFromUrl + "T12:00:00Z").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page { max-width: 980px; margin: 0 auto; padding: 32px 24px 80px; }

        /* Header */
        .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
        .page-title { font-size: 24px; font-weight: 700; letter-spacing: -.02em; color: #f1f3f8; }
        .page-subtitle { font-size: 12px; color: #4b5563; margin-top: 4px; font-family: 'DM Mono', monospace; }
        .refresh-btn { padding: 8px 16px; border-radius: 9px; border: 1px solid #1f2533; background: #0d1018; color: #9ca3af; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s; }
        .refresh-btn:hover { border-color: #2e3650; color: #e8eaf0; }
        .refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Summary chips */
        .summary-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; animation: fadeUp .3s ease both; }
        .summary-chip { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; border: 1px solid #1a1e2a; background: #0d1018; font-size: 12px; font-weight: 600; color: #6b7280; }
        .summary-chip--alert { border-color: #3d1a1a; background: #1a0808; color: #f87171; }
        .summary-chip--warn  { border-color: #3d2800; background: #1a1000; color: #fb923c; }
        .chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* Toolbar */
        .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
        .filter-label { font-size: 11px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: .05em; }
        .filter-select {
          padding: 8px 28px 8px 12px; border-radius: 9px;
          border: 1px solid #1f2533; background: #0d1018;
          color: #9ca3af; font-family: 'DM Sans', sans-serif; font-size: 13px;
          cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234b5563' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
          transition: border-color .15s;
        }
        .filter-select:focus  { outline: none; border-color: #2e3650; }
        .filter-select:disabled { opacity: 0.4; cursor: not-allowed; }

        .search-wrap { position: relative; margin-left: auto; }
        .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #374151; pointer-events: none; }
        .search-input { padding: 8px 12px 8px 32px; border-radius: 9px; border: 1px solid #1f2533; background: #0d1018; color: #e8eaf0; font-family: 'DM Sans', sans-serif; font-size: 13px; width: 220px; transition: border-color .15s; max-width: 100%; }
        .search-input::placeholder { color: #374151; }
        .search-input:focus { outline: none; border-color: #2e3650; }

        /* Bucket pills */
        .bucket-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
        .bucket-pills { display: flex; gap: 6px; }
        .bucket-pill { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #1f2533; background: #0d1018; color: #4b5563; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .15s; display: flex; align-items: center; gap: 6px; }
        .bucket-pill:hover:not(:disabled) { border-color: #2e3650; color: #9ca3af; }
        .bucket-pill:disabled { opacity: 0.4; cursor: not-allowed; }
        .bucket-pill--active     { border-color: #2a3050; background: #0d1220; color: #e8eaf0; }
        .bucket-pill--alert.bucket-pill--active { border-color: #3d1a1a; background: #1a0808; color: #f87171; }
        .bucket-pill--warn.bucket-pill--active  { border-color: #3d2800; background: #1a1000; color: #fb923c; }
        .bucket-count { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 8px; background: rgba(255,255,255,.07); }

        .results-meta { font-size: 12px; color: #4b5563; font-family: 'DM Mono', monospace; display: flex; align-items: center; gap: 10px; }
        .practice-tag { font-size: 11px; color: #4b5563; background: #0d1018; border: 1px solid #1a1e2a; padding: 3px 9px; border-radius: 20px; }

        /* Error */
        .error-box { background: #1a0808; border: 1px solid #3d1a1a; color: #fca5a5; padding: 12px 14px; border-radius: 10px; font-size: 12px; font-family: 'DM Mono', monospace; margin-bottom: 14px; white-space: pre-wrap; }

        /* Case rows */
        .case-list { display: grid; gap: 8px; }
        .case-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 12px;
          border: 1px solid #1a1e2a; background: #0d1018;
          text-decoration: none; color: inherit;
          transition: border-color .15s, background .15s;
          animation: fadeUp .3s ease both;
        }
        .case-row:hover          { border-color: #2a3050; background: #0e1120; }
        .case-row--alert         { border-color: #3d1a1a; background: #0f0808; }
        .case-row--alert:hover   { border-color: #5a2222; background: #130a0a; }
        .case-row--warn          { border-color: #3d2800; background: #0f0b06; }
        .case-row--warn:hover    { border-color: #5a3a00; }

        .case-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
        .case-body   { flex: 1; min-width: 0; }
        .case-name   { font-size: 14px; font-weight: 600; color: #f1f3f8; }
        .case-title  { font-size: 11px; color: #4b5563; margin-top: 2px; }
        .case-meta   { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 5px; }
        .case-meta-item { font-size: 11px; color: #4b5563; }
        .case-meta-item b { color: #6b7280; font-weight: 600; }

        .score-badge { width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
        .status-tag  { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; flex-shrink: 0; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
        .open-arrow  { font-size: 13px; color: #4f6ef7; opacity: 0.6; flex-shrink: 0; transition: opacity .15s; }
        .case-row:hover .open-arrow { opacity: 1; }

        /* Empty */
        .empty { padding: 56px 0; text-align: center; }
        .empty-icon { font-size: 28px; opacity: 0.25; margin-bottom: 12px; }
        .empty-text { font-size: 14px; color: #374151; }

        /* Skeleton */
        .skeleton { background: linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 12px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width: 767px) {
          .page { padding: 64px 14px 60px !important; }
          .toolbar { gap: 8px; }
          .search-wrap { margin-left: 0 !important; width: 100%; }
          .search-input { width: 100% !important; }
          .bucket-pills { flex-wrap: wrap; gap: 6px; }
          .bucket-row { flex-direction: column; align-items: flex-start; }
          .case-list { gap: 12px !important; }
          .case-row { flex-direction: column; align-items: stretch !important; gap: 12px; width: 100%; }
          .case-avatar { align-self: flex-start; }
          .score-badge { align-self: flex-start; }
          .status-tag { display: none; }
          .page-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
      <NavSidebar
        practiceId={selectedPracticeId || null}
        practiceName={selectedPractice?.name ?? null}
        therapistId={selectedTherapistId || null}
        weekStart={weekStartFromUrl || new Date().toISOString().slice(0, 10)}
      />
      <div className="page" style={{ margin: 0, flex: 1 }}>

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Cases</div>
            <div className="page-subtitle">
              {weekLabel ? `Week of ${weekLabel}` : "All weeks"}{selectedPractice ? ` · ${selectedPractice.name}` : ""}
            </div>
          </div>
          <button className="refresh-btn" onClick={() => refreshAll(false)} disabled={loading}>↻ Refresh</button>
        </div>

        {/* Summary chips — only when data loaded */}
        {!loading && cases.length > 0 && (
          <div className="summary-row">
            <div className="summary-chip">
              <span className="chip-dot" style={{ background: "#4b5563" }} />{cases.length} cases
            </div>
            {lowCount > 0 && (
              <div className="summary-chip summary-chip--alert">
                <span className="chip-dot" style={{ background: "#f87171", boxShadow: "0 0 5px #f87171aa" }} />
                {lowCount} low score{lowCount !== 1 ? "s" : ""}
              </div>
            )}
            {missingCount > 0 && (
              <div className="summary-chip summary-chip--warn">
                <span className="chip-dot" style={{ background: "#fb923c" }} />
                {missingCount} missing check-in{missingCount !== 1 ? "s" : ""}
              </div>
            )}
            {unassignedCount > 0 && (
              <div className="summary-chip" style={{ borderColor: "#3d2800", background: "#1a1000", color: "#fb923c" }}>
                <span className="chip-dot" style={{ background: "#fb923c" }} />
                {unassignedCount} unassigned
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="toolbar">
          <span className="filter-label">Practice</span>
          <select className="filter-select" value={selectedPracticeId} onChange={e => onChangePractice(e.target.value)} disabled={loading}>
            {practices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <span className="filter-label">Therapist</span>
          <select className="filter-select" value={selectedTherapistId} onChange={e => onChangeTherapist(e.target.value)} disabled={loading || !selectedPracticeId || selectedBucket === BUCKET.UNASSIGNED}>
            <option value="">All therapists</option>
            {therapists.map(t => <option key={t.id} value={t.id}>{t.name ?? t.id}</option>)}
          </select>

          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search patient or therapist…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Bucket pills + results count */}
        <div className="bucket-row">
          <div className="bucket-pills">
            {([
              { value: "" as const,                      label: "All",               cls: "" },
              { value: BUCKET.LOW_SCORES,                label: "Low scores",        cls: "bucket-pill--alert", count: lowCount },
              { value: BUCKET.MISSING_CHECKINS,          label: "Missing check-ins", cls: "bucket-pill--warn",  count: missingCount },
              { value: BUCKET.UNASSIGNED,                label: "Unassigned",        cls: "bucket-pill--warn",  count: unassignedCount },
            ]).map(b => (
              <button
                key={b.value}
                className={`bucket-pill ${b.cls} ${selectedBucket === b.value ? "bucket-pill--active" : ""}`}
                onClick={() => onChangeBucket(b.value)}
                disabled={loading || !selectedPracticeId}
              >
                {b.label}
                {b.count != null && b.count > 0 && <span className="bucket-count">{b.count}</span>}
              </button>
            ))}
          </div>
          <div className="results-meta">
            {loading ? "Loading…" : `${visibleCases.length} case${visibleCases.length !== 1 ? "s" : ""}${search ? ` matching "${search}"` : ""}`}
          </div>
        </div>

        {/* Error */}
        {error && <div className="error-box">{error}</div>}

        {/* List */}
        <div className="case-list" data-demo-spotlight="case-list">
          {loading && [1,2,3,4,5].map(i => (
            <div key={i} className="skeleton" style={{ height: 72, animationDelay: `${i * 50}ms` }} />
          ))}

          {!loading && visibleCases.map((c, idx) => {
            const score   = fmtScore(c.latest_score);
            const hue     = scoreHue(score);
            const isAlert = score !== null && score <= 3;
            const isWarn  = !c.latest_checkin;
            const rowCls  = isAlert ? "case-row--alert" : isWarn ? "case-row--warn" : "";
            const checkin = fmtCheckin(c.latest_checkin);

            return (
              <Link key={c.id} href={`/cases/${c.id}`} className={`case-row ${rowCls}`} style={{ animationDelay: `${idx * 25}ms` }}>
                <div className="case-avatar" style={{ background: hue.bg, border: `1px solid ${hue.border}`, color: hue.fg }}>
                  {patientInitials(c)}
                </div>

                <div className="case-body">
                  <div className="case-name">{patientFullName(c)}</div>
                  {c.title && <div className="case-title">{c.title}</div>}
                  <div className="case-meta">
                    {c.therapist_name && (
                      <span className="case-meta-item"><b>Therapist</b> {c.therapist_name}</span>
                    )}
                    <span className="case-meta-item">
                      <b>Check-in</b>{" "}
                      {checkin
                        ? <span style={{ color: isWarn ? "#fb923c" : "inherit" }}>{checkin}</span>
                        : <span style={{ color: "#fb923c" }}>None recorded</span>
                      }
                    </span>
                    <span className="case-meta-item">
                      <b>Opened</b> {new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>

                <div className="score-badge" style={{ background: hue.bg, border: `1px solid ${hue.border}`, color: hue.fg }}>
                  {score ?? "—"}
                </div>

                <div
                  className="status-tag"
                  style={{
                    background: c.status === "active" ? "#061a0b" : "#0d1018",
                    border: `1px solid ${c.status === "active" ? "#0e2e1a" : "#1f2533"}`,
                    color: c.status === "active" ? "#4ade80" : "#4b5563",
                  }}
                >
                  {c.status ?? "—"}
                </div>

                <div className="open-arrow">→</div>
              </Link>
            );
          })}

          {!loading && visibleCases.length === 0 && (
            <div className="empty">
              <div className="empty-icon">◎</div>
              <div className="empty-text">
                {search ? `No cases matching "${search}"` : "No cases match those filters."}
              </div>
            </div>
          )}
        </div>

      </div>
      </div>
    </>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <CasesPage />
    </Suspense>
  );
}
