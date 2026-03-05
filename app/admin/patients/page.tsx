// app/admin/patients/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavSidebar } from "@/app/components/NavSidebar";

// ── Types ─────────────────────────────────────────────────────────────────────
type SessionNote = { date: string; text: string };
type Activity = { date: string; description: string };

type ExtendedProfile = {
  email?: string;
  phone?: string;
  date_of_birth?: string;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  clinical_notes?: string;
  session_notes?: SessionNote[];
  activities?: Activity[];
};

type PatientRow = {
  id: string;
  name: string | null;
  case_id: string | null;
  practice_id: string | null;
  practice_name: string | null;
  therapist_id: string | null;
  therapist_name: string | null;
  status: string;
  extended_profile?: ExtendedProfile;
};

type PracticeOption = { id: string; name: string | null };
type TherapistOption = { id: string; name: string | null; practice_id: string };

// ── Utilities ─────────────────────────────────────────────────────────────────
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(JSON.stringify(json?.error ?? json));
  return json;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Badge({ children, tone = "neutral" }: { children: any; tone?: "neutral" | "warn" | "bad" | "good" }) {
  const s = {
    bad:     { bg: "#1a0808", bd: "#3d1a1a", tx: "#f87171" },
    warn:    { bg: "#1a1000", bd: "#3d2800", tx: "#fb923c" },
    good:    { bg: "#061a0b", bd: "#0e2e1a", tx: "#4ade80" },
    neutral: { bg: "#0d1018", bd: "#1a1e2a", tx: "#9ca3af" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, border: `1px solid ${s.bd}`, background: s.bg, color: s.tx, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Btn({ children, onClick, tone = "ghost", disabled }: { children: any; onClick?: () => void; tone?: "ghost" | "primary" | "danger"; disabled?: boolean }) {
  const s = {
    ghost:   { bg: "transparent", bd: "#1f2533", tx: "#9ca3af" },
    primary: { bg: "#0d1220",     bd: "#2a3050", tx: "rgba(255,255,255,0.85)" },
    danger:  { bg: "#1a0808",     bd: "#3d1a1a", tx: "#f87171" },
  }[tone];
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${s.bd}`, background: s.bg, color: s.tx, fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

function SlidePanel({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
      <div className="ap-slide-panel" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 560, background: "#0d1018", borderLeft: "1px solid #1a1e2a", zIndex: 50, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #1a1e2a" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

function FormSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; name: string | null }[]; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", color: value ? "inherit" : "#4b5563", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
        <option value="">{placeholder ?? `— Select ${label} —`}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

function FormTextarea({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
    </div>
  );
}

function TagInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  function addTag() {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) { setInput(""); return; }
    onChange([...value, trimmed]);
    setInput("");
  }
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
    if (e.key === "Backspace" && !input && value.length) onChange(value.slice(0, -1));
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", minHeight: 44 }}>
        {value.map((tag) => (
          <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, border: "1px solid #1a1e2a", background: "#0d1018", color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>
            {tag}
            <button onClick={() => onChange(value.filter((t) => t !== tag))} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
          </span>
        ))}
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} onBlur={addTag} placeholder={value.length === 0 ? placeholder : ""}
          style={{ flex: 1, minWidth: 100, background: "transparent", border: "none", color: "inherit", fontSize: 13, outline: "none" }} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.35, marginTop: 5 }}>Press Enter or comma to add</div>
    </div>
  );
}

function FormSectionLabel({ children }: { children: string }) {
  return (
    <div style={{ marginTop: 24, marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #1a1e2a", fontWeight: 900, fontSize: 13, letterSpacing: 0.3 }}>
      {children}
    </div>
  );
}

function SaveRow({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, paddingTop: 16, borderTop: "1px solid #1a1e2a" }}>
      <button onClick={onSave} disabled={saving}
        style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid #2a3050", background: "#0d1220", color: "rgba(255,255,255,0.85)", fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button onClick={onCancel} disabled={saving}
        style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid #1f2533", background: "transparent", color: "#9ca3af", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
        Cancel
      </button>
    </div>
  );
}

// ── Session Notes Manager ──────────────────────────────────────────────────────
function SessionNotesEditor({ notes, onChange }: { notes: SessionNote[]; onChange: (n: SessionNote[]) => void }) {
  function addNote() {
    if (notes.length >= 10) return;
    onChange([...notes, { date: new Date().toISOString().slice(0, 10), text: "" }]);
  }
  function update(i: number, field: keyof SessionNote, val: string) {
    onChange(notes.map((n, idx) => idx === i ? { ...n, [field]: val } : n));
  }
  function remove(i: number) {
    onChange(notes.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase" }}>Session Notes</div>
        <Btn tone="ghost" onClick={addNote} disabled={notes.length >= 10}>+ Add Note</Btn>
      </div>
      {notes.length === 0 && <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 8 }}>No session notes. Click &quot;Add Note&quot; to mock session notes.</div>}
      {notes.map((note, i) => (
        <div key={i} style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 9, border: "1px solid #1a1e2a", background: "#080c12" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
            <input type="date" value={note.date} onChange={(e) => update(i, "date", e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #1f2533", background: "#0d1018", color: "inherit", fontSize: 12, outline: "none" }} />
            <button onClick={() => remove(i)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
          </div>
          <textarea value={note.text} onChange={(e) => update(i, "text", e.target.value)} placeholder="Session note content…" rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #1f2533", background: "#0d1018", color: "inherit", fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        </div>
      ))}
    </div>
  );
}

// ── Activities Manager ─────────────────────────────────────────────────────────
function ActivitiesEditor({ activities, onChange }: { activities: Activity[]; onChange: (a: Activity[]) => void }) {
  function addActivity() {
    if (activities.length >= 15) return;
    onChange([...activities, { date: new Date().toISOString().slice(0, 10), description: "" }]);
  }
  function update(i: number, field: keyof Activity, val: string) {
    onChange(activities.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  }
  function remove(i: number) {
    onChange(activities.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase" }}>Activities</div>
        <Btn tone="ghost" onClick={addActivity} disabled={activities.length >= 15}>+ Add Activity</Btn>
      </div>
      {activities.length === 0 && <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 8 }}>No activities. Click &quot;Add Activity&quot; to log homework, exercises, or milestones.</div>}
      {activities.map((act, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
          <input type="date" value={act.date} onChange={(e) => update(i, "date", e.target.value)}
            style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 7, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 12, outline: "none" }} />
          <input type="text" value={act.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="Activity description…"
            style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 12, outline: "none" }} />
          <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Empty form state ───────────────────────────────────────────────────────────
type PatientForm = {
  first_name: string; last_name: string;
  email: string; phone: string; date_of_birth: string;
  primary_diagnosis: string; secondary_diagnoses: string[];
  emergency_contact_name: string; emergency_contact_phone: string;
  insurance_provider: string; clinical_notes: string;
  session_notes: SessionNote[]; activities: Activity[];
  practice_id: string; therapist_id: string;
};

function emptyForm(): PatientForm {
  return {
    first_name: "", last_name: "", email: "", phone: "", date_of_birth: "",
    primary_diagnosis: "", secondary_diagnoses: [],
    emergency_contact_name: "", emergency_contact_phone: "",
    insurance_provider: "", clinical_notes: "",
    session_notes: [], activities: [],
    practice_id: "", therapist_id: "",
  };
}

function rowToForm(p: PatientRow): PatientForm {
  const [first = "", ...rest] = (p.name ?? "").split(" ");
  const ep = p.extended_profile ?? {};
  return {
    first_name: first, last_name: rest.join(" "),
    email: ep.email ?? "", phone: ep.phone ?? "",
    date_of_birth: ep.date_of_birth ?? "",
    primary_diagnosis: ep.primary_diagnosis ?? "",
    secondary_diagnoses: ep.secondary_diagnoses ?? [],
    emergency_contact_name: ep.emergency_contact_name ?? "",
    emergency_contact_phone: ep.emergency_contact_phone ?? "",
    insurance_provider: ep.insurance_provider ?? "",
    clinical_notes: ep.clinical_notes ?? "",
    session_notes: ep.session_notes ?? [],
    activities: ep.activities ?? [],
    practice_id: p.practice_id ?? "",
    therapist_id: p.therapist_id ?? "",
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PatientManagerPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUnassigned, setFilterUnassigned] = useState(false);

  const [panel, setPanel] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PatientForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [practices, setPractices] = useState<PracticeOption[]>([]);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  function reloadPatients() {
    setLoading(true);
    fetchJson("/api/patients")
      .then((res) => setPatients(res.data ?? []))
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reloadPatients();
    fetchJson("/api/practices").then((r) => setPractices(r.data ?? [])).catch(() => {});
    fetchJson("/api/therapists").then((r) => setTherapists(r.data ?? [])).catch(() => {});
  }, []);

  function setField<K extends keyof PatientForm>(key: K, val: PatientForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function openAdd() { setForm(emptyForm()); setPanel("add"); setEditingId(null); }

  async function openEdit(p: PatientRow) {
    try {
      const res = await fetchJson(`/api/patients/${p.id}`);
      const full: PatientRow = { ...p, extended_profile: res.data?.extended_profile ?? {} };
      setForm(rowToForm(full));
    } catch {
      setForm(rowToForm(p));
    }
    setEditingId(p.id);
    setPanel("edit");
  }

  function closePanel() { setPanel(null); setEditingId(null); }

  async function updateCase(p: PatientRow, field: "practice_id" | "therapist_id", value: string) {
    const cellKey = `${p.id}-${field}`;
    setSavingCell(cellKey);
    setError(null);
    try {
      let caseId = p.case_id;

      if (!caseId) {
        // No case yet — create one when a practice is selected
        if (field !== "practice_id" || !value) return;
        const res = await fetchJson("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_id: p.id, practice_id: value }),
        });
        caseId = res.data?.id ?? null;
        if (!caseId) throw new Error("Failed to create case");
        setPatients((prev) =>
          prev.map((pt) =>
            pt.id === p.id
              ? { ...pt, case_id: caseId, practice_id: value, practice_name: practices.find((pr) => pr.id === value)?.name ?? null, therapist_id: null, therapist_name: null }
              : pt
          )
        );
        return;
      }

      const patch: Record<string, string | null> = { [field]: value || null };
      if (field === "practice_id") patch.therapist_id = null;
      await fetchJson(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setPatients((prev) =>
        prev.map((pt) => {
          if (pt.id !== p.id) return pt;
          const updated = { ...pt, [field]: value || null };
          if (field === "practice_id") {
            updated.therapist_id = null;
            updated.therapist_name = null;
            updated.practice_name = practices.find((pr) => pr.id === value)?.name ?? null;
          } else {
            updated.therapist_name = therapists.find((t) => t.id === value)?.name ?? null;
          }
          return updated;
        })
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingCell(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const extFields = {
        email: form.email, phone: form.phone, date_of_birth: form.date_of_birth,
        primary_diagnosis: form.primary_diagnosis, secondary_diagnoses: form.secondary_diagnoses,
        emergency_contact_name: form.emergency_contact_name, emergency_contact_phone: form.emergency_contact_phone,
        insurance_provider: form.insurance_provider, clinical_notes: form.clinical_notes,
        session_notes: form.session_notes, activities: form.activities,
      };

      if (panel === "add") {
        const res = await fetchJson("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: form.first_name,
            last_name: form.last_name,
            ...(form.practice_id ? { practice_id: form.practice_id } : {}),
            ...(form.therapist_id ? { therapist_id: form.therapist_id } : {}),
          }),
        });
        const newId = res.data?.id;
        if (newId) {
          await fetchJson(`/api/patients/${newId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(extFields),
          });
        }
      } else if (panel === "edit" && editingId) {
        await fetchJson(`/api/patients/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ first_name: form.first_name, last_name: form.last_name, ...extFields }),
        });
      }
      closePanel();
      reloadPatients();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartISO = weekStart.toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
    <NavSidebar practiceId={null} practiceName={null} therapistId={null} weekStart={weekStartISO} adminOnly={true} />
    <main className="ap-main" style={{ flex: 1, background: "#080c12", color: "#e2e8f0", padding: "40px 48px", maxWidth: 1100 }}>
      <style>{`
        @media (max-width: 767px) {
          .ap-main { padding: 64px 16px 60px !important; }
          .ap-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ap-slide-panel { width: 100% !important; left: 0 !important; border-left: none !important; border-top: 1px solid #1a1e2a; }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <Link href="/admin" style={{ textDecoration: "none", color: "#6b7280", fontSize: 13 }}>← Admin</Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Patient Manager</h1>
        <div style={{ marginLeft: "auto" }}>
          <Btn tone="primary" onClick={openAdd}>+ Add Patient</Btn>
        </div>
      </div>
      <div style={{ opacity: 0.5, fontSize: 13, marginBottom: 28 }}>
        Manage patient profiles, diagnoses, clinical notes, session history, and activities.
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 9, border: "1px solid #3d1a1a", background: "#1a0808", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filter pills */}
      {!loading && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => setFilterUnassigned(false)}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${!filterUnassigned ? "#2a3050" : "#1f2533"}`, background: !filterUnassigned ? "#0d1220" : "#0d1018", color: !filterUnassigned ? "#e8eaf0" : "#4b5563", cursor: "pointer" }}
          >
            All patients <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: "rgba(255,255,255,.07)", marginLeft: 4 }}>{patients.length}</span>
          </button>
          <button
            onClick={() => setFilterUnassigned(true)}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid ${filterUnassigned ? "#3d2800" : "#1f2533"}`, background: filterUnassigned ? "#1a1000" : "#0d1018", color: filterUnassigned ? "#fb923c" : "#4b5563", cursor: "pointer" }}
          >
            Unassigned <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: "rgba(255,255,255,.07)", marginLeft: 4 }}>{patients.filter(p => !p.therapist_id).length}</span>
          </button>
        </div>
      )}

      {/* Table */}
      <div className="ap-table-wrap">
      <div style={{ border: "1px solid #1a1e2a", borderRadius: 12, overflow: "hidden", background: "#0d1018" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1.4fr 0.7fr 120px", padding: "8px 14px", borderBottom: "1px solid #1f2533", fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase" }}>
          <div>Patient</div>
          <div>Practice</div>
          <div>Therapist</div>
          <div>Primary Diagnosis</div>
          <div>Status</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {loading && <div style={{ padding: "20px 14px", opacity: 0.5, fontSize: 13 }}>Loading…</div>}
        {!loading && patients.length === 0 && <div style={{ padding: "20px 14px", opacity: 0.5, fontSize: 13 }}>No patients found.</div>}

        {!loading && filterUnassigned && patients.filter(p => !p.therapist_id).length === 0 && (
          <div style={{ padding: "20px 14px", opacity: 0.5, fontSize: 13 }}>No unassigned patients.</div>
        )}

        {patients.filter(p => !filterUnassigned || !p.therapist_id).map((p) => {
          const ep = p.extended_profile ?? {};
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr 1.4fr 0.7fr 120px", padding: "14px", borderBottom: "1px solid #1a1e2a", alignItems: "center", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{p.name ?? "—"}</div>
                {ep.email && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{ep.email}</div>}
                {ep.date_of_birth && <div style={{ fontSize: 11, opacity: 0.5 }}>DOB: {ep.date_of_birth}</div>}
                <div style={{ marginTop: 3, fontSize: 10, fontFamily: "monospace", opacity: 0.25 }}>{p.id}</div>
              </div>
              <div>
                <select
                  value={p.practice_id ?? ""}
                  onChange={(e) => updateCase(p, "practice_id", e.target.value)}
                  disabled={savingCell === `${p.id}-practice_id`}
                  style={{ width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #1f2533", background: "#080c12", color: p.practice_id ? "#e2e8f0" : "#4b5563", fontSize: 12, outline: "none", cursor: "pointer", opacity: savingCell === `${p.id}-practice_id` ? 0.5 : 1 }}
                >
                  <option value="">— No Practice —</option>
                  {practices.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={p.therapist_id ?? ""}
                  onChange={(e) => updateCase(p, "therapist_id", e.target.value)}
                  disabled={!p.case_id || savingCell === `${p.id}-therapist_id`}
                  style={{ width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #1f2533", background: "#080c12", color: p.therapist_id ? "#e2e8f0" : "#4b5563", fontSize: 12, outline: "none", cursor: p.case_id ? "pointer" : "not-allowed", opacity: (!p.case_id || savingCell === `${p.id}-therapist_id`) ? 0.4 : 1 }}
                >
                  <option value="">— Unassigned —</option>
                  {therapists
                    .filter((t) => !p.practice_id || t.practice_id === p.practice_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
              </div>
              <div style={{ fontSize: 12 }}>
                {ep.primary_diagnosis
                  ? <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{ep.primary_diagnosis}</span>
                  : <span style={{ opacity: 0.35 }}>—</span>}
              </div>
              <div><Badge tone="good">{p.status}</Badge></div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <Btn onClick={() => openEdit(p)}>Edit</Btn>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Add / Edit panel */}
      <SlidePanel open={panel !== null} onClose={closePanel} title={panel === "add" ? "Add Patient" : "Edit Patient"}>
        {panel === "add" && (
          <>
            <FormSectionLabel>Assignment</FormSectionLabel>
            <FormSelect
              label="Practice"
              value={form.practice_id}
              onChange={(v) => { setField("practice_id", v); setField("therapist_id", ""); }}
              options={practices as { id: string; name: string | null }[]}
              placeholder="— No Practice —"
            />
            <FormSelect
              label="Therapist"
              value={form.therapist_id}
              onChange={(v) => setField("therapist_id", v)}
              options={therapists.filter((t) => !form.practice_id || t.practice_id === form.practice_id) as { id: string; name: string | null }[]}
              placeholder="— Unassigned —"
            />
          </>
        )}
        <FormSectionLabel>Identity</FormSectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="First Name" value={form.first_name} onChange={(v) => setField("first_name", v)} placeholder="First" />
          <FormField label="Last Name" value={form.last_name} onChange={(v) => setField("last_name", v)} placeholder="Last" />
        </div>
        <FormField label="Date of Birth" value={form.date_of_birth} onChange={(v) => setField("date_of_birth", v)} type="date" />

        <FormSectionLabel>Contact</FormSectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Email" value={form.email} onChange={(v) => setField("email", v)} placeholder="patient@example.com" type="email" />
          <FormField label="Phone" value={form.phone} onChange={(v) => setField("phone", v)} placeholder="(555) 000-0000" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Emergency Contact" value={form.emergency_contact_name} onChange={(v) => setField("emergency_contact_name", v)} placeholder="Name" />
          <FormField label="Emergency Phone" value={form.emergency_contact_phone} onChange={(v) => setField("emergency_contact_phone", v)} placeholder="(555) 000-0000" />
        </div>

        <FormSectionLabel>Insurance</FormSectionLabel>
        <FormField label="Insurance Provider" value={form.insurance_provider} onChange={(v) => setField("insurance_provider", v)} placeholder="e.g. Blue Cross Blue Shield" />

        <FormSectionLabel>Clinical</FormSectionLabel>
        <FormField label="Primary Diagnosis" value={form.primary_diagnosis} onChange={(v) => setField("primary_diagnosis", v)} placeholder="e.g. F32.1 Major Depressive Disorder" />
        <TagInput label="Secondary Diagnoses" value={form.secondary_diagnoses} onChange={(v) => setField("secondary_diagnoses", v)} placeholder="e.g. F41.1 GAD…" />
        <FormTextarea label="Clinical Notes" value={form.clinical_notes} onChange={(v) => setField("clinical_notes", v)} placeholder="Free-form clinical notes — used by AI for context and session summaries…" rows={5} />

        <FormSectionLabel>Session Notes</FormSectionLabel>
        <SessionNotesEditor notes={form.session_notes} onChange={(v) => setField("session_notes", v)} />

        <FormSectionLabel>Activities &amp; Homework</FormSectionLabel>
        <ActivitiesEditor activities={form.activities} onChange={(v) => setField("activities", v)} />

        {error && (
          <div style={{ marginTop: 8, marginBottom: 4, padding: "10px 14px", borderRadius: 8, border: "1px solid #3d1a1a", background: "#1a0808", color: "#f87171", fontSize: 13 }}>
            {error}
          </div>
        )}
        <SaveRow onSave={save} onCancel={closePanel} saving={saving} />
      </SlidePanel>
    </main>
    </div>
  );
}
