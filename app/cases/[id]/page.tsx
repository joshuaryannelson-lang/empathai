/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { isDemoMode } from "@/lib/demo/demoMode";
import { RISK_THRESHOLDS } from "@/lib/services/risk";
import MarkdownContent from "@/app/components/MarkdownContent";

// ─── Types ────────────────────────────────────────────────────────────────────
type ExtendedPatient = {
  email?: string;
  phone?: string;
  date_of_birth?: string;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
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
  notes: string | null;
};

type TimelineResponse = {
  case: { id: string; title: string | null; status: string | null; created_at: string };
  patient: { first_name: string | null; last_name: string | null; extended_profile?: ExtendedPatient } | null;
  therapist: { name: string | null; extended_profile?: ExtendedTherapist } | null;
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
const fullName  = (f?: string | null, l?: string | null) => `${f ?? ""} ${l ?? ""}`.trim() || "Patient";
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

// ─── AI Prompt ────────────────────────────────────────────────────────────────
function buildPrompt(d: TimelineResponse, goals: Goal[]): string {
  const name = fullName(d.patient?.first_name, d.patient?.last_name);
  const ep = d.patient?.extended_profile ?? {};
  const te = d.therapist?.extended_profile ?? {};
  const history = d.checkins.slice(0, 6).map((c, i) =>
    `  ${i === 0 ? "latest" : `-${i}w`}: score ${c.score ?? "—"}, note: "${noteText(c) ?? "none"}"`
  ).join("\n");
  const latest = d.checkins[0];

  const diagLine        = ep.primary_diagnosis ? `Diagnosis: ${ep.primary_diagnosis}` : "";
  const secDx           = (ep.secondary_diagnoses ?? []).length ? `Secondary: ${ep.secondary_diagnoses!.join(", ")}` : "";
  const clinicalNotes   = ep.clinical_notes ? `\nClinical notes:\n${ep.clinical_notes}` : "";
  const recentSessions  = (ep.session_notes ?? []).slice(0, 3).map(n => `  [${n.date}] ${n.text}`).join("\n");
  const sessionBlock    = recentSessions ? `\nRecent session notes:\n${recentSessions}` : "";
  const recentActs      = (ep.activities ?? []).slice(-4).map(a => `  [${a.date}] ${a.description}`).join("\n");
  const activitiesBlock = recentActs ? `\nRecent activities/homework:\n${recentActs}` : "";
  const goalsBlock      = goals.length ? `\nTreatment goals:\n${goals.map(g => `  [${g.status}] ${g.title}`).join("\n")}` : "";
  const modalitiesLine  = (te.therapy_modalities ?? []).length ? `Therapist modalities: ${te.therapy_modalities!.join(", ")}` : "";
  const specLine        = (te.specializations ?? []).length ? `Specializations: ${te.specializations!.join(", ")}` : "";

  return `You are a clinical AI assistant helping a therapist prepare for a session in under 2 minutes.

Patient: ${name}
Case: ${d.case?.title ?? "—"}
${diagLine}
${secDx}
${modalitiesLine}
${specLine}

Latest score: ${latest?.score ?? "—"}/10 (${latest?.created_at ? daysSince(latest.created_at) + " days ago" : "unknown"})
Latest note: "${noteText(latest) ?? "none"}"

Score history:
${history}
${clinicalNotes}
${sessionBlock}
${activitiesBlock}
${goalsBlock}

Reply with EXACTLY these four labeled lines (label in ALL CAPS, colon, then content on same line):
OPEN WITH: One specific opening question tailored to this patient right now.
WATCH FOR: One clinical pattern or risk to keep in mind this session.
TRY THIS: One concrete technique or intervention suited to this patient.
SEND THIS: A warm 1-2 sentence text to send before the session, first-person from therapist.

Be specific. Be direct. No preamble or bullets within sections.`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CasePage() {
  const params = useParams();
  const id = params?.id as string;

  const [d, setD]               = useState<TimelineResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [goals, setGoals]       = useState<Goal[]>([]);

  const [notesOpen, setNotesOpen]     = useState(false);
  const [copied, setCopied]     = useState<string | null>(null);

  // Tasks state
  type TaskRow = {
    id: string;
    case_id: string;
    assigned_to_role: "therapist" | "patient";
    created_by: "ai" | "therapist" | "system";
    title: string;
    description: string | null;
    status: "pending" | "in_progress" | "completed" | "dismissed";
    due_date: string | null;
    created_at: string;
  };
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskGenLoading, setTaskGenLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskRole, setNewTaskRole] = useState<"therapist" | "patient">("patient");

  const [aiText, setAiText]       = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone]       = useState(false);
  const [aiError, setAiError]     = useState<string | null>(null);
  const aiSectionRef = useRef<HTMLDivElement>(null);

  // Clinical notes state
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [clinicalNotesEditing, setClinicalNotesEditing] = useState(false);
  const [clinicalNotesSaved, setClinicalNotesSaved] = useState(false);
  const clinicalNotesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Goals add state
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  // Demo mode detection (client side)
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => { setIsDemo(isDemoMode()); }, []);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/cases/${id}/timeline`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/cases/${id}/goals`,    { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/cases/${id}/tasks`,    { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/cases/${id}`,          { cache: "no-store" }).then(r => r.json()).catch(() => null),
    ]).then(([timelineJson, goalsJson, tasksJson, caseJson]) => {
      if (timelineJson) setD(timelineJson?.data ?? timelineJson);
      setGoals(goalsJson?.data ?? []);
      setTasks(tasksJson?.data ?? []);
      const caseData = caseJson?.data;
      if (caseData?.clinical_notes) setClinicalNotes(caseData.clinical_notes);
    }).finally(() => setLoading(false));
  }, [id]);

  // Session prep is on-demand — therapist clicks "Generate" instead of auto-firing on page load

  const checkins    = d?.checkins ?? [];
  const latest      = checkins[0] ?? null;
  const prev        = checkins[1] ?? null;
  const patientName = fullName(d?.patient?.first_name, d?.patient?.last_name);
  const initials    = (d?.patient?.first_name?.[0] ?? "") + (d?.patient?.last_name?.[0] ?? "");
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

  async function loadTasks() {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/cases/${id}/tasks`, { cache: "no-store" });
      const json = await res.json();
      setTasks(json?.data ?? []);
    } catch { /* ignore */ }
    finally { setTasksLoading(false); }
  }

  async function generateTasksAI() {
    setTaskGenLoading(true);
    try {
      const res = await fetch(`/api/cases/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "ai", therapistId: d?.therapist?.name ?? "" }),
      });
      if (!res.ok) {
        console.error("[generateTasksAI] POST failed:", res.status);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const generated = json?.data?.tasks;
      if (Array.isArray(generated) && generated.length > 0) {
        console.log("[generateTasksAI] Got", generated.length, "tasks from POST response");
        setTasks(prev => [...generated, ...prev]);
      } else {
        console.log("[generateTasksAI] No tasks in POST response, re-fetching...");
        await loadTasks();
      }
    } catch (e) { console.error("[generateTasksAI] Error:", e); }
    finally { setTaskGenLoading(false); }
  }

  async function addManualTask() {
    if (!newTaskTitle.trim()) return;
    const taskData = { title: newTaskTitle, description: newTaskDesc || undefined, assignedToRole: newTaskRole };
    try {
      const res = await fetch(`/api/cases/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger: "manual",
          therapistId: d?.therapist?.name ?? "",
          task: taskData,
        }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const created = json?.data;
        if (created?.id) {
          setTasks(prev => [created, ...prev]);
        } else {
          await loadTasks();
        }
      } else {
        // Demo mode returns 403 — create task locally
        const localTask: TaskRow = {
          id: `local-${Date.now()}`,
          case_id: id as string,
          assigned_to_role: newTaskRole,
          created_by: "therapist",
          title: newTaskTitle,
          description: newTaskDesc || null,
          status: "pending",
          due_date: null,
          created_at: new Date().toISOString(),
        };
        setTasks(prev => [localTask, ...prev]);
      }
      setNewTaskTitle(""); setNewTaskDesc(""); setShowAddTask(false);
    } catch { /* ignore */ }
  }

  async function cycleTaskStatus(task: TaskRow) {
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, userId: d?.therapist?.name ?? "" }),
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next as TaskRow["status"] } : t));
      }
    } catch { /* ignore */ }
  }

  const therapistTasks = tasks.filter(t => t.assigned_to_role === "therapist");
  const patientTasks = tasks.filter(t => t.assigned_to_role === "patient");

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

  async function generateAI(data: TimelineResponse, goalList: Goal[]) {
    setAiLoading(true); setAiText(""); setAiDone(false); setAiError(null);
    setTimeout(() => aiSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    try {
      const res = await fetch(`/api/cases/${id}/session-prep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt(data, goalList), stream: true }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`API ${res.status}: ${(errJson as any)?.error ?? JSON.stringify(errJson)}`);
      }

      // Stream text from ReadableStream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAiText(accumulated);
      }

      if (!accumulated.trim()) throw new Error("Empty response");
    } catch (e: any) {
      setAiError(e?.message ?? String(e));
    } finally {
      setAiLoading(false); setAiDone(true);
    }
  }

  const aiSections = useMemo(() => {
    if (!aiText || !aiDone) return null;
    const keys = ["OPEN WITH", "WATCH FOR", "TRY THIS", "SEND THIS"];
    const out: Record<string, string> = {};
    for (const k of keys) {
      const m = aiText.match(new RegExp(`${k}:\\s*(.+?)(?=\\n[A-Z ]+:|$)`, "s"));
      if (m) out[k] = m[1].trim();
    }
    return Object.keys(out).length >= 2 ? out : null;
  }, [aiText, aiDone]);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .shell  { max-width: 1320px; margin: 0 auto; padding: 28px 24px 80px; }
        .back   { font-size: 12px; font-weight: 500; color: #4b5563; text-decoration: none; letter-spacing: .05em; text-transform: uppercase; transition: color .15s; display: inline-block; margin-bottom: 20px; }
        .back:hover { color: #9ca3af; }

        .layout { display: grid; grid-template-columns: 264px 1fr 256px; gap: 16px; align-items: start; }
        @media (max-width: 1000px) { .layout { grid-template-columns: 264px 1fr; } .feed-col { display: none; } }
        @media (max-width: 700px)  {
          .layout { grid-template-columns: 1fr; }
          .sidebar { position: static; }
          .shell { padding: 16px 12px 60px; }
        }

        /* ── ACTIVITY FEED ── */
        .feed-col { position: sticky; top: 24px; border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; max-height: calc(100vh - 48px); display: flex; flex-direction: column; }
        .feed-head { padding: 13px 16px; border-bottom: 1px solid #131720; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .feed-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
        .feed-count { font-size: 11px; font-weight: 600; color: #4b5563; }
        .feed-body { overflow-y: auto; flex: 1; padding: 4px 0 8px; }
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

        .diag-chip { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 20px; border: 1px solid #2a3050; background: #0d1220; color: #6b82d4; font-size: 10px; font-weight: 600; margin: 2px 2px 2px 0; }
        .mod-chip  { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 20px; border: 1px solid #0e2e1a; background: #061a0b; color: #4ade80; font-size: 10px; font-weight: 600; margin: 2px 2px 2px 0; }

        .info-card { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; padding: 14px 16px; animation: fadeUp .3s ease .05s both; }
        .info-card-title { font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; }

        /* ── MAIN ── */
        .main { display: grid; gap: 12px; }

        .action-card { padding: 18px 20px; border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 16px; animation: fadeUp .3s ease .04s both; }
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
        .trend-card { padding: 14px 16px; border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; }
        .trend-label { font-size: 10px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: .06em; }
        .trend-value { font-size: 22px; font-weight: 700; letter-spacing: -.02em; margin: 4px 0 2px; }
        .trend-sub   { font-size: 11px; color: #374151; }

        .context-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; animation: fadeUp .3s ease .11s both; }
        @media (max-width: 700px) { .context-row { grid-template-columns: 1fr; } }

        .ctx-card { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; }
        .ctx-head { padding: 12px 16px; border-bottom: 1px solid #131720; display: flex; align-items: center; justify-content: space-between; }
        .ctx-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
        .ctx-badge { font-size: 11px; font-weight: 600; color: #4b5563; }
        .ctx-body { padding: 14px 16px; }
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

        .ai-wrap { border-radius: 14px; border: 1px solid #1a2240; background: linear-gradient(160deg, #0a0e1c, #0d1018); overflow: hidden; animation: fadeUp .3s ease .14s both; }
        .ai-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid #131a30; }
        .ai-head-left { display: flex; align-items: center; gap: 10px; }
        .ai-gem { width: 26px; height: 26px; border-radius: 7px; background: linear-gradient(135deg, #3b4fd4, #6d3fc4); display: flex; align-items: center; justify-content: center; font-size: 13px; }
        .ai-head-title { font-size: 12px; font-weight: 600; color: #9ca3af; letter-spacing: .05em; text-transform: uppercase; }
        .ai-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: #1a2240; border: 1px solid #2a3560; color: #6b82d4; }
        .ai-regen { font-size: 11px; font-weight: 600; color: #4b5563; background: none; border: 1px solid #1f2533; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .ai-regen:hover { color: #9ca3af; border-color: #2a3050; }
        .ai-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px; }
        @media (max-width: 500px) { .ai-grid { grid-template-columns: 1fr; } }
        .ai-card { padding: 14px 16px; border-radius: 10px; border: 1px solid #131a30; background: #080c18; }
        .ai-card-label { font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
        .ai-card-text { font-size: 13px; line-height: 1.65; color: #c8d0e0; }
        .ai-cursor { display: inline-block; width: 2px; height: 13px; background: #6d3fc4; margin-left: 2px; vertical-align: middle; animation: blink 1s step-end infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .ai-foot { padding: 9px 18px 12px; display: flex; align-items: center; gap: 6px; border-top: 1px solid #0f1428; font-size: 11px; color: #374151; }
        .ai-foot-dot { width: 5px; height: 5px; border-radius: 50%; background: #6d3fc4; flex-shrink: 0; }

        .copy-btn { margin-top: 10px; padding: 5px 12px; border-radius: 7px; border: 1px solid #1f2533; background: #111420; color: #9ca3af; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
        .copy-btn:hover { border-color: #2e3650; color: #e8eaf0; }
        .copy-btn--done { color: #4ade80 !important; border-color: #0e2e1a !important; }

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

        /* ── TASKS ── */
        .tasks-wrap { border-radius: 14px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease .13s both; }
        .tasks-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid #131720; }
        .tasks-head-left { display: flex; align-items: center; gap: 10px; }
        .tasks-title { font-size: 12px; font-weight: 600; color: #9ca3af; letter-spacing: .05em; text-transform: uppercase; }
        .tasks-count { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: #111420; border: 1px solid #1f2533; color: #4b5563; }
        .tasks-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        @media (max-width: 500px) {
          .tasks-head { flex-direction: column; gap: 10px; align-items: stretch; }
          .tasks-actions { width: 100%; }
          .tasks-btn { flex: 1; text-align: center; min-height: 44px; }
          .task-form-row { flex-wrap: wrap; }
          .task-input { min-height: 44px; font-size: 16px; }
          .task-role-select { min-height: 44px; font-size: 14px; flex: 1; }
          .task-submit-btn { min-height: 44px; flex: 1; }
          .action-card { flex-direction: column; align-items: stretch; }
          .action-btn { width: 100%; text-align: center; min-height: 44px; }
        }
        .tasks-btn { font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 7px; border: 1px solid #1f2533; background: #111420; color: #9ca3af; cursor: pointer; font-family: inherit; transition: all .15s; }
        .tasks-btn:hover { border-color: #2e3650; color: #e8eaf0; }
        .tasks-btn--ai { border-color: #2a3560; background: #0d1220; color: #6b82d4; }
        .tasks-btn--ai:hover { background: #141b34; }
        .tasks-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .tasks-group { padding: 8px 14px; }
        .tasks-group-label { font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: .06em; padding: 6px 4px 4px; }
        .task-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 4px; border-bottom: 1px solid #0f1218; }
        .task-item:last-child { border-bottom: none; }
        .task-status-btn { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; flex-shrink: 0; margin-top: 1px; cursor: pointer; border: none; transition: all .15s; }
        .task-status--pending { background: #111420; border: 1px solid #1f2533; color: #4b5563; }
        .task-status--in_progress { background: #0d1220; border: 1px solid #2a3560; color: #6b82d4; }
        .task-status--completed { background: #061a0b; border: 1px solid #0e2e1a; color: #4ade80; }
        .task-body { flex: 1; min-width: 0; }
        .task-title-row { display: flex; align-items: center; gap: 6px; }
        .task-title { font-size: 13px; color: #c8d0e0; line-height: 1.4; }
        .task-title--done { color: #374151; text-decoration: line-through; }
        .task-badge { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 20px; letter-spacing: .04em; flex-shrink: 0; }
        .task-badge--ai { background: #1a2240; border: 1px solid #2a3560; color: #6b82d4; }
        .task-badge--manual { background: #0d1018; border: 1px solid #1a1e2a; color: #6b7280; }
        .task-desc { font-size: 11px; color: #6b7280; margin-top: 2px; line-height: 1.5; }
        .task-meta { font-size: 10px; color: #374151; margin-top: 3px; font-family: 'DM Mono', monospace; }
        .tasks-empty { padding: 24px 18px; font-size: 13px; color: #374151; text-align: center; }
        .task-add-form { padding: 12px 14px; border-top: 1px solid #131720; display: grid; gap: 8px; }
        .task-input { width: 100%; padding: 8px 12px; border-radius: 7px; border: 1px solid #1f2533; background: #0a0c12; color: #e2e8f0; font-size: 13px; font-family: inherit; outline: none; transition: border-color .15s; }
        .task-input:focus { border-color: #2a3560; }
        .task-input::placeholder { color: #374151; }
        .task-form-row { display: flex; gap: 8px; align-items: center; }
        .task-role-select { padding: 6px 10px; border-radius: 6px; border: 1px solid #1f2533; background: #111420; color: #9ca3af; font-size: 12px; font-family: inherit; cursor: pointer; }
        .task-submit-btn { padding: 6px 14px; border-radius: 7px; border: 1px solid #0e2e1a; background: #061a0b; color: #4ade80; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; }
        .task-submit-btn:hover { background: #0a2412; }

        /* ── CLINICAL NOTES EDITABLE ── */
        .cn-wrap { border-radius: 12px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease .09s both; }
        .cn-head { padding: 12px 16px; border-bottom: 1px solid #131720; display: flex; align-items: center; justify-content: space-between; }
        .cn-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
        .cn-saved { font-size: 10px; font-weight: 600; color: #4ade80; transition: opacity .3s; }
        .cn-body { padding: 14px 16px; }
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
      `}</style>

      <div className="shell">
        <Link href="/cases" className="back">← Cases</Link>

        {loading ? (
          <div style={{ opacity: 0.4, fontSize: 13 }}>Loading case…</div>
        ) : (
          <div className="layout">

            {/* ── SIDEBAR ── */}
            <aside className="sidebar">

              {/* Profile + score card */}
              <div className="profile-card">
                <div className="avatar-row">
                  <div className="avatar">{initials || "?"}</div>
                  <div className="status-pill">
                    {isLow ? "At risk" : isDropping ? "Declining" : isStale ? "Stale" : "Stable"}
                  </div>
                </div>

                <div className="p-name">{patientName}</div>
                <div className="p-sub">{d?.therapist?.name ?? "Unassigned"}</div>

                {/* Diagnosis badges */}
                {(ep.primary_diagnosis || (ep.secondary_diagnoses ?? []).length > 0) && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap" }}>
                    {ep.primary_diagnosis && <span className="diag-chip">{ep.primary_diagnosis}</span>}
                    {(ep.secondary_diagnoses ?? []).map(dx => <span key={dx} className="diag-chip">{dx}</span>)}
                  </div>
                )}

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

              {/* Contact info */}
              {(ep.email || ep.phone || ep.date_of_birth || ep.insurance_provider || ep.emergency_contact_name) && (
                <div className="info-card">
                  <div className="info-card-title">Contact</div>
                  {ep.email && <div className="info-row"><span className="info-key">Email</span><span className="info-val">{ep.email}</span></div>}
                  {ep.phone && <div className="info-row"><span className="info-key">Phone</span><span className="info-val">{ep.phone}</span></div>}
                  {ep.date_of_birth && <div className="info-row"><span className="info-key">DOB</span><span className="info-val">{fmtDate(ep.date_of_birth)}</span></div>}
                  {ep.insurance_provider && <div className="info-row"><span className="info-key">Insurance</span><span className="info-val">{ep.insurance_provider}</span></div>}
                  {ep.emergency_contact_name && (
                    <>
                      <div className="divider" />
                      <div className="info-row"><span className="info-key">Emergency</span><span className="info-val">{ep.emergency_contact_name}</span></div>
                      {ep.emergency_contact_phone && <div className="info-row"><span className="info-key">Emerg. ph.</span><span className="info-val">{ep.emergency_contact_phone}</span></div>}
                    </>
                  )}
                </div>
              )}

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
            </aside>

            {/* ── MAIN COLUMN ── */}
            <div className="main">

              {/* Action card */}
              <div className={`action-card ${isLow ? "action-card--alert" : isDropping ? "action-card--warn" : "action-card--stable"}`}>
                <div className="action-left">
                  <div className="action-icon">{isLow || isDropping ? "⚠️" : "✓"}</div>
                  <div>
                    <div className="action-title">
                      {isLow ? `Reach out to ${d?.patient?.first_name} today`
                       : isDropping ? `Score dropping — check in soon`
                       : `${d?.patient?.first_name ?? "Patient"} is stable`}
                    </div>
                    <div className="action-body">
                      {isLow
                        ? `Score of ${latest?.score} · ${latest?.created_at ? daysSince(latest.created_at) + "d ago" : ""} · "${noteText(latest) ?? "no note"}"`
                        : isDropping ? `Down ${Math.abs(delta!).toFixed(1)} pts vs baseline`
                        : `Avg ${avgScore?.toFixed(1) ?? "—"} · last check-in ${latest?.created_at ? fmtShort(latest.created_at) : "—"}`}
                    </div>
                  </div>
                </div>
                <button
                  className={`action-btn ${isLow || isDropping ? "action-btn--alert" : "action-btn--stable"} ${copied === "action" ? "action-btn--done" : ""}`}
                  onClick={() => copy(outreachText, "action")}
                >
                  {copied === "action" ? "✓ Copied" : "Copy outreach"}
                </button>
              </div>

              {/* Trend row */}
              <div className="trend-row">
                {[
                  { label: "Previous",   value: prev?.score?.toString() ?? "—",  sub: prev?.created_at ? fmtShort(prev.created_at) : "—", color: scoreHue(prev?.score ?? null).fg },
                  { label: "6-wk avg",   value: avgScore?.toFixed(1) ?? "—",      sub: `${checkins.length} check-ins`,                     color: scoreHue(avgScore ?? null).fg },
                  { label: "Days since", value: latest?.created_at ? `${daysSince(latest.created_at)}d` : "—", sub: "last check-in", color: isStale ? "#f97316" : "#9ca3af" },
                ].map((s) => (
                  <div key={s.label} className="trend-card">
                    <div className="trend-label">{s.label}</div>
                    <div className="trend-value" style={{ color: s.color }}>{s.value}</div>
                    <div className="trend-sub">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Clinical notes (editable) */}
              <div className="cn-wrap">
                <div className="cn-head">
                  <div className="cn-title">Clinical Notes</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {clinicalNotesSaved && <span className="cn-saved">✓ Saved</span>}
                    <button className="cn-btn" onClick={() => {
                      if (clinicalNotesEditing) {
                        saveClinicalNotes(clinicalNotes);
                      }
                      setClinicalNotesEditing(e => !e);
                    }}>
                      {clinicalNotesEditing ? "Done" : "Edit"}
                    </button>
                  </div>
                </div>
                <div className="cn-body">
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

                  {sessionNotes.length > 0 && (
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
                  )}
                </div>
              </div>

              {/* Treatment goals + Messages */}
              <div className="context-row">
                <div className="ctx-card">
                  <div className="ctx-head">
                    <div className="ctx-title">Treatment goals</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {goalsTotal > 0 && <div className="ctx-badge">{goalsDone}/{goalsTotal} complete</div>}
                      <button className="cn-btn" onClick={() => setShowAddGoal(v => !v)}>
                        {showAddGoal ? "Cancel" : "+ Add"}
                      </button>
                    </div>
                  </div>
                  <div className="ctx-body">
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
                </div>

                {/* Messages placeholder */}
                <div className="msg-wrap">
                  <div className="msg-head">
                    <div className="msg-title">Messages</div>
                  </div>
                  <div className="msg-body">
                    {isDemo ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div className="msg-bubble msg-bubble--patient">
                          <div className="msg-sender">Patient</div>
                          Had a rough week, feeling anxious about work
                        </div>
                        <div className="msg-bubble msg-bubble--therapist">
                          <div className="msg-sender">Therapist</div>
                          Thanks for checking in. We&apos;ll talk through this in our next session.
                        </div>
                        <div className="msg-bubble msg-bubble--patient">
                          <div className="msg-sender">Patient</div>
                          That helps, see you Thursday
                        </div>
                      </div>
                    ) : (
                      <div className="msg-placeholder">
                        <div className="msg-placeholder-icon">💬</div>
                        <div className="msg-placeholder-text">
                          Patient messaging is coming soon. You&apos;ll be able to send check-in prompts and follow-ups directly here.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Activities */}
              {(ep.activities ?? []).length > 0 && (
                <div className="ctx-card" style={{ animation: "fadeUp .3s ease .12s both" }}>
                  <div className="ctx-head">
                    <div className="ctx-title">Activities &amp; Homework</div>
                    <div className="ctx-badge">{ep.activities!.length} entries</div>
                  </div>
                  <div className="ctx-body">
                    <div style={{ display: "grid", gap: 10 }}>
                      {[...(ep.activities ?? [])].sort((a, b) => b.date.localeCompare(a.date)).map((act, i) => (
                        <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", whiteSpace: "nowrap", paddingTop: 2, minWidth: 72 }}>{fmtDate(act.date)}</div>
                          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.55 }}>{act.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks */}
              <div className="tasks-wrap">
                <div className="tasks-head">
                  <div className="tasks-head-left">
                    <div className="tasks-title">Tasks</div>
                    <div className="tasks-count">{tasks.filter(t => t.status !== "completed" && t.status !== "dismissed").length} open</div>
                  </div>
                  <div className="tasks-actions">
                    <button className="tasks-btn tasks-btn--ai" onClick={generateTasksAI} disabled={taskGenLoading}>
                      {taskGenLoading ? "Generating..." : "Generate Tasks"}
                    </button>
                    <button className="tasks-btn" onClick={() => setShowAddTask(v => !v)}>
                      {showAddTask ? "Cancel" : "+ Add Task"}
                    </button>
                  </div>
                </div>

                {showAddTask && (
                  <div className="task-add-form">
                    <input className="task-input" placeholder="Task title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                    <input className="task-input" placeholder="Description (optional)" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                    <div className="task-form-row">
                      <select className="task-role-select" value={newTaskRole} onChange={e => setNewTaskRole(e.target.value as "therapist" | "patient")}>
                        <option value="patient">Patient homework</option>
                        <option value="therapist">Therapist follow-up</option>
                      </select>
                      <button className="task-submit-btn" onClick={addManualTask}>Add</button>
                    </div>
                  </div>
                )}

                {tasks.length === 0 && !tasksLoading ? (
                  <div className="tasks-empty">No tasks yet — generate from session data or add manually</div>
                ) : (
                  <>
                    {therapistTasks.length > 0 && (
                      <div className="tasks-group">
                        <div className="tasks-group-label">Therapist follow-ups</div>
                        {therapistTasks.map(t => (
                          <div key={t.id} className="task-item">
                            <button
                              className={`task-status-btn task-status--${t.status}`}
                              onClick={() => cycleTaskStatus(t)}
                              title={`Status: ${t.status}`}
                            >{t.status === "completed" ? "✓" : t.status === "in_progress" ? "►" : ""}</button>
                            <div className="task-body">
                              <div className="task-title-row">
                                <span className={`task-title ${t.status === "completed" ? "task-title--done" : ""}`}>{t.title}</span>
                                <span className={`task-badge ${t.created_by === "ai" ? "task-badge--ai" : "task-badge--manual"}`}>
                                  {t.created_by === "ai" ? "AI" : "Manual"}
                                </span>
                              </div>
                              {t.description && <div className="task-desc">{t.description}</div>}
                              {t.due_date && <div className="task-meta">Due {fmtDate(t.due_date)}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {patientTasks.length > 0 && (
                      <div className="tasks-group">
                        <div className="tasks-group-label">Patient homework</div>
                        {patientTasks.map(t => (
                          <div key={t.id} className="task-item">
                            <button
                              className={`task-status-btn task-status--${t.status}`}
                              onClick={() => cycleTaskStatus(t)}
                              title={`Status: ${t.status}`}
                            >{t.status === "completed" ? "✓" : t.status === "in_progress" ? "►" : ""}</button>
                            <div className="task-body">
                              <div className="task-title-row">
                                <span className={`task-title ${t.status === "completed" ? "task-title--done" : ""}`}>{t.title}</span>
                                <span className={`task-badge ${t.created_by === "ai" ? "task-badge--ai" : "task-badge--manual"}`}>
                                  {t.created_by === "ai" ? "AI" : "Manual"}
                                </span>
                              </div>
                              {t.description && <div className="task-desc">{t.description}</div>}
                              {t.due_date && <div className="task-meta">Due {fmtDate(t.due_date)}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* AI Session Prep */}
              <div ref={aiSectionRef} className="ai-wrap" style={{ minHeight: 120 }}>
                <div className="ai-head">
                  <div className="ai-head-left">
                    <div className="ai-gem">✦</div>
                    <div className="ai-head-title">Session Prep</div>
                    <div className="ai-badge">AI</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!aiText && !aiLoading && d && (
                      <button className="ai-regen" style={{ background: "#1a2240", color: "#6b82d4", fontWeight: 700 }} onClick={() => generateAI(d, goals)}>
                        Generate
                      </button>
                    )}
                    {aiDone && d && (
                      <button className="ai-regen" onClick={() => generateAI(d, goals)} disabled={aiLoading}>
                        {aiLoading ? "Generating..." : "↻ Regenerate"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="ai-grid" style={{ minHeight: 120, transition: "all 0.3s ease" }}>
                  {/* Skeleton loading state */}
                  {aiLoading && !aiText && [
                    ["55%","85%","70%"], ["50%","90%","65%"],
                    ["60%","80%","72%"], ["52%","88%","60%"],
                  ].map((ws, i) => (
                    <div key={i} className="ai-card" style={{ minHeight: 80 }}>
                      <div className="skeleton" style={{ height: 10, width: ws[0], marginBottom: 12 }} />
                      <div className="skeleton" style={{ height: 12, width: ws[1], marginBottom: 7 }} />
                      <div className="skeleton" style={{ height: 12, width: ws[2] }} />
                    </div>
                  ))}

                  {/* Empty state — user hasn't generated yet */}
                  {!aiText && !aiLoading && !aiError && (
                    <div style={{ gridColumn: "1/-1", padding: "24px 16px", textAlign: "center", fontSize: 13, color: "#374151" }}>
                      Click Generate to create AI session prep notes
                    </div>
                  )}

                  {aiError && (
                    <div style={{ gridColumn: "1/-1", fontSize: 12, color: "#f87171", fontFamily: "DM Mono,monospace", background: "#1a0808", border: "1px solid #3d1a1a", borderRadius: 8, padding: "10px 12px" }}>
                      {aiError}
                      {d && (
                        <button className="ai-regen" style={{ marginTop: 8, display: "block" }} onClick={() => generateAI(d, goals)}>
                          Try again
                        </button>
                      )}
                    </div>
                  )}

                  {/* Streaming text before sections are parsed */}
                  {aiText && !aiSections && (
                    <div style={{ gridColumn: "1/-1", fontSize: 13, lineHeight: 1.8, color: "#c8d0e0", padding: "4px 2px", transition: "opacity 0.15s ease", opacity: 1 }}>
                      <MarkdownContent>{aiText}</MarkdownContent>
                      {aiLoading && <span className="ai-cursor" />}
                    </div>
                  )}

                  {/* Parsed sections */}
                  {aiSections && [
                    { key: "OPEN WITH",  icon: "💬", color: "#6b82d4", label: "Open with" },
                    { key: "WATCH FOR", icon: "👁",  color: "#fb923c", label: "Watch for" },
                    { key: "TRY THIS",  icon: "🎯", color: "#4ade80", label: "Try this" },
                    { key: "SEND THIS", icon: "✉️", color: "#a78bfa", label: "Send this" },
                  ].map(({ key, icon, color, label }) => (
                    <div key={key} className="ai-card" style={{ minHeight: 80, transition: "opacity 0.2s ease" }}>
                      <div className="ai-card-label" style={{ color }}>
                        <span>{icon}</span>{label}
                      </div>
                      <div className="ai-card-text">
                        {aiSections[key] ? <MarkdownContent>{aiSections[key]}</MarkdownContent> : "—"}
                        {aiLoading && key === "SEND THIS" && <span className="ai-cursor" />}
                      </div>
                      {key === "SEND THIS" && aiSections[key] && (
                        <button className={`copy-btn ${copied === "ai-send" ? "copy-btn--done" : ""}`} onClick={() => copy(aiSections[key], "ai-send")}>
                          {copied === "ai-send" ? "✓ Copied" : "Copy message"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {aiDone && !aiError && (
                  <div className="ai-foot">
                    <div className="ai-foot-dot" />
                    {patientName} · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </div>

            </div>

            {/* ── ACTIVITY FEED ── */}
            <div className="feed-col">
              <div className="feed-head">
                <span className="feed-title">Check-in history</span>
                <span className="feed-count">{checkins.length} entries</span>
              </div>
              <div className="feed-body">
                {checkins.length === 0 ? (
                  <div className="feed-empty">No check-ins recorded yet</div>
                ) : checkins.map((ci, idx) => {
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
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
