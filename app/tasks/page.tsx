/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso; }
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

const STATUS_ORDER: Record<string, number> = { pending: 0, in_progress: 1, completed: 2, dismissed: 3 };

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterCase, setFilterCase] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"due_date" | "created_at">("due_date");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tasks", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        setTasks(json?.data ?? []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const caseIds = useMemo(() => [...new Set(tasks.map(t => t.case_id))], [tasks]);

  const filtered = useMemo(() => {
    let list = [...tasks];

    if (filterStatus === "open") list = list.filter(t => t.status === "pending" || t.status === "in_progress");
    else if (filterStatus !== "all") list = list.filter(t => t.status === filterStatus);

    if (filterRole !== "all") list = list.filter(t => t.assigned_to_role === filterRole);
    if (filterCase !== "all") list = list.filter(t => t.case_id === filterCase);

    list.sort((a, b) => {
      if (sortBy === "due_date") {
        const aD = a.due_date ?? "9999";
        const bD = b.due_date ?? "9999";
        if (aD !== bD) return aD.localeCompare(bD);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [tasks, filterStatus, filterRole, filterCase, sortBy]);

  async function updateStatus(taskId: string, status: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, userId: "current-user" }),
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as TaskRow["status"] } : t));
      }
    } catch { /* ignore */ }
  }

  async function bulkUpdate(status: string) {
    for (const id of selectedIds) {
      await updateStatus(id, status);
    }
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ background: "#080c12", color: "#e2e8f0", minHeight: "100vh", fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .tp-wrap { max-width: 960px; margin: 0 auto; padding: 32px 24px 80px; }
        .tp-back { font-size: 12px; font-weight: 500; color: #4b5563; text-decoration: none; letter-spacing: .05em; text-transform: uppercase; display: inline-block; margin-bottom: 20px; transition: color .15s; }
        .tp-back:hover { color: #9ca3af; }
        .tp-title { font-size: 22px; font-weight: 700; color: #f1f3f8; letter-spacing: -.02em; margin-bottom: 20px; }

        .tp-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; align-items: center; }
        .tp-select { padding: 6px 12px; border-radius: 7px; border: 1px solid #1f2533; background: #111420; color: #9ca3af; font-size: 12px; font-family: inherit; cursor: pointer; }
        .tp-select:focus { border-color: #2a3560; outline: none; }
        .tp-bulk-btn { padding: 6px 14px; border-radius: 7px; border: 1px solid #1f2533; background: #111420; color: #9ca3af; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
        .tp-bulk-btn:hover { border-color: #2e3650; color: #e8eaf0; }
        .tp-bulk-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .tp-card { border-radius: 14px; border: 1px solid #1a1e2a; background: #0d1018; overflow: hidden; }
        .tp-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 18px; border-bottom: 1px solid #0f1218; transition: background .15s; }
        .tp-row:last-child { border-bottom: none; }
        .tp-row:hover { background: #0a0e18; }
        .tp-check { width: 18px; height: 18px; border-radius: 4px; border: 1px solid #1f2533; background: #111420; cursor: pointer; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #4ade80; transition: all .15s; }
        .tp-check--on { background: #061a0b; border-color: #0e2e1a; }
        .tp-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .tp-status-dot--pending { background: #4b5563; }
        .tp-status-dot--in_progress { background: #4f6ef7; box-shadow: 0 0 6px #4f6ef7aa; }
        .tp-status-dot--completed { background: #4ade80; }
        .tp-status-dot--dismissed { background: #374151; }
        .tp-task-info { flex: 1; min-width: 0; }
        .tp-task-title { font-size: 14px; color: #c8d0e0; line-height: 1.4; display: flex; align-items: center; gap: 6px; }
        .tp-task-title--done { color: #374151; text-decoration: line-through; }
        .tp-ai-badge { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: #1a2240; border: 1px solid #2a3560; color: #6b82d4; flex-shrink: 0; }
        .tp-manual-badge { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: #0d1018; border: 1px solid #1a1e2a; color: #6b7280; flex-shrink: 0; }
        .tp-task-desc { font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.5; }
        .tp-task-meta { font-size: 10px; color: #374151; margin-top: 4px; font-family: 'DM Mono', monospace; display: flex; gap: 12px; flex-wrap: wrap; }
        .tp-status-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid #1f2533; background: #111420; color: #9ca3af; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; flex-shrink: 0; transition: all .15s; }
        .tp-status-btn:hover { border-color: #2a3560; color: #e8eaf0; }
        .tp-empty { padding: 40px 18px; font-size: 14px; color: #374151; text-align: center; }
        .tp-loading { padding: 40px 18px; font-size: 13px; color: #4b5563; text-align: center; }

        .tp-case-link { font-size: 10px; color: #4f6ef7; text-decoration: none; }
        .tp-case-link:hover { text-decoration: underline; }
      `}</style>

      <div className="tp-wrap">
        <Link href="/" className="tp-back">&larr; Home</Link>
        <div className="tp-title">Tasks</div>

        <div className="tp-filters">
          <select className="tp-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
          <select className="tp-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="all">All roles</option>
            <option value="therapist">Therapist</option>
            <option value="patient">Patient</option>
          </select>
          {caseIds.length > 1 && (
            <select className="tp-select" value={filterCase} onChange={e => setFilterCase(e.target.value)}>
              <option value="all">All cases</option>
              {caseIds.map(id => <option key={id} value={id}>{id.slice(0, 8)}...</option>)}
            </select>
          )}
          <select className="tp-select" value={sortBy} onChange={e => setSortBy(e.target.value as "due_date" | "created_at")}>
            <option value="due_date">Sort: Due date</option>
            <option value="created_at">Sort: Created</option>
          </select>

          {selectedIds.size > 0 && (
            <>
              <button className="tp-bulk-btn" onClick={() => bulkUpdate("completed")}>Mark {selectedIds.size} completed</button>
              <button className="tp-bulk-btn" onClick={() => bulkUpdate("dismissed")}>Dismiss {selectedIds.size}</button>
            </>
          )}
        </div>

        <div className="tp-card">
          {loading ? (
            <div className="tp-loading">Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="tp-empty">
              {tasks.length === 0
                ? "No tasks yet — add tasks from a case detail page"
                : "No tasks match the current filters"}
            </div>
          ) : (
            filtered.map(t => {
              const isDone = t.status === "completed" || t.status === "dismissed";
              const nextStatus = t.status === "pending" ? "in_progress" : t.status === "in_progress" ? "completed" : "pending";
              return (
                <div key={t.id} className="tp-row">
                  <div
                    className={`tp-check ${selectedIds.has(t.id) ? "tp-check--on" : ""}`}
                    onClick={() => toggleSelect(t.id)}
                  >{selectedIds.has(t.id) ? "✓" : ""}</div>
                  <div className={`tp-status-dot tp-status-dot--${t.status}`} />
                  <div className="tp-task-info">
                    <div className={`tp-task-title ${isDone ? "tp-task-title--done" : ""}`}>
                      {t.title}
                      {t.created_by === "ai" ? <span className="tp-ai-badge">AI</span> : <span className="tp-manual-badge">Manual</span>}
                    </div>
                    {t.description && <div className="tp-task-desc">{t.description}</div>}
                    <div className="tp-task-meta">
                      <span>{t.assigned_to_role === "therapist" ? "Therapist" : "Patient"}</span>
                      <span>Due {fmtDate(t.due_date)}</span>
                      <span>Created {fmtDateTime(t.created_at)}</span>
                      <Link href={`/cases/${t.case_id}`} className="tp-case-link">Case {t.case_id.slice(0, 8)}&hellip;</Link>
                    </div>
                  </div>
                  <button className="tp-status-btn" onClick={() => updateStatus(t.id, nextStatus)}>
                    {t.status === "pending" ? "Start" : t.status === "in_progress" ? "Done" : "Reopen"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
