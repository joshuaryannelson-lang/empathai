// app/cases/[id]/session-prep/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import SessionPrepCard from "@/app/components/SessionPrepCard";
import { isDemoMode } from "@/lib/demo/demoMode";

function toMondayISO(d: Date) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() - ((copy.getUTCDay() + 6) % 7));
  return copy.toISOString().slice(0, 10);
}

function SessionPrepPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const caseId = params?.id as string;
  const isDemo = isDemoMode();
  const weekStart = toMondayISO(new Date());

  // Case context (patient name, therapist, title)
  type CaseContext = {
    patientName: string;
    therapistName: string;
    caseTitle: string;
  };
  const [ctx, setCtx] = useState<CaseContext | null>(null);

  useEffect(() => {
    if (!caseId) return;
    if (isDemo) {
      // Load fixture context without API call
      import("@/lib/demo/demoData").then(({ getDemoCase, getDemoPatient, getDemoTherapist }) => {
        const c = getDemoCase(caseId);
        if (!c) return;
        const p = getDemoPatient(c.patient_id);
        const t = getDemoTherapist(c.therapist_id);
        setCtx({
          patientName: p?.first_name ?? "Patient",
          therapistName: t?.name ?? "Therapist",
          caseTitle: c.title ?? caseId,
        });
      });
      return;
    }
    // Real mode: fetch from API
    fetch(`/api/cases/${encodeURIComponent(caseId)}/timeline`, { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        const d = json?.data ?? json;
        setCtx({
          patientName: d?.patient?.first_name ?? "Patient",
          therapistName: d?.therapist?.name ?? "Therapist",
          caseTitle: d?.case?.title ?? caseId,
        });
      })
      .catch(() => {});
  }, [caseId, isDemo]);

  return (
    <div style={{ background: "#080c12", color: "#e2e8f0", minHeight: "100vh", fontFamily: "'DM Sans', system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Sora:wght@400;600;700;800&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Back link */}
        <Link
          href={`/cases/${encodeURIComponent(caseId)}`}
          style={{ fontSize: 12, fontWeight: 500, color: "#4b5563", textDecoration: "none", letterSpacing: 0.5, textTransform: "uppercase", display: "inline-block", marginBottom: 20 }}
        >
          &larr; Back to case
        </Link>

        {/* Header */}
        <div style={{ marginBottom: 24, animation: "fadeUp 0.3s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #3b4fd4, #6d3fc4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, color: "white",
            }}>
              {"\u2726"}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "#f1f3f8", fontFamily: "'Sora', system-ui", margin: 0 }}>
                AI Session Prep
              </h1>
              {ctx && (
                <div style={{ fontSize: 12, color: "#4b5563", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                  {ctx.patientName} &middot; {ctx.caseTitle}
                </div>
              )}
            </div>
          </div>
          {ctx && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginTop: 4 }}>
              Structured insights for {ctx.therapistName}&apos;s next session with {ctx.patientName}.
            </div>
          )}
        </div>

        {/* Session Prep Card — auto-loads via useEffect in the component */}
        <div style={{ animation: "fadeUp 0.35s ease 0.05s both" }}>
          <SessionPrepCard caseId={caseId} weekStart={weekStart} />
        </div>
      </div>
    </div>
  );
}

export default function SessionPrepPage() {
  return (
    <Suspense fallback={null}>
      <SessionPrepPageInner />
    </Suspense>
  );
}
