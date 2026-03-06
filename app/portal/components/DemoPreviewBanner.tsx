"use client";

import { useEffect, useState } from "react";
import { getRole } from "@/lib/roleContext";

/**
 * Shows a banner when a therapist/manager is previewing the patient portal.
 * Detection: uses getRole() — therapist, manager, or admin viewing the portal.
 */
export default function DemoPreviewBanner() {
  const [persona, setPersona] = useState<string | null>(null);

  useEffect(() => {
    const role = getRole();
    if (role && ["therapist", "manager", "admin"].includes(role)) {
      setPersona(role);
    }
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
