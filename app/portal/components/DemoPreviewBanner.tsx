"use client";

import { useEffect, useState } from "react";

/**
 * Shows a banner when a therapist/manager is previewing the patient portal.
 * Detection: checks localStorage for selected_persona = therapist | manager | admin.
 */
export default function DemoPreviewBanner() {
  const [persona, setPersona] = useState<string | null>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem("selected_persona");
      if (p && ["therapist", "manager", "admin"].includes(p)) {
        setPersona(p);
      }
    } catch {}
  }, []);

  if (!persona) return null;

  return (
    <div style={{
      padding: "8px 16px",
      background: "rgba(245,166,35,0.08)",
      borderBottom: "1px solid rgba(245,166,35,0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontSize: 12,
      fontWeight: 600,
      color: "rgba(245,166,35,0.85)",
      fontFamily: "'DM Mono', monospace",
      letterSpacing: 0.3,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5a623", flexShrink: 0 }} />
      You are previewing the patient portal as a {persona}. Patients see this view.
    </div>
  );
}
