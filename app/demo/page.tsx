"use client";

import { useState } from "react";
import { DEMO_CONFIG } from "@/lib/demo/demoMode";

const DEMO_URLS = [
  {
    label: "Manager Dashboard",
    description: "Practice-level overview with THS, at-risk queue, and team stats",
    path: `/dashboard/manager?demo=true&practice_id=${DEMO_CONFIG.practiceId}`,
  },
  {
    label: "Therapist Dashboard (Dr. Maya Chen)",
    description: "Caseload view including critical patient Sam T.",
    path: `/dashboard/therapists/${DEMO_CONFIG.therapistId}?demo=true`,
  },
  {
    label: "Therapist Care View",
    description: "Weekly care overview with check-in signals and task generation",
    path: `/dashboard/therapists/${DEMO_CONFIG.therapistId}/care?demo=true`,
  },
  {
    label: "Critical Case (Sam T.)",
    description: "Score 2, declining trajectory — shows session prep, tasks, timeline",
    path: `/cases/demo-case-03?demo=true`,
  },
  {
    label: "Network Admin Overview",
    description: "Multi-practice network view with aggregated signals",
    path: `/admin?demo=true`,
  },
  {
    label: "Agent Status",
    description: "Internal console showing health of all AI services, audit feed, redaction stats, and pilot readiness",
    path: `/status?demo=true`,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        background: copied ? "#16a34a" : "#334155",
        color: "#e2e8f0",
        border: "none",
        borderRadius: 6,
        padding: "6px 14px",
        fontSize: 13,
        cursor: "pointer",
        fontWeight: 500,
        transition: "background 0.2s",
      }}
    >
      {copied ? "Copied!" : "Copy URL"}
    </button>
  );
}

export default function DemoPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div style={{ background: "#080c12", color: "#e2e8f0", minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Demo URLs</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 32 }}>
          Pre-built demo links for investor pitches. Each URL loads synthetic data — no database required.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {DEMO_URLS.map((url) => {
            const fullUrl = `${origin}${url.path}`;
            return (
              <div
                key={url.path}
                style={{
                  background: "#0f1724",
                  borderRadius: 10,
                  padding: "16px 20px",
                  border: "1px solid #1e293b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <a
                    href={url.path}
                    style={{ color: "#60a5fa", fontWeight: 600, fontSize: 15, textDecoration: "none" }}
                  >
                    {url.label}
                  </a>
                  <CopyButton text={fullUrl} />
                </div>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>{url.description}</p>
                <code style={{ color: "#64748b", fontSize: 12, display: "block", marginTop: 6, wordBreak: "break-all" }}>
                  {url.path}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
