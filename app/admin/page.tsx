// app/admin/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NavSidebar } from "@/app/components/NavSidebar";

type AdminOverview = {
  totals: {
    practices: number;
    therapists: number;
    active_cases: number;
    unassigned_cases: number;
    checkins: number;
    avg_score: number | null;
    at_risk_checkins: number;
  };
  practices: Array<{ id: string; name: string | null }>;
};

function toYYYYMMDD(d: Date) { return d.toISOString().slice(0, 10); }
function toMondayYYYYMMDD(s: string) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYYYYMMDD(d);
}

const TOOLS = [
  {
    href: "/admin/therapists",
    icon: "◎",
    accent: "#7c5cfc",
    accentAlpha: "rgba(124,92,252,",
    title: "Therapists",
    desc: "Manage therapist profiles, practice assignments, and caseload visibility. Add new clinicians or update credentials and affiliations.",
  },
  {
    href: "/admin/patients",
    icon: "⬟",
    accent: "#00c8a0",
    accentAlpha: "rgba(0,200,160,",
    title: "Patients",
    desc: "View and manage patient records, case assignments, and enrollment status. Archive inactive cases or reassign patients between therapists.",
  },
  {
    href: "/admin/dev",
    icon: "⌁",
    accent: "#4f6ef7",
    accentAlpha: "rgba(79,110,247,",
    title: "Developer Tools",
    desc: "Inspect API endpoints, run diagnostics, and review integration health. Use for debugging data pipelines and testing configuration changes.",
  },
];

const COMING_SOON = [
  {
    icon: "◑",
    title: "Theme & Branding",
    desc: "Custom colors, logos, and white-label configuration for client-facing views.",
    badge: { label: "Soon", color: "#e879f9", bg: "rgba(232,121,249,0.07)", border: "rgba(232,121,249,0.2)" },
  },
  {
    icon: "◈",
    title: "Permissions & Roles",
    desc: "Fine-grained access control — define what each role can see and do across the platform.",
    badge: { label: "Soon", color: "#f5a623", bg: "rgba(245,166,35,0.07)", border: "rgba(245,166,35,0.2)" },
  },
  {
    icon: "◎",
    title: "Audit Log",
    desc: "A full record of configuration changes, data edits, and access events for compliance and review.",
    badge: { label: "Planned", color: "#00c8a0", bg: "rgba(0,200,160,0.07)", border: "rgba(0,200,160,0.2)" },
  },
];

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [sidebarPracticeId, setSidebarPracticeId] = useState<string | null>(null);
  const [sidebarTherapistId, setSidebarTherapistId] = useState<string | null>(null);

  const weekStart = useMemo(() => toMondayYYYYMMDD(toYYYYMMDD(new Date())), []);

  useEffect(() => {
    try {
      setSidebarPracticeId(localStorage.getItem("selected_practice_id"));
      setSidebarTherapistId(localStorage.getItem("selected_therapist_id"));
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/admin/overview?range=7d", { cache: "no-store" })
      .then(r => r.json())
      .then(j => setData(j.data ?? null))
      .catch(() => {});
  }, []);


  const sidebarPracticeName = useMemo(
    () => (data?.practices ?? []).find(p => p.id === sidebarPracticeId)?.name ?? null,
    [data, sidebarPracticeId]
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c12", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .tool-card { transition: border-color 0.15s, transform 0.15s, background 0.15s; }
        .tool-card:hover { transform: translateY(-2px); }
      `}</style>

      <NavSidebar
        practiceId={sidebarPracticeId}
        practiceName={sidebarPracticeName}
        therapistId={sidebarTherapistId}
        weekStart={weekStart}
        adminOnly={true}
      />

      <main style={{ flex: 1, minWidth: 0, padding: "56px 64px 80px", maxWidth: 900 }}>

        {/* ── Header ── */}
        <div style={{ animation: "fadeUp 0.25s ease", marginBottom: 56 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#374151", textDecoration: "none", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 28 }}>
            ← Home
          </Link>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: "linear-gradient(135deg, #a21caf 0%, #e879f9 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                  boxShadow: "0 0 32px rgba(232,121,249,0.22), 0 0 0 1px rgba(232,121,249,0.1)",
                }}>⚙</div>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "#f1f3f8", lineHeight: 1 }}>
                  Admin Console
                </h1>
              </div>
              <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.65, maxWidth: 520 }}>
                Manage the people, data, and infrastructure that power empathAI. Use the tools below to configure therapist rosters, patient records, and platform integrations.
              </p>
            </div>
          </div>
        </div>

        {/* ── Tools ── */}
        <div style={{ animation: "fadeUp 0.3s ease 0.06s both" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.6, color: "#374151", textTransform: "uppercase", marginBottom: 16 }}>
            Tools
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
            {TOOLS.map(({ href, icon, accent, accentAlpha, title, desc }) => (
              <Link key={href} href={href} style={{ textDecoration: "none", color: "inherit" }}>
                <div
                  className="tool-card"
                  style={{
                    height: "100%",
                    padding: "24px 22px",
                    borderRadius: 16,
                    border: `1px solid ${accentAlpha}0.35)`,
                    background: `linear-gradient(145deg, ${accentAlpha}0.1) 0%, #0d1018 60%)`,
                    position: "relative", overflow: "hidden", cursor: "pointer",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${accentAlpha}0.6)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${accentAlpha}0.35)`; }}
                >
                  <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${accentAlpha}0.18) 0%, transparent 70%)`, pointerEvents: "none" }} />

                  <div style={{ fontSize: 22, marginBottom: 16, color: accent }}>{icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f3f8", marginBottom: 8 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65 }}>{desc}</div>

                  <div style={{ marginTop: 20, fontSize: 12, fontWeight: 700, color: accent, display: "flex", alignItems: "center", gap: 4 }}>
                    Open <span style={{ fontSize: 14 }}>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Coming soon ── */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.6, color: "#374151", textTransform: "uppercase", marginBottom: 16 }}>
            Coming soon
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {COMING_SOON.map(({ icon, title, desc, badge }) => (
              <div key={title} style={{
                padding: "24px 22px", borderRadius: 16,
                border: "1px solid #111420", background: "#0a0c12",
                position: "relative", overflow: "hidden", opacity: 0.6,
              }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)`, pointerEvents: "none" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ fontSize: 22, color: "#374151" }}>{icon}</div>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 999, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, letterSpacing: 0.5 }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#4b5563", marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
