// app/admin/components/PracticeManagerAssignments.tsx
// Inline assignment manager for a specific practice. Admin only.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Assignment = {
  id: string;
  manager_id: string;
  practice_id: string;
  assigned_at: string;
  manager: { email: string; first_name: string | null };
};

type ManagerUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export function PracticeManagerAssignments({ practiceId }: { practiceId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [allManagers, setAllManagers] = useState<ManagerUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fetch assignments for this practice
  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/manager-practice-assignments?practice_id=${practiceId}`, { cache: "no-store" });
      const json = await res.json();
      setAssignments(Array.isArray(json?.data) ? json.data : []);
    } catch {} finally {
      setLoading(false);
    }
  }, [practiceId]);

  // Fetch all manager users for the combobox
  const fetchManagers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users?role=manager", { cache: "no-store" });
      const json = await res.json();
      setAllManagers(Array.isArray(json?.data) ? json.data : []);
    } catch {}
  }, []);

  useEffect(() => { fetchAssignments(); fetchManagers(); }, [fetchAssignments, fetchManagers]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Filter managers: exclude already-assigned, match search term
  const assignedIds = new Set(assignments.map(a => a.manager_id));
  const filteredManagers = allManagers.filter(m => {
    if (assignedIds.has(m.id)) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      m.email.toLowerCase().includes(q) ||
      (m.first_name ?? "").toLowerCase().includes(q)
    );
  });

  async function handleAdd(managerId: string) {
    setAdding(true);
    setDropdownOpen(false);
    setSearchTerm("");

    // Optimistic: find manager data and add to list
    const mgr = allManagers.find(m => m.id === managerId);
    const optimistic: Assignment = {
      id: `temp-${Date.now()}`,
      manager_id: managerId,
      practice_id: practiceId,
      assigned_at: new Date().toISOString(),
      manager: { email: mgr?.email ?? "", first_name: mgr?.first_name ?? null },
    };
    setAssignments(prev => [optimistic, ...prev]);

    try {
      const res = await fetch("/api/admin/manager-practice-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_id: managerId, practice_id: practiceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed");
      // Replace optimistic with real
      setAssignments(prev => prev.map(a =>
        a.id === optimistic.id
          ? { ...json.data, manager: optimistic.manager }
          : a
      ));
    } catch {
      // Rollback optimistic
      setAssignments(prev => prev.filter(a => a.id !== optimistic.id));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(assignmentId: string) {
    setRemovingId(assignmentId);
    const removed = assignments.find(a => a.id === assignmentId);
    // Optimistic remove
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));

    try {
      const res = await fetch(`/api/admin/manager-practice-assignments/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Rollback
      if (removed) setAssignments(prev => [...prev, removed]);
    } finally {
      setRemovingId(null);
    }
  }

  function initials(assignment: Assignment): string {
    const name = assignment.manager.first_name || assignment.manager.email;
    const parts = name.split(/[\s@]+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <div style={{ marginTop: 32 }}>
      {/* Section header */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "1.2px",
        textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
        fontFamily: "'DM Mono', monospace", marginBottom: 12,
      }}>
        Assigned Managers
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
          Loading...
        </div>
      ) : (
        <>
          {/* Assignment list */}
          {assignments.length === 0 && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontStyle: "italic", marginBottom: 12 }}>
              No managers assigned to this practice yet
            </div>
          )}

          {assignments.map(a => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid #1a1e2a",
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#111420", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                flexShrink: 0,
              }}>
                {initials(a)}
              </div>

              {/* Name + email */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: "#e2e8f0",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {a.manager.first_name || a.manager.email.split("@")[0]}
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.45)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {a.manager.email}
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(a.id)}
                disabled={removingId === a.id}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  padding: "4px 8px", borderRadius: 6,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = "#c4b5a0"; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; }}
              >
                Remove
              </button>
            </div>
          ))}

          {/* Add manager combobox */}
          <div ref={wrapRef} style={{ position: "relative", marginTop: 12 }}>
            <input
              type="text"
              placeholder="Add manager by email..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              disabled={adding}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                background: "#111420",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#e2e8f0",
                outline: "none",
              }}
            />

            {dropdownOpen && filteredManagers.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                zIndex: 100, maxHeight: 200, overflowY: "auto",
                background: "#0d1018",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 10,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                padding: "4px 0",
              }}>
                {filteredManagers.map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleAdd(m.id)}
                    style={{
                      padding: "8px 12px", cursor: "pointer",
                      fontSize: 13, color: "#9ca3af",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      transition: "background 0.1s, color 0.1s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLDivElement).style.color = "#e2e8f0"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; (e.currentTarget as HTMLDivElement).style.color = "#9ca3af"; }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {m.first_name ? `${m.first_name}${m.last_name ? ` ${m.last_name}` : ""}` : m.email.split("@")[0]}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{m.email}</div>
                  </div>
                ))}
              </div>
            )}

            {dropdownOpen && searchTerm && filteredManagers.length === 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                zIndex: 100, padding: "12px",
                background: "#0d1018",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 10,
                fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}>
                No matching managers found
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
