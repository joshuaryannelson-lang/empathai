// app/admin/therapists/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavSidebar } from "@/app/components/NavSidebar";

// ── Types ─────────────────────────────────────────────────────────────────────
type Practice = { id: string; name: string | null };

type ExtendedProfile = {
  email?: string;
  phone?: string;
  license_type?: string;
  license_state?: string;
  license_number?: string;
  license_expiry?: string;
  certifications?: string[];
  therapy_modalities?: string[];
  specializations?: string[];
  training_notes?: string;
  bio?: string;
};

type Therapist = {
  id: string;
  name: string | null;
  practice_id: string;
  extended_profile?: ExtendedProfile;
};

type TherapistRow = Therapist & { practiceName: string | null };

// ── Constants ─────────────────────────────────────────────────────────────────
const LICENSE_TYPES = ["LCSW", "LMFT", "PhD", "PsyD", "LPC", "LPCC", "MFT", "Other"];
const MODALITY_OPTIONS = ["CBT", "DBT", "ACT", "EMDR", "CPT", "IFS", "Somatic", "Psychodynamic", "Motivational Interviewing", "Gottman Method", "EFT", "Narrative"];
const SPEC_OPTIONS = ["Trauma", "Depression", "Anxiety", "Couples", "Adolescents", "Addiction", "Grief", "PTSD", "OCD", "Eating Disorders", "LGBTQ+", "Family Systems"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

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
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: "#0d1018", borderLeft: "1px solid #1a1e2a", zIndex: 50, display: "flex", flexDirection: "column" }}>
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

function FormTextarea({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; name: string | null }[] }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
        <option value="">— Select —</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.id}</option>)}
      </select>
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

function ToggleChips({ label, value, onChange, options }: { label: string; value: string[]; onChange: (v: string[]) => void; options: string[] }) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]);
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 9 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)}
              style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid ${active ? "#2a3050" : "#1a1e2a"}`, background: active ? "#0d1220" : "transparent", color: active ? "rgba(255,255,255,0.9)" : "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {opt}
            </button>
          );
        })}
      </div>
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

// ── Empty form state ───────────────────────────────────────────────────────────
function emptyForm(): ExtendedProfile & { name: string; practice_id: string } {
  return {
    name: "",
    practice_id: "",
    email: "",
    phone: "",
    license_type: "",
    license_state: "",
    license_number: "",
    license_expiry: "",
    certifications: [],
    therapy_modalities: [],
    specializations: [],
    training_notes: "",
    bio: "",
  };
}

function rowToForm(t: TherapistRow) {
  const ep = t.extended_profile ?? {};
  return {
    name: t.name ?? "",
    practice_id: t.practice_id,
    email: ep.email ?? "",
    phone: ep.phone ?? "",
    license_type: ep.license_type ?? "",
    license_state: ep.license_state ?? "",
    license_number: ep.license_number ?? "",
    license_expiry: ep.license_expiry ?? "",
    certifications: ep.certifications ?? [],
    therapy_modalities: ep.therapy_modalities ?? [],
    specializations: ep.specializations ?? [],
    training_notes: ep.training_notes ?? "",
    bio: ep.bio ?? "",
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TherapistManagerPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [therapists, setTherapists] = useState<TherapistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPractice, setFilterPractice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load practices
  useEffect(() => {
    fetchJson("/api/practices")
      .then((res) => setPractices(res.data ?? []))
      .catch(() => {});
  }, []);

  // Load all therapists across practices
  function reloadTherapists(practiceList: Practice[]) {
    if (practiceList.length === 0) return;
    setLoading(true);
    Promise.all(
      practiceList.map((p) =>
        fetchJson(`/api/therapists?practice_id=${p.id}`)
          .then((res) =>
            ((res.data ?? []) as Therapist[]).map((t) => ({ ...t, practiceName: p.name ?? null }))
          )
          .catch(() => [] as TherapistRow[])
      )
    )
      .then((groups) => setTherapists(groups.flat()))
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reloadTherapists(practices);
  }, [practices]);

  function setField<K extends keyof ReturnType<typeof emptyForm>>(key: K, val: ReturnType<typeof emptyForm>[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function openAdd() {
    setForm({ ...emptyForm(), practice_id: practices[0]?.id ?? "" });
    setPanel("add");
    setEditingId(null);
  }

  async function openEdit(t: TherapistRow) {
    // Fetch full profile (with extended_profile)
    try {
      const res = await fetchJson(`/api/therapists/${t.id}`);
      const full: TherapistRow = { ...t, extended_profile: res.data?.extended_profile ?? {} };
      setForm(rowToForm(full));
    } catch {
      setForm(rowToForm(t));
    }
    setEditingId(t.id);
    setPanel("edit");
  }

  function closePanel() { setPanel(null); setEditingId(null); }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (panel === "add") {
        const res = await fetchJson("/api/therapists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, practice_id: form.practice_id }),
        });
        const newId = res.data?.id;
        if (newId) {
          await fetchJson(`/api/therapists/${newId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email, phone: form.phone,
              license_type: form.license_type, license_state: form.license_state,
              license_number: form.license_number, license_expiry: form.license_expiry,
              certifications: form.certifications, therapy_modalities: form.therapy_modalities,
              specializations: form.specializations, training_notes: form.training_notes, bio: form.bio,
            }),
          });
        }
      } else if (panel === "edit" && editingId) {
        await fetchJson(`/api/therapists/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name, practice_id: form.practice_id,
            email: form.email, phone: form.phone,
            license_type: form.license_type, license_state: form.license_state,
            license_number: form.license_number, license_expiry: form.license_expiry,
            certifications: form.certifications, therapy_modalities: form.therapy_modalities,
            specializations: form.specializations, training_notes: form.training_notes, bio: form.bio,
          }),
        });
      }
      closePanel();
      reloadTherapists(practices);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTherapist(id: string) {
    setDeleting(true);
    setError(null);
    try {
      await fetchJson("/api/therapists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setTherapists((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirm(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDeleting(false);
    }
  }

  const displayed = filterPractice
    ? therapists.filter((t) => t.practice_id === filterPractice)
    : therapists;

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartISO = weekStart.toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
    <NavSidebar practiceId={null} practiceName={null} therapistId={null} weekStart={weekStartISO} adminOnly={true} />
    <main style={{ flex: 1, background: "#080c12", color: "#e2e8f0", padding: "40px 48px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <Link href="/admin" style={{ textDecoration: "none", color: "#6b7280", fontSize: 13 }}>← Admin</Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Therapist Manager</h1>
        <div style={{ marginLeft: "auto" }}>
          <Btn tone="primary" onClick={openAdd}>+ Add Therapist</Btn>
        </div>
      </div>
      <div style={{ opacity: 0.5, fontSize: 13, marginBottom: 28 }}>
        Manage therapist profiles, credentials, modalities, and training notes.
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 9, border: "1px solid #3d1a1a", background: "#1a0808", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Practice filter */}
      {practices.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          <button onClick={() => setFilterPractice("")}
            style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${!filterPractice ? "#2a3050" : "#1a1e2a"}`, background: !filterPractice ? "#0d1220" : "transparent", color: !filterPractice ? "rgba(255,255,255,0.9)" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            All Practices
          </button>
          {practices.map((p) => (
            <button key={p.id} onClick={() => setFilterPractice(p.id)}
              style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${filterPractice === p.id ? "#2a3050" : "#1a1e2a"}`, background: filterPractice === p.id ? "#0d1220" : "transparent", color: filterPractice === p.id ? "rgba(255,255,255,0.9)" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {p.name ?? p.id}
            </button>
          ))}
        </div>
      )}


      {/* Table */}
      <div style={{ border: "1px solid #1a1e2a", borderRadius: 12, overflow: "hidden", background: "#0d1018" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.4fr 140px", padding: "8px 14px", borderBottom: "1px solid #1f2533", fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase" }}>
          <div>Therapist</div>
          <div>Practice</div>
          <div>License</div>
          <div>Modalities</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {loading && <div style={{ padding: "20px 14px", opacity: 0.5, fontSize: 13 }}>Loading…</div>}
        {!loading && displayed.length === 0 && <div style={{ padding: "20px 14px", opacity: 0.5, fontSize: 13 }}>No therapists found.</div>}

        {displayed.map((t) => {
          const ep = t.extended_profile ?? {};
          const modalities = ep.therapy_modalities ?? [];
          return (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.4fr 140px", padding: "14px", borderBottom: "1px solid #1a1e2a", alignItems: "center", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{t.name ?? "—"}</div>
                {ep.email && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{ep.email}</div>}
                {ep.phone && <div style={{ fontSize: 11, opacity: 0.5 }}>{ep.phone}</div>}
                <div style={{ marginTop: 3, fontSize: 10, fontFamily: "monospace", opacity: 0.25 }}>{t.id}</div>
              </div>
              <div style={{ fontSize: 13 }}>{t.practiceName ?? "—"}</div>
              <div>
                {ep.license_type
                  ? <Badge tone="neutral">{ep.license_type}{ep.license_state ? ` · ${ep.license_state}` : ""}</Badge>
                  : <span style={{ opacity: 0.35, fontSize: 12 }}>—</span>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {modalities.length > 0
                  ? modalities.slice(0, 3).map((m) => <Badge key={m} tone="good">{m}</Badge>)
                  : <span style={{ opacity: 0.35, fontSize: 12 }}>—</span>}
                {modalities.length > 3 && <Badge tone="neutral">+{modalities.length - 3}</Badge>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <Btn onClick={() => openEdit(t)}>Edit</Btn>
                {deleteConfirm === t.id
                  ? (
                    <>
                      <Btn tone="danger" onClick={() => deleteTherapist(t.id)} disabled={deleting}>{deleting ? "…" : "Confirm"}</Btn>
                      <Btn onClick={() => setDeleteConfirm(null)}>✕</Btn>
                    </>
                  )
                  : <Btn tone="danger" onClick={() => setDeleteConfirm(t.id)}>✕</Btn>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit panel */}
      <SlidePanel open={panel !== null} onClose={closePanel} title={panel === "add" ? "Add Therapist" : "Edit Therapist"}>
        <FormSectionLabel>Basic</FormSectionLabel>
        <FormField label="Name" value={form.name} onChange={(v) => setField("name", v)} placeholder="Full name" />
        <FormSelect label="Practice" value={form.practice_id} onChange={(v) => setField("practice_id", v)}
          options={practices.map((p) => ({ id: p.id, name: p.name }))} />

        <FormSectionLabel>Contact</FormSectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Email" value={form.email ?? ""} onChange={(v) => setField("email", v)} placeholder="email@example.com" type="email" />
          <FormField label="Phone" value={form.phone ?? ""} onChange={(v) => setField("phone", v)} placeholder="(555) 000-0000" />
        </div>

        <FormSectionLabel>Credentials</FormSectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>License Type</div>
            <select value={form.license_type ?? ""} onChange={(e) => setField("license_type", e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
              <option value="">— None —</option>
              {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>License State</div>
            <select value={form.license_state ?? ""} onChange={(e) => setField("license_state", e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #1f2533", background: "#080c12", color: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
              <option value="">— State —</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="License Number" value={form.license_number ?? ""} onChange={(v) => setField("license_number", v)} placeholder="LCS-12345" />
          <FormField label="License Expiry" value={form.license_expiry ?? ""} onChange={(v) => setField("license_expiry", v)} type="date" />
        </div>

        <FormSectionLabel>Certifications</FormSectionLabel>
        <TagInput label="Certifications" value={form.certifications ?? []} onChange={(v) => setField("certifications", v)} placeholder="e.g. EMDR, Gottman Level 2…" />

        <FormSectionLabel>Therapy Modalities</FormSectionLabel>
        <ToggleChips label="Modalities" value={form.therapy_modalities ?? []} onChange={(v) => setField("therapy_modalities", v)} options={MODALITY_OPTIONS} />

        <FormSectionLabel>Specializations</FormSectionLabel>
        <ToggleChips label="Specializations" value={form.specializations ?? []} onChange={(v) => setField("specializations", v)} options={SPEC_OPTIONS} />

        <FormSectionLabel>Training &amp; Background</FormSectionLabel>
        <FormTextarea label="Training Notes" value={form.training_notes ?? ""} onChange={(v) => setField("training_notes", v)} placeholder="Training history, continuing education, certifications earned…" rows={4} />
        <FormTextarea label="Bio" value={form.bio ?? ""} onChange={(v) => setField("bio", v)} placeholder="Brief professional bio used in AI context…" rows={4} />

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
