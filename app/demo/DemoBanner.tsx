"use client";

import { useEffect, useState } from "react";
import { isDemoMode, disableDemoMode, DEMO_CONFIG } from "@/lib/demo/demoMode";

export default function DemoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isDemoMode());
  }, []);

  if (!show) return null;

  function handleExit() {
    disableDemoMode();
    // Clear tour state if active
    try { sessionStorage.removeItem("empathai_demo_tour"); } catch {}
    // Redirect to landing page
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#b45309",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, textAlign: "center", minWidth: 0 }}>{DEMO_CONFIG.banner}</span>
      <button
        onClick={handleExit}
        style={{
          background: "rgba(0,0,0,0.2)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: 5,
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          padding: "3px 10px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>{"\u2715"}</span> Exit Demo
      </button>
    </div>
  );
}
