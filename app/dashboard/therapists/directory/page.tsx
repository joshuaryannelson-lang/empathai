// app/dashboard/therapists/directory/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavSidebar } from "@/app/components/NavSidebar";

type Practice = { id: string; name: string | null };
type Therapist = { id: string; name: string };

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(typeof json?.error === "string" ? json.error : JSON.stringify(json?.error ?? json));
  }
  return json;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn" | "bad" | "good";
}) {
  const bg =
    tone === "bad"
      ? "#1a0808"
      : tone === "warn"
      ? "#1a1000"
      : tone === "good"
      ? "#061a0b"
      : "#0d1018";

  const border =
    tone === "bad"
      ? "#3d1a1a"
      : tone === "warn"
      ? "#3d2800"
      : tone === "good"
      ? "#0e2e1a"
      : "#1a1e2a";

  const color =
    tone === "bad"
      ? "#f87171"
      : tone === "warn"
      ? "#fb923c"
      : tone === "good"
      ? "#4ade80"
      : "#9ca3af";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function TherapistDirectoryPage() {
  const router = useRouter();
  const search = useSearchParams();

  const practiceIdFromUrl = search?.get("practice_id") ?? "";
  const useLast = search?.get("use_last") === "1";

  const [practices, setPractices] = useState<Practice[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  const [practiceId, setPracticeId] = useState<string>(practiceIdFromUrl);

  const [loadingPractices, setLoadingPractices] = useState(false);
  const [loadingTherapists, setLoadingTherapists] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Keep local state synced with URL (URL is source of truth)
  useEffect(() => {
    setPracticeId(practiceIdFromUrl);
  }, [practiceIdFromUrl]);

  // Load practices (always)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingPractices(true);
      setError(null);
      try {
        const json = await fetchJson("/api/practices");
        if (!alive) return;
        setPractices(json.data ?? []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? String(e));
        setPractices([]);
      } finally {
        if (alive) setLoadingPractices(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Optional: if use_last=1 and no practice_id, try localStorage.
  useEffect(() => {
    if (practiceIdFromUrl) return;
    if (!useLast) return;

    try {
      const stored = localStorage.getItem("selected_practice_id");
      if (stored) {
        router.replace(`/dashboard/therapists/directory?practice_id=${encodeURIComponent(stored)}`);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLast, practiceIdFromUrl]);

  // Load therapists when practiceId is present
  useEffect(() => {
    if (!practiceId) {
      setTherapists([]);
      return;
    }

    let alive = true;
    (async () => {
      setLoadingTherapists(true);
      setError(null);
      try {
        const json = await fetchJson(`/api/therapists?practice_id=${encodeURIComponent(practiceId)}`);
        if (!alive) return;
        setTherapists(json.data ?? []);
        try {
          localStorage.setItem("selected_practice_id", practiceId);
        } catch {}
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? String(e));
        setTherapists([]);
      } finally {
        if (alive) setLoadingTherapists(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [practiceId]);

  const selectedPractice = useMemo(() => {
    if (!practiceId) return null;
    return practices.find((p) => p.id === practiceId) ?? null;
  }, [practiceId, practices]);

  function selectPractice(nextId: string) {
    router.replace(`/dashboard/therapists/directory?practice_id=${encodeURIComponent(nextId)}`);
  }

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
    <NavSidebar
      practiceId={practiceId || null}
      practiceName={selectedPractice?.name ?? null}
      therapistId={null}
      weekStart={weekStart}
    />
    <main className="dir-main" style={{ padding: 40, flex: 1, maxWidth: 1100 }}>
      <style>{`
        @media (max-width: 767px) {
          .dir-main { padding: 64px 16px 60px !important; }
          .dir-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .dir-table-wrap > div { min-width: 500px; }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" style={{ textDecoration: "none", opacity: 0.9, color: "inherit" }}>
          ← Home
        </Link>

        <h1 style={{ margin: 0 }}>Directory</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {practiceId ? <Badge tone="neutral">Practice selected</Badge> : <Badge tone="warn">Pick a practice</Badge>}
          <button
            onClick={() => router.refresh()}
            style={{
              padding: "10px 14px",
              borderRadius: 9,
              border: "1px solid #1f2533",
              background: "transparent",
              color: "inherit",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
        Select a practice to view and navigate to individual therapist dashboards.
      </div>

      {error && (
        <pre className="error-box">{error}</pre>
      )}

      {/* Practice picker */}
      <div
        style={{
          marginTop: 18,
          border: "1px solid #1a1e2a",
          borderRadius: 12,
          padding: 14,
          background: "#0d1018",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Practice</div>
          {selectedPractice ? <Badge tone="good">{selectedPractice.name ?? selectedPractice.id}</Badge> : null}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {loadingPractices ? (
            <div style={{ opacity: 0.7 }}>Loading practices…</div>
          ) : practices.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No practices found.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {practices.map((p) => {
                const active = p.id === practiceId;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPractice(p.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 9,
                      border: active ? "1px solid #2e3650" : "1px solid #1a1e2a",
                      background: active ? "#0d1220" : "#0d1018",
                      color: "inherit",
                      cursor: "pointer",
                      fontWeight: 900,
                      opacity: active ? 1 : 0.9,
                    }}
                  >
                    {p.name ?? p.id}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Therapist list */}
      <div className="dir-table-wrap" style={{ marginTop: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            padding: "10px 12px",
            borderBottom: "1px solid #1f2533",
            fontWeight: 700,
            opacity: 0.7,
          }}
        >
          <div>Therapist</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {!practiceId ? (
          <div style={{ opacity: 0.7, marginTop: 10 }}>Pick a practice to see therapists.</div>
        ) : loadingTherapists ? (
          <div style={{ opacity: 0.7, marginTop: 10 }}>Loading therapists…</div>
        ) : therapists.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 10 }}>No therapists found.</div>
        ) : (
          therapists.map((t) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                padding: "12px",
                borderBottom: "1px solid #1a1e2a",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 800 }}>{t.name}</div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Link
                  href={`/dashboard/therapists/${encodeURIComponent(t.id)}/care`}
                  style={{
                    textDecoration: "none",
                    borderBottom: "1px dotted rgba(255,255,255,0.35)",
                    fontWeight: 800,
                  }}
                >
                  View care signals →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={null}>
      <TherapistDirectoryPage />
    </Suspense>
  );
}
