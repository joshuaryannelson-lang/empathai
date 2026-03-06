/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import MarkdownContent from "@/app/components/MarkdownContent";
import { BUCKET, type Bucket } from "@/lib/constants";
import { RISK_THRESHOLDS } from "@/lib/services/risk";

// ─── Types ────────────────────────────────────────────────────────────────────
type CaseRow = {
  case_id: string;
  case_title: string | null;
  patient_first_name: string | null;
  checkins: number;
  avg_score: number | null;
  lowest_score: number | null;
  at_risk_checkins: number;
  missing_checkin: boolean;
  last_checkin_at: string | null;
};

type TherapistCareResponse = {
  therapist_id: string;
  therapist_name?: string | null;
  week_start: string;
  practice_id?: string | null;
  totals: {
    active_cases: number;
    checkins: number;
    avg_score: number | null;
    at_risk_checkins: number;
    missing_checkins: number;
  };
  cases: CaseRow[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtAvg(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(1);
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function displayName(c: Pick<CaseRow, "patient_first_name" | "case_title" | "case_id">) {
  const name = (c.patient_first_name ?? "").trim();
  if (name) return name;
  if (c.case_title?.trim()) return c.case_title.trim();
  return `Case ${shortId(c.case_id)}`;
}

function initials(c: Pick<CaseRow, "patient_first_name">) {
  const f = (c.patient_first_name ?? "").trim()[0] ?? "";
  return f.toUpperCase() || "?";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function scoreColor(score: number | null | undefined) {
  if (score === null || score === undefined) return "#6b7280";
  if (score <= 2) return "#ef4444";
  if (score <= 3) return "#f97316";
  if (score <= 5) return "#eab308";
  return "#22c55e";
}

// ─── URL Builder ─────────────────────────────────────────────────────────────
function buildCasesUrl(args: {
  practiceId?: string;
  therapistId?: string;
  bucket?: Bucket | "all";
  weekStart?: string;
}) {
  const qs = new URLSearchParams();
  if (args.practiceId) qs.set("practice_id", args.practiceId);
  if (args.therapistId) qs.set("therapist_id", args.therapistId);
  if (args.weekStart) qs.set("week_start", args.weekStart);
  if (args.bucket && args.bucket !== "all") qs.set("bucket", args.bucket);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `/cases${suffix}`;
}

// ─── AI Summary (server-side briefing service) ───────────────────────────────

// ─── Main Component ───────────────────────────────────────────────────────────
function TherapistCareDashboard() {
  const params = useParams();
  const searchParams = useSearchParams();

  const therapistId = params?.id as string;
  const weekStartFromUrl = searchParams?.get("week_start") || "";

  const [care, setCare] = useState<TherapistCareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"attention" | "unassigned">("attention");
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Tasks state
  type TaskRow = {
    id: string;
    case_id: string;
    assignee: string | null;
    title: string;
    description: string | null;
    status: "pending" | "in_progress" | "completed" | "dismissed";
    due_date: string | null;
    created_at: string;
  };
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Unassigned cases state
  type UnassignedCase = { id: string; title: string | null; patient_first_name: string | null };
  const [unassigned, setUnassigned] = useState<UnassignedCase[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());

  const demoParam = searchParams?.get("demo") || "";

  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (weekStartFromUrl) qs.set("week_start", weekStartFromUrl);
    if (demoParam === "true") qs.set("demo", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return `/api/therapists/${encodeURIComponent(therapistId)}/care${suffix}`;
  }, [therapistId, weekStartFromUrl, demoParam]);

  async function load() {
    if (!therapistId) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(
        typeof json?.error === "string" ? json.error :
        json?.error?.message ? json.error.message :
        JSON.stringify(json?.error ?? json)
      );
      const careData = json.data ?? null;
      setCare(careData);
      if (careData) generateSummary(careData);
      loadTasks();
    } catch {
      setCare(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  // Derive attention lists and healthy cases directly from the cases array
  const lowList = useMemo(() => (care?.cases ?? []).filter(c => c.at_risk_checkins > 0), [care]);
  const missList = useMemo(() => (care?.cases ?? []).filter(c => c.missing_checkin), [care]);

  const totals = care?.totals;
  const urgentCount = lowList.length + missList.length;
  const effectiveWeekStart = care?.week_start || weekStartFromUrl || "";
  const carePracticeId = care?.practice_id || undefined;

  const casesAllUrl = useMemo(() => buildCasesUrl({
    practiceId: carePracticeId,
    therapistId: therapistId || undefined,
    bucket: "all",
    weekStart: effectiveWeekStart || undefined,
  }), [carePracticeId, therapistId, effectiveWeekStart]);

  const casesLowUrl = useMemo(() => buildCasesUrl({
    practiceId: carePracticeId,
    therapistId: therapistId || undefined,
    bucket: BUCKET.LOW_SCORES,
    weekStart: effectiveWeekStart || undefined,
  }), [carePracticeId, therapistId, effectiveWeekStart]);

  const casesMissingUrl = useMemo(() => buildCasesUrl({
    practiceId: carePracticeId,
    therapistId: therapistId || undefined,
    bucket: BUCKET.MISSING_CHECKINS,
    weekStart: effectiveWeekStart || undefined,
  }), [carePracticeId, therapistId, effectiveWeekStart]);

  async function generateSummary(careData: TherapistCareResponse) {
    setAiLoading(true);
    setAiSummary("");
    setAiDone(false);
    setAiError(null);
    try {
      const lowList = careData.cases.filter(c => c.at_risk_checkins > 0);
      const missList = careData.cases.filter(c => c.missing_checkin);

      const response = await fetch(demoParam === "true" ? "/api/briefing?demo=true" : "/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "therapist",
          triggeredBy: `therapist:${therapistId}`,
          caseCode: therapistId,
          stream: true,
          dataSnapshot: {
            therapist_name: careData.therapist_name ?? null,
            week_start: careData.week_start ? new Date(careData.week_start + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : careData.week_start,
            active_cases: careData.totals.active_cases,
            avg_score: careData.totals.avg_score,
            at_risk_checkins: careData.totals.at_risk_checkins,
            missing_checkins: careData.totals.missing_checkins,
            low_score_patients: lowList.map(c => (c.patient_first_name ?? "").trim() || "Unknown"),
            missing_patients: missList.map(c => (c.patient_first_name ?? "").trim() || "Unknown"),
            low_score_details: lowList.map(c => ({
              name: (c.patient_first_name ?? "").trim() || "Unknown",
              lowest_score: c.lowest_score,
              last_checkin_at: c.last_checkin_at,
            })),
          },
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? `API ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAiSummary(accumulated);
      }
      if (!accumulated) throw new Error("Empty response from API");
    } catch (e: any) {
      setAiError(e?.message ?? String(e));
    } finally {
      setAiLoading(false);
      setAiDone(true);
    }
  }

  async function loadTasks() {
    setTasksLoading(true);
    try {
      const qs = demoParam === "true" ? "?demo=true" : "";
      const res = await fetch(`/api/tasks${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setTasks(json?.data ?? []);
    } catch { /* ignore */ }
    finally { setTasksLoading(false); }
  }

  const caseIds = useMemo(() => new Set((care?.cases ?? []).map(c => c.case_id)), [care]);
  const myTasks = useMemo(() => {
    const filtered = tasks.filter(t => caseIds.has(t.case_id) && t.assignee === "therapist");
    return filtered.sort((a, b) => {
      const aOpen = a.status !== "completed" && a.status !== "dismissed" ? 0 : 1;
      const bOpen = b.status !== "completed" && b.status !== "dismissed" ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    });
  }, [tasks, caseIds]);
  const openTaskCount = myTasks.filter(t => t.status !== "completed" && t.status !== "dismissed").length;

  async function cycleTaskStatus(task: TaskRow) {
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next as TaskRow["status"] } : t));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, userId: therapistId }),
      });
    } catch { /* ignore — optimistic update applied */ }
  }

  async function loadUnassigned(pid: string) {
    if (!pid) return;
    setUnassignedLoading(true);
    try {
      const res = await fetch(`/api/cases?practice_id=${encodeURIComponent(pid)}&unassigned=true`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setUnassigned(json?.data ?? []);
    } catch {
      setUnassigned([]);
    } finally {
      setUnassignedLoading(false);
    }
  }

  async function assignToMe(caseId: string) {
    setAssigningIds((prev) => new Set(prev).add(caseId));
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapist_id: therapistId }),
      });
      if (res.ok) {
        setUnassigned((prev) => prev.filter((c) => c.id !== caseId));
      }
    } finally {
      setAssigningIds((prev) => { const s = new Set(prev); s.delete(caseId); return s; });
    }
  }

  function handleTabChange(tab: "attention" | "unassigned") {
    setActiveTab(tab);
    if (tab === "unassigned") {
      loadUnassigned(care?.practice_id ?? "");
    }
  }

  const weekLabel = care?.week_start
    ? new Date(care.week_start + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : "—";

  const therapistInitials = (care?.therapist_name ?? "").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div style={{ background: "#080c12", color: "#e2e8f0", minHeight: "100vh", fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .page-wrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px 80px; }
        .back-link { font-size: 12px; font-weight: 500; color: #4b5563; text-decoration: none; letter-spacing: .05em; text-transform: uppercase; display: inline-block; margin-bottom: 20px; transition: color .15s; }
        .back-link:hover { color: #9ca3af; }
        .page-layout { display: grid; grid-template-columns: 248px 1fr 240px; gap: 20px; align-items: start; }
        @media (max-width: 900px) { .page-layout { grid-template-columns: 248px 1fr; } .ai-sidebar { display: none; } }
        @media (max-width: 720px) { .page-layout { grid-template-columns: 1fr; } }

        /* ── INFO SIDEBAR ── */
        .info-sidebar { position: sticky; top: 24px; display: grid; gap: 10px; }
        .profile-card { border-radius: 14px; padding: 20px 18px; border: 1px solid #1a1e2a; background: linear-gradient(170deg, #0d1018 0%, #0c0e14 100%); animation: fadeUp .3s ease both; }
        .t-avatar { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 700; color: #4f6ef7; background: #0d1220; border: 2px solid #1a2240; margin-bottom: 14px; }
        .t-name { font-size: 17px; font-weight: 700; letter-spacing: -.02em; color: #f1f3f8; line-height: 1.2; }
        .t-week { font-size: 11px; color: #4b5563; font-family: 'DM Mono', monospace; margin-top: 4px; }
        .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-top: 12px; }
        .status-pill--alert  { background: #1a0808; border: 1px solid #3d1a1a; color: #f87171; }
        .status-pill--stable { background: #061a0b; border: 1px solid #0e2e1a; color: #4ade80; }
        .divider { height: 1px; background: #131720; margin: 14px 0; }
        .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
        .stat-label { font-size: 10px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: .05em; }
        .stat-value { font-size: 13px; font-weight: 700; }
        .refresh-btn { width: 100%; padding: 8px 0; border-radius: 8px; border: 1px solid #1f2533; background: #111420; color: #9ca3af; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s; text-align: center; margin-top: 4px; }
        .refresh-btn:hover { border-color: #2e3650; color: #e8eaf0; background: #161b2e; }
        .quick-card { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; padding: 14px 16px; animation: fadeUp .3s ease .05s both; }
        .quick-title { font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; }
        .quick-link { font-size: 12px; color: #6b7280; text-decoration: none; padding: 4px 0; display: block; transition: color .15s; }
        .quick-link:hover { color: #9ca3af; }

        /* ── MAIN ── */
        .main-col { display: grid; gap: 12px; }
        .urgent-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1px solid #3d1a1a; background: linear-gradient(135deg, #1a0a0a 0%, #130808 100%); animation: slideIn .4s ease; }
        .urgent-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; flex-shrink: 0; box-shadow: 0 0 8px #ef4444aa; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .urgent-text { font-size: 13px; color: #fca5a5; font-weight: 500; }
        .urgent-text b { color: #fecaca; }
        .tabs { display: flex; gap: 4px; border-bottom: 1px solid #1a1e2a; }
        .tab { padding: 8px 16px; font-size: 13px; font-weight: 500; color: #4b5563; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s, border-color .15s; font-family: 'DM Sans', sans-serif; }
        .tab:hover { color: #9ca3af; }
        .tab--active { color: #e8eaf0; border-bottom-color: #4f6ef7; }
        .tab-badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; font-size: 10px; font-weight: 700; margin-left: 6px; background: #ef4444; color: white; }
        .section { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .4s ease both; }
        .section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #131720; }
        .section-title { font-size: 13px; font-weight: 600; color: #9ca3af; letter-spacing: .04em; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
        .dot--red   { background: #ef4444; box-shadow: 0 0 6px #ef4444aa; }
        .dot--amber { background: #f59e0b; box-shadow: 0 0 6px #f59e0baa; }
        .section-count { font-size: 11px; font-weight: 600; color: #4b5563; padding: 2px 8px; border-radius: 20px; background: #111420; border: 1px solid #1f2533; }
        .section-body { padding: 12px; display: grid; gap: 8px; }
        .section-empty { padding: 20px 16px; font-size: 13px; color: #374151; display: flex; align-items: center; gap: 8px; }
        .patient-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 8px; border: 1px solid #131720; background: #0a0c12; transition: border-color .15s, background .15s; text-decoration: none; color: inherit; }
        .patient-row:hover { border-color: #2a3050; background: #0e1220; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .avatar--red   { background: #2d0f0f; color: #f87171; border: 1px solid #3d1a1a; }
        .avatar--amber { background: #1f1607; color: #fb923c; border: 1px solid #3d2a0a; }
        .patient-info { flex: 1; min-width: 0; }
        .patient-name { font-size: 14px; font-weight: 600; color: #e8eaf0; }
        .patient-meta { font-size: 11px; color: #4b5563; margin-top: 2px; font-family: 'DM Mono', monospace; }
        .score-badge { font-size: 18px; font-weight: 700; padding: 4px 10px; border-radius: 6px; background: #0a0c12; border: 1px solid #1a1e2a; flex-shrink: 0; }
        .open-link { font-size: 12px; font-weight: 600; color: #4f6ef7; white-space: nowrap; flex-shrink: 0; opacity: 0.8; transition: opacity .15s; }
        .patient-row:hover .open-link { opacity: 1; }
        .skeleton { border-radius: 6px; background: linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .ai-section { border-radius: 12px; border: 1px solid #1a2240; background: linear-gradient(160deg, #0a0e1c 0%, #0d1018 100%); overflow: hidden; animation: fadeUp .4s ease both; }
        .ai-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #131a30; }
        .ai-header-left { display: flex; align-items: center; gap: 10px; }
        .ai-icon { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg,#3b4fd4,#6d3fc4); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .ai-title { font-size: 13px; font-weight: 600; color: #9ca3af; letter-spacing: .04em; text-transform: uppercase; }
        .ai-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: #1a2240; border: 1px solid #2a3560; color: #6b82d4; letter-spacing: .05em; }
        .ai-regen { font-size: 11px; font-weight: 600; color: #4b5563; background: none; border: 1px solid #1f2533; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .15s; }
        .ai-regen:hover { color: #9ca3af; border-color: #2a3050; }
        .ai-body { padding: 20px 20px 22px; }
        .ai-text { font-size: 15px; line-height: 1.7; color: #c8d0e0; font-weight: 400; letter-spacing: .01em; }
        .ai-cursor { display: inline-block; width: 2px; height: 15px; background: #6d3fc4; margin-left: 2px; vertical-align: middle; animation: blink 1s step-end infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .ai-skeleton-line { height: 14px; border-radius: 4px; margin-bottom: 10px; }
        .ai-footer { padding: 10px 20px 14px; display: flex; align-items: center; gap: 6px; border-top: 1px solid #0f1428; font-size: 11px; color: #374151; }
        .ai-footer-dot { width: 5px; height: 5px; border-radius: 50%; background: #6d3fc4; flex-shrink: 0; }
        @keyframes slideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        /* ── CASELOAD TABLE ── */
        .caseload-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border-radius: 8px; border: 1px solid #131720; background: #0a0c12; text-decoration: none; color: inherit; transition: border-color .15s, background .15s; }
        .caseload-row:hover { border-color: #2a3050; background: #0e1220; }
        .caseload-row--risk { border-color: #3d1a1a; background: #0f0808; }
        .caseload-row--missing { border-color: #3d2a0a; background: #0f0b04; }
        .caseload-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
        .tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
        .tag--risk { background: #1a0808; border: 1px solid #3d1a1a; color: #f87171; }
        .tag--missing { background: #1a1000; border: 1px solid #3d2800; color: #fb923c; }
        .tag--good { background: #061a0b; border: 1px solid #0e2e1a; color: #4ade80; }
        .tag--neutral { background: #0d1018; border: 1px solid #1a1e2a; color: #6b7280; }

        /* ── TASKS ── */
        .tasks-section { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .4s ease .1s both; }
        .tasks-section-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #131720; }
        .tasks-section-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; display: flex; align-items: center; gap: 8px; }
        .tasks-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: #111420; border: 1px solid #1f2533; color: #4b5563; }
        .task-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #0f1218; }
        .task-row:last-child { border-bottom: none; }
        .task-status-btn { width: 20px; height: 20px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; flex-shrink: 0; margin-top: 2px; cursor: pointer; border: none; transition: all .15s; }
        .task-status--pending { background: #111420; border: 1px solid #1f2533; color: #4b5563; }
        .task-status--in_progress { background: #0d1220; border: 1px solid #2a3560; color: #6b82d4; }
        .task-status--completed { background: #061a0b; border: 1px solid #0e2e1a; color: #4ade80; }
        .task-info { flex: 1; min-width: 0; }
        .task-name { font-size: 12px; color: #c8d0e0; line-height: 1.4; }
        .task-name--done { color: #374151; text-decoration: line-through; }
        .task-case-code { font-size: 10px; color: #4b5563; font-family: 'DM Mono', monospace; margin-top: 2px; }
        .tasks-empty { padding: 20px 16px; font-size: 12px; color: #374151; text-align: center; }
      `}</style>

      <div className="page-wrap">
        <Link href="/" className="back-link">← Home</Link>

        <div className="page-layout">

          {/* ── INFO SIDEBAR ── */}
          <aside className="info-sidebar">
            <div className="profile-card">
              <div className="t-avatar">
                {loading ? <div className="skeleton" style={{ width: 30, height: 16, borderRadius: 3 }} /> : therapistInitials}
              </div>
              <div className="t-name">
                {loading ? <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 3 }} /> : (care?.therapist_name ?? "Therapist")}
              </div>
              <div className="t-week">Week of {weekLabel}</div>
              <div className={`status-pill ${urgentCount > 0 ? "status-pill--alert" : "status-pill--stable"}`}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                {loading ? "Loading…" : urgentCount > 0 ? `${urgentCount} need attention` : "All stable"}
              </div>
              {!loading && urgentCount > 0 && (
                <div style={{ fontSize: 10, color: "rgba(248,113,113,0.65)", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                  low score or missing check-in
                </div>
              )}
              <div className="divider" />
              <div className="stat-row">
                <span className="stat-label">Active cases</span>
                <span className="stat-value" style={{ color: "#e2e8f0" }}>{totals?.active_cases ?? "—"}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Check-ins</span>
                <span className="stat-value" style={{ color: "#e2e8f0" }}>{totals?.checkins ?? "—"}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Avg score</span>
                <span className="stat-value" style={{ color: scoreColor(totals?.avg_score ?? null) }}>{fmtAvg(totals?.avg_score)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">At-risk check-ins</span>
                <span className="stat-value" style={{ color: (totals?.at_risk_checkins ?? 0) > 0 ? "#f87171" : "#374151" }}>{totals?.at_risk_checkins ?? "—"}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Missing check-ins</span>
                <span className="stat-value" style={{ color: (totals?.missing_checkins ?? 0) > 0 ? "#fb923c" : "#374151" }}>{totals?.missing_checkins ?? "—"}</span>
              </div>
              <button className="refresh-btn" onClick={load} disabled={loading}>↻ Refresh</button>
            </div>

            <div className="quick-card">
              <div className="quick-title">Quick links</div>
              <Link href={casesAllUrl} className="quick-link">→ All cases</Link>
              <Link href={casesLowUrl} className="quick-link" style={{ color: (totals?.at_risk_checkins ?? 0) > 0 ? "#f87171" : "#6b7280" }}>→ Low score cases</Link>
              <Link href={casesMissingUrl} className="quick-link" style={{ color: (totals?.missing_checkins ?? 0) > 0 ? "#fb923c" : "#6b7280" }}>→ Missing check-ins</Link>
            </div>

          </aside>

          {/* ── MAIN COLUMN ── */}
          <div className="main-col">
            {!loading && urgentCount > 0 && (
              <div className="urgent-banner">
                <div className="urgent-dot" />
                <div className="urgent-text">
                  <b>{urgentCount} patient{urgentCount !== 1 ? "s" : ""}</b> need attention this week
                  {lowList.length > 0 && ` · ${lowList.length} at-risk check-in${lowList.length !== 1 ? "s" : ""}`}
                  {missList.length > 0 && ` · ${missList.length} missing check-in${missList.length !== 1 ? "s" : ""}`}
                </div>
              </div>
            )}

        <div className="tabs">
          <button className={`tab ${activeTab === "attention" ? "tab--active" : ""}`} onClick={() => handleTabChange("attention")}>
            Caseload
            {urgentCount > 0 && <span className="tab-badge">{urgentCount}</span>}
          </button>
          <button className={`tab ${activeTab === "unassigned" ? "tab--active" : ""}`} onClick={() => handleTabChange("unassigned")}>
            Unassigned Cases
          </button>
        </div>

        {activeTab === "attention" && (
          <>
            {/* At-risk patients */}
            <div className="section" style={{ animationDelay: "100ms" }}>
              <div className="section-header">
                <Link href={casesLowUrl} className="section-title" style={{ textDecoration: "none", color: "inherit" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, display: "inline-block" }} className="dot--red" />
                  At-risk check-ins (≤ 3) →
                </Link>
                <div className="section-count">{lowList.length} {lowList.length === 1 ? "patient" : "patients"}</div>
              </div>
              {!loading && lowList.length === 0 ? (
                <div className="section-empty">✓ No at-risk check-ins this week</div>
              ) : (
                <div className="section-body">
                  {lowList.map((c) => (
                    <Link key={c.case_id} className="patient-row" href={`/cases/${c.case_id}${demoParam === "true" ? "?demo=true" : ""}`}>
                      <div className="avatar avatar--red">{initials(c)}</div>
                      <div className="patient-info">
                        <div className="patient-name">{displayName(c)}</div>
                        <div className="patient-meta">{fmtDate(c.last_checkin_at) ? `Last check-in ${fmtDate(c.last_checkin_at)}` : shortId(c.case_id)}</div>
                      </div>
                      {c.lowest_score !== null && c.lowest_score !== undefined && (
                        <div className="score-badge" style={{ color: scoreColor(c.lowest_score) }}>{c.lowest_score}</div>
                      )}
                      <span className="open-link">Open →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Missing check-ins */}
            <div className="section" style={{ animationDelay: "160ms" }}>
              <div className="section-header">
                <Link href={casesMissingUrl} className="section-title" style={{ textDecoration: "none", color: "inherit" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, display: "inline-block" }} className="dot--amber" />
                  Missing check-ins →
                </Link>
                <div className="section-count">{missList.length} {missList.length === 1 ? "patient" : "patients"}</div>
              </div>
              {!loading && missList.length === 0 ? (
                <div className="section-empty">✓ All patients checked in this week</div>
              ) : (
                <div className="section-body">
                  {missList.map((c) => (
                    <Link key={c.case_id} className="patient-row" href={`/cases/${c.case_id}${demoParam === "true" ? "?demo=true" : ""}`}>
                      <div className="avatar avatar--amber">{initials(c)}</div>
                      <div className="patient-info">
                        <div className="patient-name">{displayName(c)}</div>
                        <div className="patient-meta">{shortId(c.case_id)} · No check-in recorded</div>
                      </div>
                      <span className="open-link">Open →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Full caseload snapshot (mirrors manager's "Practice snapshot") */}
            <div className="section" style={{ animationDelay: "220ms" }}>
              <div className="section-header">
                <Link href={casesAllUrl} className="section-title" style={{ textDecoration: "none", color: "inherit" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, display: "inline-block", background: "#22c55e", boxShadow: "0 0 6px #22c55eaa" }} />
                  Caseload snapshot →
                </Link>
                <div className="section-count">{(care?.cases ?? []).length} {(care?.cases ?? []).length === 1 ? "patient" : "patients"}</div>
              </div>
              {loading && !care ? (
                <div className="section-body">
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 64, borderRadius: 8, background: "linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                  ))}
                </div>
              ) : !loading && (care?.cases ?? []).length === 0 ? (
                <div className="section-empty">No active patients this week</div>
              ) : (
                <div className="section-body">
                  {(care?.cases ?? []).map(c => {
                    const hasRisk = c.at_risk_checkins > 0;
                    const hasMissing = c.missing_checkin;
                    const rowClass = hasRisk ? "caseload-row caseload-row--risk" : hasMissing ? "caseload-row caseload-row--missing" : "caseload-row";
                    return (
                      <Link key={c.case_id} className={rowClass} href={`/cases/${c.case_id}${demoParam === "true" ? "?demo=true" : ""}`}>
                        <div className="avatar" style={
                          hasRisk ? { background: "#2d0f0f", color: "#f87171", border: "1px solid #3d1a1a" } :
                          hasMissing ? { background: "#1f1607", color: "#fb923c", border: "1px solid #3d2a0a" } :
                          { background: "#061a0b", color: "#4ade80", border: "1px solid #0e2e1a" }
                        }>{initials(c)}</div>
                        <div className="patient-info">
                          <div className="patient-name">{displayName(c)}</div>
                          <div className="caseload-tags">
                            <span className={`tag ${c.checkins > 0 ? "tag--neutral" : "tag--missing"}`}>{c.checkins} check-in{c.checkins !== 1 ? "s" : ""}</span>
                            {c.avg_score !== null && (
                              <span className={`tag ${c.avg_score <= RISK_THRESHOLDS.criticalScore ? "tag--risk" : c.avg_score <= RISK_THRESHOLDS.monitorAvgScore ? "tag--neutral" : "tag--good"}`}>avg {fmtAvg(c.avg_score)}</span>
                            )}
                            {c.at_risk_checkins > 0 && <span className="tag tag--risk">{c.at_risk_checkins} at-risk</span>}
                            {c.missing_checkin && <span className="tag tag--missing">no check-in</span>}
                            {!hasRisk && !hasMissing && <span className="tag tag--good">stable</span>}
                          </div>
                        </div>
                        {c.lowest_score !== null && (
                          <div className="score-badge" style={{ color: scoreColor(c.lowest_score) }}>{c.lowest_score}</div>
                        )}
                        <span className="open-link">Open →</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "unassigned" && (
          <div className="section" style={{ animationDelay: "100ms" }}>
            <div className="section-header">
              <div className="section-title">
                <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, display: "inline-block", background: "#f59e0b", boxShadow: "0 0 6px #f59e0baa" }} />
                Unassigned in your practice
              </div>
              <div className="section-count">{unassigned.length} case{unassigned.length !== 1 ? "s" : ""}</div>
            </div>
            {unassignedLoading ? (
              <div className="section-body">
                {[1,2,3].map((i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid #131720", background: "#0a0c12" }}>
                    <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                    <div style={{ flex: 1, display: "grid", gap: 6 }}>
                      <div className="skeleton" style={{ width: "50%", height: 12 }} />
                      <div className="skeleton" style={{ width: "30%", height: 10 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : unassigned.length === 0 ? (
              <div className="section-empty">✓ No unassigned cases in your practice</div>
            ) : (
              <div className="section-body">
                {unassigned.map((c) => {
                  const name = (c.patient_first_name ?? "").trim() || c.title || `Case ${c.id.slice(0, 6)}…`;
                  const ini = (c.patient_first_name?.[0] ?? "").toUpperCase() || "?";
                  const busy = assigningIds.has(c.id);
                  return (
                    <div key={c.id} className="patient-row" style={{ cursor: "default" }}>
                      <div className="avatar avatar--amber">{ini}</div>
                      <div className="patient-info">
                        <div className="patient-name">{name}</div>
                        <div className="patient-meta">Unassigned · {c.id.slice(0, 8)}…</div>
                      </div>
                      <button
                        onClick={() => assignToMe(c.id)}
                        disabled={busy}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 7,
                          border: "1px solid #1e3a1e",
                          background: busy ? "#0a0c10" : "#061a0b",
                          color: busy ? "#4b5563" : "#4ade80",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: busy ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          fontFamily: "DM Sans, sans-serif",
                        }}
                      >
                        {busy ? "Assigning…" : "Assign to Me"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

          </div>{/* end main-col */}

          {/* ── AI SIDEBAR ── */}
          <aside className="ai-sidebar" style={{ position: "sticky", top: 24, display: "grid", gap: 10 }}>
            <div className="ai-section">
              <div className="ai-header">
                <div className="ai-header-left">
                  <div className="ai-icon">✦</div>
                  <div className="ai-title">AI Briefing</div>
                </div>
                {aiDone && (
                  <button className="ai-regen" onClick={() => care && generateSummary(care)}>↻</button>
                )}
              </div>
              <div className="ai-body">
                {aiLoading && !aiSummary && (
                  <>
                    <div className="skeleton ai-skeleton-line" style={{ width: "92%" }} />
                    <div className="skeleton ai-skeleton-line" style={{ width: "78%" }} />
                    <div className="skeleton ai-skeleton-line" style={{ width: "85%" }} />
                    <div className="skeleton ai-skeleton-line" style={{ width: "60%" }} />
                  </>
                )}
                {aiError && (
                  <div style={{ fontSize: 12, color: "#f87171", fontFamily: "DM Mono, monospace", background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 8, padding: "10px 12px" }}>
                    {aiError}
                  </div>
                )}
                {aiSummary && (
                  <div className="ai-text">
                    <MarkdownContent>{aiSummary}</MarkdownContent>
                    {aiLoading && <span className="ai-cursor" />}
                  </div>
                )}
              </div>
              {aiDone && !aiError && (
                <div className="ai-footer">
                  <div className="ai-footer-dot" />
                  {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>

            {/* ── TASKS ── */}
            <div className="tasks-section">
              <div className="tasks-section-head">
                <div className="tasks-section-title">
                  Tasks
                  {openTaskCount > 0 && <span className="tasks-badge">{openTaskCount} open</span>}
                </div>
              </div>
              {tasksLoading && myTasks.length === 0 ? (
                <div className="tasks-empty" style={{ color: "#4b5563" }}>Loading tasks…</div>
              ) : myTasks.length === 0 ? (
                <div className="tasks-empty">No tasks assigned</div>
              ) : (
                <div>
                  {myTasks.map(t => (
                    <div key={t.id} className="task-row">
                      <button
                        className={`task-status-btn task-status--${t.status}`}
                        onClick={() => cycleTaskStatus(t)}
                        title={`Status: ${t.status}`}
                      >{t.status === "completed" ? "✓" : t.status === "in_progress" ? "►" : ""}</button>
                      <div className="task-info">
                        <div className={`task-name ${t.status === "completed" ? "task-name--done" : ""}`}>{t.title}</div>
                        <div className="task-case-code">{t.case_id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>{/* end page-layout */}
      </div>{/* end page-wrap */}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TherapistCareDashboard />
    </Suspense>
  );
}
