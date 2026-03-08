/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { RISK_THRESHOLDS } from "@/lib/services/risk";
import { isDemoMode } from "@/lib/demo/demoMode";
import SessionPrepCard, { type SessionPrepOutput } from "@/app/components/SessionPrepCard";

// ─── Types ────────────────────────────────────────────────────────────────────
type ExtendedPatient = {
  clinical_notes?: string;
  session_notes?: { date: string; text: string }[];
  activities?: { date: string; description: string }[];
};

type ExtendedTherapist = {
  license_type?: string;
  license_state?: string;
  therapy_modalities?: string[];
  specializations?: string[];
};

type TimelineCheckin = {
  id: string;
  case_id: string;
  score: number | null;
  mood: number | null;
  created_at: string;
  note: string | null;
  notes?: string | null;
};

type TimelineResponse = {
  case: { id: string; title: string | null; status: string | null; created_at: string };
  patient: { first_name: string | null; extended_profile?: ExtendedPatient } | null;
  therapist: { id?: string; name: string | null; extended_profile?: ExtendedTherapist } | null;
  checkins: TimelineCheckin[];
};

type Goal = {
  id: string;
  case_id: string;
  title: string;
  status: string;
  target_date: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fullName  = (f?: string | null) => f?.trim() || "Patient";
const fmtShort  = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtFull   = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDate   = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
const avg       = (ns: number[]) => ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
const noteText  = (c: TimelineCheckin) => c.note || c.notes || null;

const scoreHue = (s: number | null) => {
  if (s === null) return { fg: "#6b7280", bg: "#111420", border: "#1f2533" };
  if (s <= 2)     return { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" };
  if (s <= 3)     return { fg: "#fb923c", bg: "#1a1000", border: "#3d2800" };
  if (s <= 5)     return { fg: "#eab308", bg: "#1a1500", border: "#3d3200" };
  return           { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" };
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CasePage() {
  const params = useParams();
  const id = params?.id as string;

  const [d, setD]               = useState<TimelineResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [goals, setGoals]       = useState<Goal[]>([]);

  const [sidebarTab, setSidebarTab] = useState<"care" | "notes">("care");
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [notesOpen, setNotesOpen]     = useState(false);
  const [copied, setCopied]     = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [clinicalNotesCollapsed, setClinicalNotesCollapsed] = useState(true);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [sessionPrepReviewed, setSessionPrepReviewed] = useState(false);
  const [sessionPrepData, setSessionPrepData] = useState<SessionPrepOutput | null>(null);


  // Clinical notes state
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [clinicalNotesEditing, setClinicalNotesEditing] = useState(false);
  const [clinicalNotesSaved, setClinicalNotesSaved] = useState(false);
  const clinicalNotesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DSM codes state
  const [dsmCodes, setDsmCodes] = useState<string[]>([]);
  const [dsmInput, setDsmInput] = useState("");
  const [dsmContextChanged, setDsmContextChanged] = useState(false);
  const [dsmExpanded, setDsmExpanded] = useState(false);

  // Goals add state
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  // Demo mode detection (client side — localStorage flag)
  const isDemo = isDemoMode();

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    if (isDemo) {
      // Load entirely from fixtures — no API/DB calls
      import("@/lib/demo/demoData").then(({ getDemoTimeline, getDemoCaseGoals }) => {
        const timeline = getDemoTimeline(id);
        if (timeline) setD(timeline as TimelineResponse);
        setGoals(getDemoCaseGoals(id).map(g => ({ ...g, case_id: id })) as Goal[]);
      }).finally(() => setLoading(false));
      return;
    }

    setError(null);
    Promise.all([
      fetch(`/api/cases/${id}/timeline`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/cases/${id}/goals`,    { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/cases/${id}`,          { cache: "no-store" }).then(r => r.json()).catch(() => null),
    ]).then(([timelineJson, goalsJson, caseJson]) => {
      if (timelineJson) setD(timelineJson?.data ?? timelineJson);
      else setError("Failed to load case data");
      setGoals(goalsJson?.data ?? []);
      const caseData = caseJson?.data;
      if (caseData?.clinical_notes) setClinicalNotes(caseData.clinical_notes);
      if (Array.isArray(caseData?.dsm_codes)) setDsmCodes(caseData.dsm_codes);
    }).catch((e: any) => {
      setError(e?.message ?? "Failed to load case data");
    }).finally(() => setLoading(false));
  }, [id, isDemo]);

  // Session prep is on-demand — therapist clicks "Generate" instead of auto-firing on page load

  const checkins    = d?.checkins ?? [];
  const latest      = checkins[0] ?? null;
  const prev        = checkins[1] ?? null;
  const patientName = fullName(d?.patient?.first_name);
  const initials    = d?.patient?.first_name?.[0] ?? "";
  const avgScore    = avg(checkins.map(c => c.score).filter((n): n is number => n !== null));
  const baseline    = avg(checkins.slice(1, 4).map(c => c.score).filter((n): n is number => n !== null));
  const delta       = latest?.score != null && baseline != null ? latest.score - baseline : null;
  const isLow       = latest?.score != null && latest.score <= RISK_THRESHOLDS.criticalScore;
  const isDropping  = delta != null && delta <= RISK_THRESHOLDS.decliningDelta;
  const isStale     = latest?.created_at ? daysSince(latest.created_at) >= RISK_THRESHOLDS.staleDays : false;
  const hue         = scoreHue(latest?.score ?? null);
  const outreachText = `Hi ${patientName} — I saw your recent check-in and wanted to reach out before our session. How are things feeling right now?`;

  const ep = d?.patient?.extended_profile ?? {};
  const te = d?.therapist?.extended_profile ?? {};

  const goalsDone    = goals.filter(g => g.status === "done" || g.status === "completed").length;
  const goalsTotal   = goals.length;
  const sessionNotes = [...(ep.session_notes ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // Clinical notes — debounced auto-save
  const saveClinicalNotes = useCallback(async (text: string) => {
    try {
      if (isDemo) {
        setClinicalNotesSaved(true);
        setTimeout(() => setClinicalNotesSaved(false), 2000);
        return;
      }
      const res = await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinical_notes: text }),
      });
      if (res.ok) {
        setClinicalNotesSaved(true);
        setTimeout(() => setClinicalNotesSaved(false), 2000);
      }
    } catch { /* ignore */ }
  }, [id, isDemo]);

  function handleClinicalNotesChange(text: string) {
    setClinicalNotes(text);
    if (clinicalNotesTimer.current) clearTimeout(clinicalNotesTimer.current);
    clinicalNotesTimer.current = setTimeout(() => saveClinicalNotes(text), 2000);
  }

  // DSM codes management
  async function saveDsmCodes(codes: string[]) {
    try {
      if (isDemo) return;
      await fetch(`/api/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsm_codes: codes }),
      });
    } catch { /* ignore */ }
  }

  function addDsmCode() {
    const code = dsmInput.trim().toUpperCase();
    if (!code || dsmCodes.includes(code) || dsmCodes.length >= 5) { setDsmInput(""); return; }
    const updated = [...dsmCodes, code];
    setDsmCodes(updated);
    setDsmInput("");
    setDsmContextChanged(true);
    saveDsmCodes(updated);
  }

  function removeDsmCode(code: string) {
    const updated = dsmCodes.filter(c => c !== code);
    setDsmCodes(updated);
    setDsmContextChanged(true);
    saveDsmCodes(updated);
  }

  // Goal management
  async function addGoal() {
    if (!newGoalTitle.trim()) return;
    try {
      const res = await fetch(`/api/cases/${id}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newGoalTitle, status: "active" }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const created = json?.data;
        if (created?.id) {
          setGoals(prev => [created, ...prev]);
        }
      } else if (isDemo) {
        setGoals(prev => [{
          id: `local-goal-${Date.now()}`,
          case_id: id as string,
          title: newGoalTitle,
          status: "active",
          target_date: null,
          created_at: new Date().toISOString(),
        }, ...prev]);
      }
      setNewGoalTitle(""); setShowAddGoal(false);
    } catch { /* ignore */ }
  }

  async function toggleGoalStatus(goal: Goal) {
    const next = goal.status === "active" ? "completed" : "active";
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: next } : g));
    try {
      await fetch(`/api/cases/${id}/goals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id, status: next }),
      });
    } catch { /* ignore — optimistic update already applied */ }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .shell  { max-width: 1320px; margin: 0 auto; padding: 28px 24px 80px; }
        .back   { font-size: 12px; font-weight: 500; color: #4b5563; text-decoration: none; letter-spacing: .05em; text-transform: uppercase; transition: color .15s; display: inline-block; margin-bottom: 20px; }
        .back:hover { color: #9ca3af; }

        .layout { display: grid; grid-template-columns: 300px 1fr 280px; gap: 16px; align-items: start; }
        @media (max-width: 1100px) { .layout { grid-template-columns: 300px 1fr; } .right-col { display: none; } }
        @media (max-width: 700px)  {
          .layout { grid-template-columns: 1fr; }
          .sidebar { position: static; }
          .right-col { display: block !important; }
          .shell { padding: 16px 12px 60px; }
        }

        /* ── RIGHT COLUMN ── */
        .right-col { position: sticky; top: 24px; display: grid; gap: 12px; align-content: start; }

        /* ── ACTIVITY FEED ── */
        .feed-head { padding: 13px 16px; border-bottom: 1px solid #131720; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .feed-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
        .feed-count { font-size: 11px; font-weight: 600; color: #4b5563; }
        .feed-empty { padding: 24px 16px; font-size: 12px; color: #374151; text-align: center; }
        .feed-item { padding: 10px 14px; border-bottom: 1px solid #0f1218; display: flex; gap: 10px; align-items: flex-start; transition: background .15s; }
        .feed-item:last-child { border-bottom: none; }
        .feed-item:hover { background: #0a0e18; }
        .feed-score { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
        .feed-info { flex: 1; min-width: 0; }
        .feed-date { font-size: 10px; color: #4b5563; font-family: 'DM Mono', monospace; margin-bottom: 3px; }
        .feed-note { font-size: 12px; color: #9ca3af; line-height: 1.5; font-style: italic; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }

        /* ── SIDEBAR ── */
        .sidebar { display: grid; gap: 10px; position: sticky; top: 24px; }

        .profile-card {
          border-radius: 14px; padding: 20px 18px;
          border: 1px solid ${hue.border};
          background: linear-gradient(170deg, ${hue.bg} 0%, #0c0e14 65%);
          animation: fadeUp .3s ease both;
        }
        .avatar-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .avatar {
          width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700;
          color: ${hue.fg}; background: #0a0c10; border: 2px solid ${hue.border};
        }
        .status-pill {
          font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px;
          text-transform: uppercase; letter-spacing: .05em;
          color: ${hue.fg}; background: ${hue.bg}; border: 1px solid ${hue.border};
        }
        .p-name { font-size: 17px; font-weight: 700; letter-spacing: -.02em; color: #f1f3f8; line-height: 1.15; }
        .p-sub  { font-size: 12px; color: #6b7280; margin-top: 3px; }

        .score-row { display: flex; align-items: center; gap: 10px; margin: 14px 0 6px; }
        .score-big { font-size: 36px; font-weight: 700; letter-spacing: -.04em; line-height: 1; color: ${hue.fg}; }
        .score-aside { display: flex; flex-direction: column; gap: 2px; }
        .score-aside-label { font-size: 10px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: .06em; }
        .score-aside-delta { font-size: 12px; font-weight: 700; }

        .sparkline { display: flex; align-items: flex-end; gap: 3px; height: 22px; margin-bottom: 14px; }
        .spark-bar { width: 8px; border-radius: 3px 3px 0 0; }

        .divider { height: 1px; background: #131720; margin: 12px 0; }

        .info-row { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; gap: 8px; }
        .info-key { font-size: 10px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: .05em; flex-shrink: 0; }
        .info-val { font-size: 11px; color: #9ca3af; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }

        .diag-chip { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 10px; border: 1px solid #1f2533; background: #111420; color: #6b7280; font-size: 9px; font-weight: 600; margin: 2px 2px 2px 0; }
        .mod-chip  { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 20px; border: 1px solid #0e2e1a; background: #061a0b; color: #4ade80; font-size: 10px; font-weight: 600; margin: 2px 2px 2px 0; }

        .info-card { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; padding: 14px 16px; animation: fadeUp .3s ease .05s both; }
        .info-card-title { font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; }

        /* ── MAIN ── */
        .main { display: grid; gap: 12px; }

        .action-card { padding: 18px 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 8px; animation: fadeUp .3s ease .04s both; }
        .action-card--alert  { border: 1px solid #3d1a1a; background: linear-gradient(135deg, #140808, #0f0606); }
        .action-card--warn   { border: 1px solid #3d2800; background: linear-gradient(135deg, #140e04, #0f0b04); }
        .action-card--stable { border: 1px solid #0e2e1a; background: linear-gradient(135deg, #060f08, #040c06); }
        .action-left { display: flex; align-items: center; gap: 14px; }
        .action-icon { font-size: 22px; flex-shrink: 0; }
        .action-title { font-size: 15px; font-weight: 700; color: #f1f3f8; }
        .action-body  { font-size: 13px; color: #9ca3af; margin-top: 3px; line-height: 1.5; }
        .action-btn { padding: 10px 18px; border-radius: 9px; flex-shrink: 0; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; white-space: nowrap; }
        .action-btn--alert  { border: 1px solid #552222; background: #2a0a0a; color: #fca5a5; }
        .action-btn--alert:hover { background: #3d0f0f; }
        .action-btn--stable { border: 1px solid #0e2e1a; background: #061a0b; color: #86efac; }
        .action-btn--stable:hover { background: #0a2412; }
        .action-btn--done   { color: #4ade80 !important; border-color: #0e2e1a !important; background: #061a0b !important; }

        .trend-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; animation: fadeUp .3s ease .08s both; }
        @media (max-width: 500px) { .trend-row { grid-template-columns: 1fr; } }
        .trend-card { padding: 10px 14px; border-radius: 10px; border: 1px solid #1a1e2a; background: #0d1018; }
        .trend-label { font-size: 10px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: .06em; }
        .trend-value { font-size: 20px; font-weight: 700; letter-spacing: -.02em; margin: 2px 0 1px; }
        .trend-sub   { font-size: 11px; color: #374151; }

        .context-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; animation: fadeUp .3s ease .11s both; }
        @media (max-width: 700px) { .context-row { grid-template-columns: 1fr; } }

        .ctx-card { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; }
        .ctx-head { padding: 12px 16px; border-bottom: 1px solid #131720; display: flex; align-items: center; justify-content: space-between; }
        .ctx-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
        .ctx-badge { font-size: 11px; font-weight: 600; color: #4b5563; }
        .ctx-body { padding: 10px 14px; }
        .notes-text { font-size: 13px; color: #9ca3af; line-height: 1.75; }
        .notes-empty { font-size: 12px; color: #374151; font-style: italic; }

        .sn-toggle { margin-top: 12px; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #4b5563; background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; }
        .sn-toggle:hover { color: #9ca3af; }
        .sn-entry { margin-top: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid #131720; background: #080c12; }
        .sn-date { font-size: 10px; font-weight: 700; color: #4b5563; letter-spacing: .04em; margin-bottom: 4px; }
        .sn-text { font-size: 12px; color: #9ca3af; line-height: 1.6; }

        .goals-bar { display: flex; gap: 3px; margin-bottom: 12px; }
        .goals-pip { height: 4px; flex: 1; border-radius: 2px; }
        .goal-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #0f1218; }
        .goal-item:last-child { border-bottom: none; }
        .goal-check { width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; }
        .goal-check--done { background: #061a0b; border: 1px solid #0e2e1a; color: #4ade80; }
        .goal-check--open { background: #0d1018; border: 1px solid #1f2533; }
        .goal-text { font-size: 13px; line-height: 1.5; }
        .goal-text--done { color: #374151; text-decoration: line-through; }
        .goal-text--open { color: #c8d0e0; }
        .goal-date { font-size: 10px; color: #4b5563; margin-top: 2px; }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }


        .history-wrap { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease .17s both; }
        .history-toggle { width: 100%; padding: 13px 18px; display: flex; align-items: center; justify-content: space-between; background: none; border: none; color: #6b7280; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; letter-spacing: .05em; text-transform: uppercase; transition: color .15s; }
        .history-toggle:hover { color: #9ca3af; }
        .chevron { transition: transform .2s; display: inline-block; }
        .chevron--open { transform: rotate(180deg); }
        .ci-row { display: flex; align-items: flex-start; gap: 12px; padding: 11px 0; border-bottom: 1px solid #0f1218; }
        .ci-row:last-child { border-bottom: none; }
        .ci-score { width: 38px; height: 38px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; flex-shrink: 0; }
        .ci-date { font-size: 11px; color: #4b5563; font-family: 'DM Mono', monospace; }
        .ci-note { font-size: 13px; color: #9ca3af; margin-top: 3px; line-height: 1.5; font-style: italic; }

        .skeleton { background: linear-gradient(90deg,#111420 0%,#1a1e2a 50%,#111420 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 5px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 500px) {
          .action-card { flex-direction: column; align-items: stretch; }
          .action-btn { width: 100%; text-align: center; min-height: 44px; }
        }

        /* ── CLINICAL NOTES EDITABLE ── */
        .cn-wrap { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease .09s both; }
        .cn-head { padding: 12px 16px; border-bottom: 1px solid #131720; display: flex; align-items: center; justify-content: space-between; }
        .cn-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
        .cn-saved { font-size: 10px; font-weight: 600; color: #4ade80; transition: opacity .3s; }
        .cn-body { padding: 10px 14px; }
        .cn-textarea { width: 100%; min-height: 120px; padding: 10px 12px; border-radius: 8px; border: 1px solid #1f2533; background: #080c12; color: #c8d0e0; font-size: 13px; font-family: inherit; line-height: 1.7; resize: vertical; outline: none; transition: border-color .15s; }
        .cn-textarea:focus { border-color: #2a3560; }
        .cn-textarea::placeholder { color: #374151; }
        .cn-display { font-size: 13px; color: #9ca3af; line-height: 1.75; white-space: pre-wrap; }
        .cn-btn { font-size: 11px; font-weight: 600; color: #4b5563; background: none; border: 1px solid #1f2533; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .cn-btn:hover { color: #9ca3af; border-color: #2a3050; }

        /* ── GOAL ADD FORM ── */
        .goal-add-row { display: flex; gap: 8px; margin-top: 10px; }
        .goal-add-input { flex: 1; padding: 7px 10px; border-radius: 7px; border: 1px solid #1f2533; background: #0a0c12; color: #e2e8f0; font-size: 12px; font-family: inherit; outline: none; }
        .goal-add-input:focus { border-color: #2a3560; }
        .goal-add-input::placeholder { color: #374151; }
        .goal-add-btn { padding: 7px 14px; border-radius: 7px; border: 1px solid #0e2e1a; background: #061a0b; color: #4ade80; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .goal-add-btn:hover { background: #0a2412; }

        /* ── MESSAGES PLACEHOLDER ── */
        .msg-wrap { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease .18s both; }
        .msg-head { padding: 12px 16px; border-bottom: 1px solid #131720; }
        .msg-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
        .msg-body { padding: 14px 16px; }
        .msg-bubble { padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.55; max-width: 85%; margin-bottom: 10px; }
        .msg-bubble--patient { background: #111420; border: 1px solid #1f2533; color: #c8d0e0; margin-right: auto; border-bottom-left-radius: 4px; }
        .msg-bubble--therapist { background: #0d1220; border: 1px solid #1a2240; color: #9ca3af; margin-left: auto; border-bottom-right-radius: 4px; }
        .msg-sender { font-size: 10px; font-weight: 700; color: #4b5563; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .05em; }
        .msg-placeholder { text-align: center; padding: 24px 16px; }
        .msg-placeholder-icon { font-size: 28px; margin-bottom: 8px; opacity: 0.3; }
        .msg-placeholder-text { font-size: 13px; color: #374151; line-height: 1.6; }

        /* ── CLINICAL ALERT BAR ── */
        .clinical-alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 10px; border-left: 4px solid #d97706; background: rgba(217,119,6,0.08); animation: fadeUp .3s ease both; }
        .clinical-alert-icon { font-size: 16px; flex-shrink: 0; line-height: 1.2; }
        .clinical-alert-body { flex: 1; min-width: 0; }
        .clinical-alert-title { font-size: 13px; font-weight: 700; color: #fbbf24; line-height: 1.4; }
        .clinical-alert-detail { font-size: 12px; color: #92400e; margin-top: 2px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .clinical-alert-dismiss { background: none; border: none; color: #92400e; font-size: 16px; cursor: pointer; padding: 0 2px; line-height: 1; flex-shrink: 0; transition: color .15s; }
        .clinical-alert-dismiss:hover { color: #fbbf24; }

        /* ── CHECK-IN SUMMARY SECTION ── */
        .checkin-summary { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease .08s both; }
        .checkin-summary-label { font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: .08em; padding: 14px 16px 10px; }

        /* ── SIDEBAR TABS ── */
        .tab-panel { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease .05s both; }
        .tab-bar { display: flex; gap: 4px; padding: 10px 14px 0; }
        .tab-pill { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 6px 14px; border-radius: 20px; border: none; cursor: pointer; font-family: inherit; transition: all .15s; background: transparent; color: #4b5563; }
        .tab-pill:hover { color: #9ca3af; }
        .tab-pill--active { background: rgba(107,130,212,0.1); color: #6b82d4; border: 1px solid rgba(107,130,212,0.2); }
        .tab-content { padding: 10px 14px 14px; }
      `}</style>

      <div className="shell">
        <Link href="/cases" className="back">← Cases</Link>

        {loading ? (
          <div style={{ opacity: 0.4, fontSize: 13 }}>Loading case…</div>
        ) : (
          <>
          {error && (
            <div className="error-box" style={{ margin: "20px 0" }}>
              {error}
              <button onClick={() => { setError(null); setLoading(true); window.location.reload(); }} style={{ marginLeft: 12, background: "none", border: "1px solid #3d1a1a", borderRadius: 6, color: "#fca5a5", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
            </div>
          )}
          <div className="layout">

            {/* ── SIDEBAR ── */}
            <aside className="sidebar">

              {/* ── PHI BOUNDARY: Identity header (name only, no scores) ── */}
              <div className="profile-card" data-phi="identity-header">
                <div className="avatar-row">
                  <div className="avatar">{initials || "?"}</div>
                  <div className="status-pill">
                    {isLow ? "At risk" : isDropping ? "Declining" : isStale ? "Stale" : "Stable"}
                  </div>
                </div>

                <div className="p-name">{patientName}</div>
                <div className="p-sub">{d?.therapist?.name ?? "Unassigned"}</div>
              </div>

              {/* ── PHI BOUNDARY: Clinical data (scores only, no patient name) ── */}
              <div className="profile-card" data-phi="clinical-data" style={{ marginTop: 0 }}>
                <div className="score-row">
                  <div className="score-big">{latest?.score ?? "—"}</div>
                  <div className="score-aside">
                    <div className="score-aside-label">Latest score</div>
                    <div className="score-aside-delta" style={{ color: delta == null ? "#6b7280" : delta < 0 ? "#f87171" : "#4ade80" }}>
                      {delta == null ? "no baseline" : delta < 0 ? `↓ ${Math.abs(delta).toFixed(1)} vs avg` : `↑ ${delta.toFixed(1)} vs avg`}
                    </div>
                  </div>
                </div>

                <div className="sparkline">
                  {[...checkins].slice(0, 8).reverse().map((c, i) => {
                    const h = scoreHue(c.score);
                    return <div key={i} className="spark-bar" style={{ height: c.score ? Math.max(4, (c.score / 10) * 22) : 4, background: h.fg, opacity: 0.8 }} />;
                  })}
                </div>

                <div className="divider" />

                <div className="info-row"><span className="info-key">Case</span><span className="info-val">{d?.case?.title ?? "—"}</span></div>
                <div className="info-row"><span className="info-key">Status</span><span className="info-val">{d?.case?.status ?? "—"}</span></div>
                <div className="info-row"><span className="info-key">Opened</span><span className="info-val">{d?.case?.created_at ? fmtShort(d.case.created_at) : "—"}</span></div>
                <div className="info-row"><span className="info-key">Check-ins</span><span className="info-val">{checkins.length} recorded</span></div>
              </div>

              {/* Therapist card */}
              {(te.license_type || (te.therapy_modalities ?? []).length > 0) && (
                <div className="info-card">
                  <div className="info-card-title">Therapist</div>
                  {te.license_type && <div className="info-row"><span className="info-key">License</span><span className="info-val">{te.license_type}{te.license_state ? ` · ${te.license_state}` : ""}</span></div>}
                  {(te.therapy_modalities ?? []).length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Modalities</div>
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        {te.therapy_modalities!.map(m => <span key={m} className="mod-chip">{m}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Diagnostic codes — collapsible */}
              <div className="info-card">
                <div
                  className="info-card-title"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                  onClick={() => setDsmExpanded(v => !v)}
                >
                  <span>DSM Codes {dsmCodes.length > 0 ? `(${dsmCodes.length})` : ""}</span>
                  <span style={{ fontSize: 10, color: "#4b5563", transition: "transform 0.15s", transform: dsmExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                </div>
                {!dsmExpanded && dsmCodes.length === 0 && (
                  <div style={{ fontSize: 11, color: "#4b5563", fontStyle: "italic" }}>No codes added</div>
                )}
                {!dsmExpanded && dsmCodes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {dsmCodes.map(code => (
                      <span key={code} className="diag-chip">{code}</span>
                    ))}
                  </div>
                )}
                {dsmExpanded && (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: dsmCodes.length > 0 ? 8 : 0 }}>
                      {dsmCodes.map(code => (
                        <span key={code} className="diag-chip" style={{ gap: 4 }}>
                          {code}
                          <button
                            onClick={() => removeDsmCode(code)}
                            style={{ background: "none", border: "none", color: "#6b82d4", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, fontFamily: "inherit", lineHeight: 1 }}
                            aria-label={`Remove ${code}`}
                          >&times;</button>
                        </span>
                      ))}
                    </div>
                    {dsmCodes.length < 5 && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          value={dsmInput}
                          onChange={e => setDsmInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDsmCode(); } }}
                          placeholder="e.g. F41.1"
                          style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #1f2533", background: "#080c12", color: "#c8d0e0", fontSize: 11, fontFamily: "inherit" }}
                        />
                        <button
                          onClick={addDsmCode}
                          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #1f2533", background: "#0d1018", color: "#6b82d4", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        >Add</button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sidebar tabs — Care Plan / Notes */}
              <div className="tab-panel">
                <div className="tab-bar">
                  <button className={`tab-pill ${sidebarTab === "care" ? "tab-pill--active" : ""}`} onClick={() => setSidebarTab("care")}>Care Plan</button>
                  <button className={`tab-pill ${sidebarTab === "notes" ? "tab-pill--active" : ""}`} onClick={() => setSidebarTab("notes")}>Notes</button>
                </div>
                <div className="tab-content">
                  {sidebarTab === "care" ? (
                    <>
                      {/* Treatment goals — MOVED FROM MIDDLE COLUMN */}
                      <div className="ctx-head" style={{ padding: "12px 0", borderBottom: "1px solid #131720" }}>
                        <div className="ctx-title">Treatment goals</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {goalsTotal > 0 && <div className="ctx-badge">{goalsDone}/{goalsTotal} complete</div>}
                          <button className="cn-btn" onClick={() => setShowAddGoal(v => !v)}>
                            {showAddGoal ? "Cancel" : "+ Add"}
                          </button>
                        </div>
                      </div>
                      <div style={{ padding: "10px 0" }}>
                        {showAddGoal && (
                          <div className="goal-add-row" style={{ marginBottom: 10 }}>
                            <input
                              className="goal-add-input"
                              placeholder="Goal title..."
                              value={newGoalTitle}
                              onChange={e => setNewGoalTitle(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && addGoal()}
                            />
                            <button className="goal-add-btn" onClick={addGoal}>Add</button>
                          </div>
                        )}
                        {goalsTotal > 0 && (
                          <div className="goals-bar">
                            {goals.map(g => {
                              const done = g.status === "done" || g.status === "completed";
                              return <div key={g.id} className="goals-pip" style={{ background: done ? "#0e2e1a" : "#1a1e2a" }} />;
                            })}
                          </div>
                        )}
                        {goals.length === 0 && !showAddGoal
                          ? <p className="notes-empty">No goals set yet.</p>
                          : goals.map(g => {
                              const done = g.status === "done" || g.status === "completed";
                              return (
                                <div key={g.id} className="goal-item">
                                  <div
                                    className={`goal-check ${done ? "goal-check--done" : "goal-check--open"}`}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => toggleGoalStatus(g)}
                                  >
                                    {done ? "✓" : ""}
                                  </div>
                                  <div>
                                    <div className={`goal-text ${done ? "goal-text--done" : "goal-text--open"}`}>{g.title}</div>
                                    {g.target_date && <div className="goal-date">Target: {fmtDate(g.target_date)}</div>}
                                  </div>
                                </div>
                              );
                            })}
                      </div>

                    </>
                  ) : (
                    <>
                      {/* Clinical notes — MOVED FROM MIDDLE COLUMN */}
                      <div className="cn-head" style={{ padding: "12px 0", borderBottom: "1px solid #131720" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className={`chevron ${!clinicalNotesCollapsed ? "chevron--open" : ""}`} style={{ fontSize: 10, color: "#4b5563" }}>▾</span>
                          <div className="cn-title">Clinical Notes</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {clinicalNotesSaved && <span className="cn-saved">✓ Saved</span>}
                          <button className="cn-btn" onClick={(e) => {
                            e.stopPropagation();
                            if (clinicalNotesEditing) {
                              saveClinicalNotes(clinicalNotes);
                            }
                            setClinicalNotesEditing(v => !v);
                            if (!clinicalNotesEditing) setClinicalNotesCollapsed(false);
                          }}>
                            {clinicalNotesEditing ? "Done" : "Edit"}
                          </button>
                        </div>
                      </div>
                      {clinicalNotesCollapsed && !clinicalNotesEditing ? (
                        clinicalNotes ? (
                          <div style={{ padding: "10px 0", cursor: "pointer" }} onClick={() => setClinicalNotesCollapsed(false)}>
                            <div className="cn-display" style={{ color: "#6b7280", fontSize: 12 }}>{clinicalNotes.slice(0, 100)}{clinicalNotes.length > 100 ? "…" : ""}</div>
                          </div>
                        ) : null
                      ) : (
                        <div style={{ padding: "10px 0" }}>
                          {clinicalNotesEditing ? (
                            <textarea
                              className="cn-textarea"
                              value={clinicalNotes}
                              onChange={e => handleClinicalNotesChange(e.target.value)}
                              placeholder="Add clinical observations, session notes, or treatment context here..."
                              autoFocus
                            />
                          ) : clinicalNotes ? (
                            <div className="cn-display">{clinicalNotes}</div>
                          ) : (
                            <p className="notes-empty" style={{ cursor: "pointer" }} onClick={() => setClinicalNotesEditing(true)}>
                              Add clinical observations, session notes, or treatment context here...
                            </p>
                          )}

                          {sessionNotes.length > 0 ? (
                            <>
                              <button className="sn-toggle" onClick={() => setNotesOpen(o => !o)}>
                                <span className={`chevron ${notesOpen ? "chevron--open" : ""}`}>▾</span>
                                Session notes ({sessionNotes.length})
                              </button>
                              {notesOpen && sessionNotes.map((n, i) => (
                                <div key={i} className="sn-entry">
                                  <div className="sn-date">{fmtDate(n.date)}</div>
                                  <div className="sn-text">{n.text}</div>
                                </div>
                              ))}
                            </>
                          ) : (
                            <div style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic", padding: "8px 0" }}>No session notes recorded yet</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </aside>

            {/* ── MAIN COLUMN ── */}
            <div className="main">

              {/* Context changed notice */}
              {dsmContextChanged && (
                <div style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(165,180,252,0.2)", background: "rgba(165,180,252,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#a5b4fc" }}>
                  <span>Context updated — regenerate session prep for updated recommendations</span>
                  <button onClick={() => setDsmContextChanged(false)} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>&times;</button>
                </div>
              )}

              {/* Clinical alert bar — score ≤ 3 */}
              {!alertDismissed && latest?.score != null && latest.score <= 3 && (
                <div className="clinical-alert">
                  <div className="clinical-alert-icon">⚠</div>
                  <div className="clinical-alert-body">
                    <div className="clinical-alert-title">Score dropped to {latest.score} this week</div>
                    {noteText(latest) && (
                      <div className="clinical-alert-detail">{noteText(latest)!.slice(0, 80)}{(noteText(latest)!.length > 80) ? "…" : ""}</div>
                    )}
                  </div>
                  <button className="clinical-alert-dismiss" onClick={() => setAlertDismissed(true)} title="Dismiss">&times;</button>
                </div>
              )}

              {/* 1. SESSION PREP — always first */}
              <SessionPrepCard caseId={id} weekStart={new Date().toISOString().slice(0, 10)} onReviewedChange={setSessionPrepReviewed} onDataChange={setSessionPrepData} />

              {/* 2. Check-in summary — stats + history unified */}
              <div className="checkin-summary">
                <div className="checkin-summary-label">Check-in summary</div>
                <div style={{ padding: "0 14px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Previous",   value: prev?.score?.toString() ?? "—",  sub: prev?.created_at ? fmtShort(prev.created_at) : "—", color: scoreHue(prev?.score ?? null).fg },
                    { label: "6-wk avg",   value: avgScore?.toFixed(1) ?? "—",      sub: `${checkins.length} check-ins`,                     color: scoreHue(avgScore ?? null).fg },
                    { label: "Days since", value: latest?.created_at ? `${daysSince(latest.created_at)}d` : "—", sub: "last check-in", color: isStale ? "#f97316" : "#9ca3af" },
                  ].map((s) => (
                    <div key={s.label} className="trend-card" style={{ border: "none", background: "transparent", padding: "8px 0" }}>
                      <div className="trend-label">{s.label}</div>
                      <div className="trend-value" style={{ color: s.color }}>{s.value}</div>
                      <div className="trend-sub">{s.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid #131720" }}>
                  <div className="feed-head" style={{ borderBottom: checkins.length > 0 ? "1px solid #131720" : "none" }}>
                    <span className="feed-title">History</span>
                    <span className="feed-count">{checkins.length} entries</span>
                  </div>
                  <div style={{ padding: "4px 0 8px" }}>
                    {checkins.length === 0 ? (
                      <div className="feed-empty">No check-ins recorded yet</div>
                    ) : (
                      <>
                        {(historyExpanded ? checkins : checkins.slice(0, 3)).map((ci, idx) => {
                          const h = scoreHue(ci.score);
                          return (
                            <div key={ci.id} className="feed-item">
                              <div className="feed-score" style={{ background: h.bg, border: `1px solid ${h.border}`, color: h.fg }}>
                                {ci.score ?? "—"}
                              </div>
                              <div className="feed-info">
                                <div className="feed-date">{fmtFull(ci.created_at)}{idx === 0 ? " · latest" : ""}</div>
                                {noteText(ci)
                                  ? <div className="feed-note">&quot;{noteText(ci)}&quot;</div>
                                  : <div className="feed-note" style={{ opacity: 0.3 }}>No note</div>}
                              </div>
                            </div>
                          );
                        })}
                        {checkins.length > 3 && (
                          <button
                            onClick={() => setHistoryExpanded(v => !v)}
                            style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderTop: "1px solid #0f1218", color: "#4b5563", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".03em" }}
                          >
                            {historyExpanded ? "Show less" : `Show all ${checkins.length} check-ins`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="right-col">

              {/* PATIENT ALERT — only when latest score ≤ 3 */}
              {latest?.score != null && latest.score <= 3 && (() => {
                const flaggedText = sessionPrepData?.watch_for ?? sessionPrepData?.open_with ?? null;
                const trendLabel = sessionPrepData?.rating_trend === "declining" ? "Declining trend detected" : null;
                const prepLine = flaggedText
                  ? `Prep flagged: ${flaggedText.slice(0, 80)}${flaggedText.length > 80 ? "…" : ""}`
                  : trendLabel ?? null;
                return (
                  <div style={{ borderRadius: 10, border: "1px solid #1a1e2a", borderLeft: "4px solid #d97706", background: "#0d1018", padding: "14px 16px", display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#d97706", letterSpacing: "0.04em" }}>PATIENT ALERT</div>
                    <div style={{ fontSize: 12, color: prepLine ? "#9ca3af" : "#4b5563", lineHeight: 1.5 }}>
                      {prepLine ?? "Generate prep to see AI-flagged signals"}
                    </div>
                    <button
                      className={`action-btn ${sessionPrepReviewed ? "action-btn--alert" : ""} ${copied === "action" ? "action-btn--done" : ""}`}
                      onClick={() => sessionPrepReviewed && copy(outreachText, "action")}
                      disabled={!sessionPrepReviewed}
                      title={sessionPrepReviewed ? "Copy prep-informed message" : "Review session prep first"}
                      style={{
                        width: "100%", padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: sessionPrepReviewed ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all .15s",
                        border: sessionPrepReviewed ? undefined : "1px solid #1f2533",
                        background: sessionPrepReviewed ? undefined : "#111420",
                        color: sessionPrepReviewed ? undefined : "#4b5563",
                        opacity: sessionPrepReviewed ? 1 : 0.6,
                      }}
                    >
                      {copied === "action" ? "✓ Copied" : sessionPrepReviewed ? "Copy prep-informed message" : "Review prep first"}
                    </button>
                  </div>
                );
              })()}

              {/* Between Sessions */}
              <div className="ctx-card">
                <div className="ctx-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {(ep.activities ?? []).length > 2 && (
                      <span className={`chevron ${activitiesExpanded ? "chevron--open" : ""}`} style={{ fontSize: 10, color: "#4b5563", cursor: "pointer" }} onClick={() => setActivitiesExpanded(v => !v)}>▾</span>
                    )}
                    <div className="ctx-title">Between Sessions</div>
                  </div>
                  <div className="ctx-badge">{(ep.activities ?? []).length} entries</div>
                </div>
                <div className="ctx-body">
                  {(ep.activities ?? []).length === 0 ? (
                    <p className="notes-empty">No homework assigned yet</p>
                  ) : (() => {
                    const sortedActivities = [...(ep.activities ?? [])].sort((a, b) => b.date.localeCompare(a.date));
                    return (
                      <>
                        <div style={{ display: "grid", gap: 10 }}>
                          {(activitiesExpanded ? sortedActivities : sortedActivities.slice(0, 2)).map((act, i) => (
                            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", whiteSpace: "nowrap", paddingTop: 2, minWidth: 72 }}>{fmtDate(act.date)}</div>
                              <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.55 }}>{act.description}</div>
                            </div>
                          ))}
                        </div>
                        {sortedActivities.length > 2 && (
                          <button
                            onClick={() => setActivitiesExpanded(v => !v)}
                            style={{ width: "100%", padding: "8px 0 0", background: "none", border: "none", color: "#4b5563", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {activitiesExpanded ? "Show less" : `Show all ${sortedActivities.length} activities`}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Messages — collapsed placeholder */}
              <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #1a1e2a", background: "#0d1018", fontSize: 11, color: "#374151", textAlign: "center" }}>
                Patient messaging coming soon
              </div>

            </div>

          </div>
          </>
        )}
      </div>
    </>
  );
}
