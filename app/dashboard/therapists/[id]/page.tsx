/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

type CaseInfo = { id: string; title: string | null };

function fmtDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso; }
}

export default function TherapistDashboardPage() {
  const params = useParams();
  const therapistId = params?.id as string;

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [therapistName, setTherapistName] = useState<string | null>(null);

  useEffect(() => {
    if (!therapistId) return;
    (async () => {
      try {
        // Fetch therapist's cases
        const careRes = await fetch(`/api/therapists/${encodeURIComponent(therapistId)}/care`, { cache: "no-store" });
        const careJson = await careRes.json().catch(() => ({}));
        const careData = careJson?.data;
        setTherapistName(careData?.therapist_name ?? null);

        const caseList: CaseInfo[] = (careData?.cases ?? []).map((c: any) => ({
          id: c.case_id,
          title: `${c.patient_first_name ?? ""} ${c.patient_last_name ?? ""}`.trim() || c.case_title || c.case_id.slice(0, 8),
        }));
        setCases(caseList);

        // Fetch tasks for all cases
        const allTasks: TaskRow[] = [];
        for (const c of caseList) {
          const res = await fetch(`/api/cases/${encodeURIComponent(c.id)}/tasks`, { cache: "no-store" });
          const json = await res.json().catch(() => ({}));
          allTasks.push(...(json?.data ?? []));
        }
        setTasks(allTasks);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [therapistId]);

  const openTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const tasksByCase = new Map<string, TaskRow[]>();
  for (const t of openTasks) {
    const list = tasksByCase.get(t.case_id) ?? [];
    list.push(t);
    tasksByCase.set(t.case_id, list);
  }

  const caseNameById = new Map(cases.map(c => [c.id, c.title]));

  async function cycleStatus(task: TaskRow) {
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, userId: therapistId }),
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next as TaskRow["status"] } : t));
      }
    } catch { /* ignore */ }
  }

  return (
    <div style={{ background: "#080c12", color: "#e2e8f0", minHeight: "100vh", fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .td-wrap { max-width: 800px; margin: 0 auto; padding: 32px 24px 80px; }
        .td-back { font-size: 12px; font-weight: 500; color: #4b5563; text-decoration: none; letter-spacing: .05em; text-transform: uppercase; display: inline-block; margin-bottom: 20px; transition: color .15s; }
        .td-back:hover { color: #9ca3af; }
        .td-header { margin-bottom: 24px; }
        .td-name { font-size: 22px; font-weight: 700; color: #f1f3f8; letter-spacing: -.02em; }
        .td-sub { font-size: 13px; color: #4b5563; margin-top: 4px; }
        .td-links { display: flex; gap: 10px; margin-top: 14px; }
        .td-link { font-size: 12px; font-weight: 600; color: #4f6ef7; text-decoration: none; padding: 6px 14px; border-radius: 7px; border: 1px solid #1a2240; background: #0d1220; transition: all .15s; }
        .td-link:hover { background: #141b34; }

        .tw-card { border-radius: 14px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; animation: fadeUp .3s ease both; }
        .tw-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #131720; }
        .tw-head-left { display: flex; align-items: center; gap: 10px; }
        .tw-title { font-size: 13px; font-weight: 600; color: #9ca3af; letter-spacing: .04em; text-transform: uppercase; }
        .tw-badge { font-size: 11px; font-weight: 700; min-width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #4f6ef7; color: white; }
        .tw-case-group { padding: 4px 14px 8px; }
        .tw-case-label { font-size: 11px; font-weight: 700; color: #4b5563; padding: 10px 4px 4px; display: flex; align-items: center; justify-content: space-between; }
        .tw-case-link { font-size: 10px; color: #4f6ef7; text-decoration: none; font-weight: 600; }
        .tw-case-link:hover { text-decoration: underline; }
        .tw-task { display: flex; align-items: flex-start; gap: 10px; padding: 9px 4px; border-bottom: 1px solid #0f1218; }
        .tw-task:last-child { border-bottom: none; }
        .tw-status { width: 20px; height: 20px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; flex-shrink: 0; cursor: pointer; border: none; transition: all .15s; }
        .tw-status--pending { background: #111420; border: 1px solid #1f2533; color: #4b5563; }
        .tw-status--in_progress { background: #0d1220; border: 1px solid #2a3560; color: #6b82d4; }
        .tw-status--completed { background: #061a0b; border: 1px solid #0e2e1a; color: #4ade80; }
        .tw-task-info { flex: 1; min-width: 0; }
        .tw-task-title { font-size: 13px; color: #c8d0e0; line-height: 1.4; display: flex; align-items: center; gap: 6px; }
        .tw-task-title--done { color: #374151; text-decoration: line-through; }
        .tw-ai-badge { font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 20px; background: #1a2240; border: 1px solid #2a3560; color: #6b82d4; flex-shrink: 0; }
        .tw-task-meta { font-size: 10px; color: #374151; margin-top: 2px; font-family: 'DM Mono', monospace; }
        .tw-empty { padding: 24px 18px; font-size: 13px; color: #374151; text-align: center; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div className="td-wrap">
        <Link href="/" className="td-back">&larr; Home</Link>

        <div className="td-header">
          <div className="td-name">{loading ? "Loading..." : (therapistName ?? "Therapist")}</div>
          <div className="td-sub">Dashboard</div>
          <div className="td-links">
            <Link href={`/dashboard/therapists/${therapistId}/care`} className="td-link">Care Dashboard</Link>
            <Link href="/tasks" className="td-link">All Tasks</Link>
          </div>
        </div>

        <div className="tw-card">
          <div className="tw-head">
            <div className="tw-head-left">
              <div className="tw-title">My Tasks</div>
              {openTasks.length > 0 && <div className="tw-badge">{openTasks.length}</div>}
            </div>
          </div>

          {loading ? (
            <div className="tw-empty" style={{ opacity: 0.4 }}>Loading tasks...</div>
          ) : openTasks.length === 0 ? (
            <div className="tw-empty">No open tasks across your caseload</div>
          ) : (
            Array.from(tasksByCase.entries()).map(([caseId, caseTasks]) => (
              <div key={caseId} className="tw-case-group">
                <div className="tw-case-label">
                  <span>{caseNameById.get(caseId) ?? caseId.slice(0, 8)}</span>
                  <Link href={`/cases/${caseId}`} className="tw-case-link">Open case &rarr;</Link>
                </div>
                {caseTasks.map(t => (
                  <div key={t.id} className="tw-task">
                    <button
                      className={`tw-status tw-status--${t.status}`}
                      onClick={() => cycleStatus(t)}
                    >{t.status === "completed" ? "✓" : t.status === "in_progress" ? "►" : ""}</button>
                    <div className="tw-task-info">
                      <div className={`tw-task-title ${t.status === "completed" ? "tw-task-title--done" : ""}`}>
                        {t.title}
                        {t.created_by === "ai" && <span className="tw-ai-badge">AI</span>}
                      </div>
                      {t.due_date && <div className="tw-task-meta">Due {fmtDate(t.due_date)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
