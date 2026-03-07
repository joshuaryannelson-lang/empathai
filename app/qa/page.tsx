// app/qa/page.tsx
// Collaborative QA board — shareable, no login required.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Design tokens (match EmpathAI dark theme) ────────────────────────────────

const T = {
  bg: { page: "#080c12", card: "#0d1018", surface: "#111420" },
  border: { DEFAULT: "#1a1e2a", emphasis: "#1f2533" },
  text: {
    primary: "#e2e8f0",
    heading: "rgba(255,255,255,0.9)",
    secondary: "rgba(255,255,255,0.65)",
    tertiary: "rgba(255,255,255,0.45)",
    muted: "rgba(255,255,255,0.35)",
    disabled: "rgba(255,255,255,0.25)",
  },
  pass: { fg: "#4ade80", bg: "#061a0b", border: "#0e2e1a" },
  fail: { fg: "#f87171", bg: "#1a0808", border: "#3d1a1a" },
  skip: { fg: "#a5b4fc", bg: "#0d0f1a", border: "#1f2240" },
  amber: { fg: "#fbbf24", bg: "#1a1508", border: "#3d3010" },
  accent: "#38bdf8",
};
const FONT = {
  display: "'Sora', system-ui, sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'DM Mono', monospace",
};

// Consistent button style base
const BTN_BASE: React.CSSProperties = {
  padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
  fontFamily: FONT.body, transition: "all 0.15s", cursor: "pointer",
  minWidth: 48, textAlign: "center",
};

// ── Checklist data ───────────────────────────────────────────────────────────

type PageSection = {
  id: string;
  name: string;
  url: string;
  who: string;
  group: string;
  checks: string[];
};

const PAGES: PageSection[] = [
  // ── FOR EVERYONE ──
  {
    id: "landing",
    name: "Home Page",
    url: "/",
    who: "Anyone (no login needed)",
    group: "For Everyone",
    checks: [
      "The page opens without any error messages or blank screens",
      "You see 5 cards to choose from: Patient, Therapist, Manager, Admin, and Analytics",
      "Clicking each card highlights it and shows a description below",
      "The /demo page loads and shows persona cards with working links to demo views",
      "Click the Patient card — it should take you to the patient portal welcome page",
      "Shrink the window narrow (like a phone) — the cards should stack neatly and nothing is cut off",
      "Nothing on this page looks like a random code (like 'a3f9-bc12-...')",
    ],
  },
  // ── FOR PATIENTS ──
  {
    id: "portal-onboarding",
    name: "Joining the Portal",
    url: "/portal/onboarding",
    who: "Patients (this is where you start)",
    group: "For Patients",
    checks: [
      "The page opens and you see a box to type in a join code",
      "There's a 'View as demo patient' button for testing — click it and you'll see a friendly welcome with just a first name (no last name shown)",
      "Type a random wrong code and hit enter — you get a calm error message, not a crash",
      "After joining, you're automatically taken to the check-in page",
      "Shrink the window narrow — the form is centered and easy to use",
      "No random codes or technical text visible anywhere",
    ],
  },
  {
    id: "portal-checkin",
    name: "Weekly Check-In",
    url: "/portal/checkin",
    who: "Patients (must be in the portal first)",
    group: "For Patients",
    checks: [
      "If you haven't joined the portal yet, this page sends you back to the welcome page (not a blank screen)",
      "You see a mood rating (1 to 10) and a notes box",
      "Pick a number and type 'Had a good week' — hit submit — it should go through and show a confirmation",
      "Type 'I want to hurt myself' in the notes box — a supportive message with a helpline number (988) should appear and the submit button should be blocked",
      "Type your email address in the notes box — the app should warn you not to share personal info",
      "Shrink the window narrow — the rating and submit button are fully visible",
      "No therapist names, codes, or technical text visible on this page",
    ],
  },
  {
    id: "portal-history",
    name: "My History",
    url: "/portal/history",
    who: "Patients (must be in the portal first)",
    group: "For Patients",
    checks: [
      "If you haven't joined the portal yet, this page sends you back to the welcome page",
      "You see a list of past check-ins with scores and dates",
      "Only your first name is shown — no last name, no codes",
      "If there are no past check-ins, you see a calm message (not an error)",
      "Shrink the window narrow — the history list reads cleanly on a small screen",
    ],
  },
  {
    id: "portal-goals",
    name: "My Goals",
    url: "/portal/goals",
    who: "Patients (must be in the portal first)",
    group: "For Patients",
    checks: [
      "If you haven't joined the portal yet, this page sends you back to the welcome page",
      "You see a list of your goals with their status (active or completed)",
      "Goal titles are plain and encouraging — things like 'Practice breathing exercises', not medical jargon",
      "If there are no goals yet, you see a calm message (not an error)",
      "Shrink the window narrow — goal cards are readable",
    ],
  },
  // ── FOR THERAPISTS ──
  {
    id: "therapist-care",
    name: "My Cases",
    url: "/dashboard",
    who: "Therapists (select your role on the home page first, then navigate here)",
    group: "For Therapists",
    checks: [
      "The page opens with the therapist's name and a summary of their caseload",
      "There's a section for at-risk cases — these are highlighted but in calm colors (not screaming red)",
      "Another section shows cases where patients haven't checked in this week",
      "Patient names show first name only — no last names visible anywhere",
      "Shrink the window narrow — sections stack vertically and you can scroll through all of them",
      "Nothing on the page looks like a random code (like 'a3f9-bc12-...')",
    ],
  },
  {
    id: "case-detail",
    name: "Case Detail",
    url: "/cases",
    who: "Therapists (open a case from the list to see details)",
    group: "For Therapists",
    checks: [
      "Open a case from the All Cases list — it opens with the case title, patient first name, and therapist name",
      "You can see a timeline of past check-ins with scores and dates",
      "There's a 'Regenerate' button at the top of the Session Prep card — it's visible and clickable",
      "Goals section shows active goals with target dates",
      "No patient last names visible anywhere in the main view",
      "Shrink the window narrow — all sections are reachable by scrolling",
    ],
  },
  {
    id: "case-list",
    name: "All Cases",
    url: "/cases",
    who: "Therapists / Practice Managers (select your role on the home page first)",
    group: "For Therapists",
    checks: [
      "The page opens with a list of cases showing patient first name, therapist, score, and status",
      "There are filter buttons at the top (low scores, missing check-ins, unassigned) — clicking one filters the list",
      "No patient last names visible in any row",
      "If no cases match your filter, you see a calm empty message (not an error)",
      "Shrink the window narrow — the list is scrollable or stacks into cards",
    ],
  },
  // ── FOR PRACTICE MANAGERS ──
  {
    id: "practice-status",
    name: "Practice Status",
    url: "/admin/status",
    who: "Practice Managers (select 'I'm a Manager' on the home page first)",
    group: "For Practice Managers",
    checks: [
      "The page opens with 4 summary cards: check-in rate, average rating, cases needing attention, and health score",
      "Below the cards, there's a list of therapist activity (names, case counts, last activity)",
      "There's a recent activity feed showing things like 'A patient completed their weekly check-in'",
      "Trend charts at the bottom show 4 weeks of data as simple lines",
      "Everything is combined — no individual patient names visible anywhere",
      "Shrink the window narrow — the 4 cards stack to 2 across or 1 across",
      "Nothing on this page looks like a random code",
    ],
  },
  {
    id: "practice-health",
    name: "Practice Health Score",
    url: "/admin/status",
    who: "Practice Managers (health score is shown on the Practice Status page)",
    group: "For Practice Managers",
    checks: [
      "The page opens with an overall health score number and a breakdown of what goes into it",
      "The breakdown uses plain labels like 'Engagement', 'Stability', 'Workload' — not technical jargon",
      "There's a trend comparison to last week with an arrow showing up or down",
      "No individual patient names visible — only practice-level numbers",
      "Shrink the window narrow — the score card and breakdown stack cleanly",
    ],
  },
  // ── FOR ADMIN ──
  {
    id: "admin-home",
    name: "Admin Home",
    url: "/admin",
    who: "This page requires a real admin account — if you don't have one, just confirm that picking 'I'm a Manager' takes you away from this page",
    group: "For Admin",
    checks: [
      "The page opens with an 'Admin Console' heading and a set of tool cards",
      "You can see cards for: Practice Status, Therapists, Patients, Developer Tools, System Status",
      "There's a 'Seed Demo Data' card with a button to populate test data",
      "If you picked 'I'm a Manager' on the home page, you should be automatically taken to Practice Status instead of seeing this page",
      "If you picked 'I'm a Therapist' on the home page, you should NOT be able to reach any admin page at all — you'll be sent back to the home page",
      "Shrink the window narrow — tool cards stack to 1 column",
    ],
  },
  {
    id: "admin-dev",
    name: "System Diagnostics",
    url: "/admin/dev",
    who: "Admins only",
    group: "For Admin",
    checks: [
      "The page opens with 5 tabs: Diagnostics, AI Services, API Reference, Launch Readiness, and Cost",
      "Click the Diagnostics tab — each check shows a status and response time. Click 'Show checks' to expand the full list",
      "No patient data or personal information visible — only system numbers",
      "If you're not an admin, you should not be able to reach this page",
      "Shrink the window narrow — panels stack vertically",
    ],
  },
  {
    id: "system-status",
    name: "AI Services Status",
    url: "/status",
    who: "Anyone — no login needed",
    group: "For Admin",
    checks: [
      "The page shows an overall status banner — green means all systems operational",
      "You see 5 services listed: Session Prep, PHI Redaction, Risk Signals, Health Score Narrative, and Patient Portal — each with a status dot",
      "No patient data, costs, or technical metrics visible — just service names and status",
      "The page says when it was last checked and updates automatically",
    ],
  },
  {
    id: "product-health",
    name: "Product Health",
    url: "/status",
    who: "Anyone — no login needed",
    group: "For Everyone",
    checks: [
      "The page opens with an overall status banner — green means all systems are running normally",
      "You see 5 services listed: Session Prep, PHI Redaction, Risk Signals, Health Score Narrative, and Patient Portal — each with a status dot",
      "The page says when it was last checked and updates automatically",
      "No patient data, costs, or technical metrics visible — just service names and status",
      "Shrink the window narrow — banner and service list stack cleanly",
    ],
  },
];

const GROUPS = ["For Everyone", "For Patients", "For Therapists", "For Practice Managers", "For Admin"];

// ── Types ────────────────────────────────────────────────────────────────────

type CheckResult = {
  id: string;
  page_id: string;
  check_index: number;
  tester_name: string;
  status: "pass" | "fail" | "skip";
  note: string | null;
  checked_at: string;
  page_path?: string;
  last_verified_at?: string | null;
  last_verified_by?: string | null;
  stale?: boolean;
};

// ── Main component ───────────────────────────────────────────────────────────

export default function QABoard() {
  const [testerName, setTesterName] = useState("");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(PAGES[0]?.id ?? null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [noteExpanded, setNoteExpanded] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [allNotesOpen, setAllNotesOpen] = useState(false);
  const [namePromptKey, setNamePromptKey] = useState<string | null>(null);
  const [badgeExpanded, setBadgeExpanded] = useState<Set<string>>(new Set());
  const [noteVisible, setNoteVisible] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [markingStale, setMarkingStale] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);
  const deletedIds = useRef<Set<string>>(new Set());

  // Load tester name and admin mode from localStorage
  useEffect(() => {
    try {
      setTesterName(localStorage.getItem("qa_tester_name") ?? "");
      setIsAdmin(localStorage.getItem("selected_persona") === "admin");
    } catch {}
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/qa", { cache: "no-store" });
      const json = await res.json();
      if (Array.isArray(json?.data)) setResults(json.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  // Polling for live updates every 15s
  useEffect(() => {
    const iv = setInterval(fetchResults, 15000);
    return () => clearInterval(iv);
  }, [fetchResults]);

  // Save name and clear prompt
  function handleNameChange(name: string) {
    setTesterName(name);
    if (name.trim()) setNamePromptKey(null);
    try { localStorage.setItem("qa_tester_name", name); } catch {}
  }

  // Intercept click when no name — show prompt instead of submitting
  function requireName(checkKey: string): boolean {
    if (testerName.trim()) return true;
    setNamePromptKey(checkKey);
    nameInputRef.current?.focus();
    return false;
  }

  // Submit a check — sends note for any status
  async function submitCheck(pageId: string, checkIndex: number, status: "pass" | "fail" | "skip") {
    const key = `${pageId}-${checkIndex}`;
    if (!requireName(key)) return;
    setSubmitting(prev => new Set(prev).add(key));

    // Show note input immediately for fail/skip
    if (status === "fail" || status === "skip") {
      setNoteVisible(prev => new Set(prev).add(key));
    }

    const note = noteInputs[key]?.trim() || null;

    // Optimistic update
    const optimistic: CheckResult = {
      id: `temp-${Date.now()}`,
      page_id: pageId,
      check_index: checkIndex,
      tester_name: testerName.trim(),
      status,
      note,
      checked_at: new Date().toISOString(),
    };
    setResults(prev => {
      const filtered = prev.filter(r => !(r.page_id === pageId && r.check_index === checkIndex && r.tester_name === testerName.trim()));
      return [optimistic, ...filtered];
    });

    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, check_index: checkIndex, tester_name: testerName.trim(), status, note }),
      });
      const json = await res.json();
      if (json?.data?.id) {
        // Check if any result for this check was stale
        const wasStale = results.some(r => r.page_id === pageId && r.check_index === checkIndex && r.stale);
        let finalData = json.data;
        if (wasStale) {
          try {
            await fetch("/api/qa/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ check_id: json.data.id, verified_by: testerName.trim() }),
            });
            finalData = { ...json.data, stale: false, last_verified_at: new Date().toISOString(), last_verified_by: testerName.trim() };
          } catch {}
        }
        setResults(prev => prev.map(r => {
          if (r.id === optimistic.id) return finalData;
          // Also clear stale on other results for the same check
          if (wasStale && r.page_id === pageId && r.check_index === checkIndex) {
            return { ...r, stale: false, last_verified_at: new Date().toISOString(), last_verified_by: testerName.trim() };
          }
          return r;
        }));
      }
    } catch {
      setResults(prev => prev.filter(r => r.id !== optimistic.id));
    } finally {
      setSubmitting(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  // Clear (delete) my result for a check
  async function clearCheck(pageId: string, checkIndex: number) {
    const key = `${pageId}-${checkIndex}`;
    if (!requireName(key)) return;
    const name = testerName.trim();

    // Find and permanently suppress this result
    const removed = results.find(r => r.page_id === pageId && r.check_index === checkIndex && r.tester_name === name);
    if (!removed) return;

    // Add to deletedIds ref — survives polling, re-renders, name changes
    if (!removed.id.startsWith("temp-")) {
      deletedIds.current.add(removed.id);
    }

    // Optimistic remove + clean up note state
    setResults(prev => prev.filter(r => r !== removed));
    setNoteInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
    setNoteExpanded(prev => { const n = new Set(prev); n.delete(key); return n; });
    setNoteVisible(prev => { const n = new Set(prev); n.delete(key); return n; });

    // Fire DELETE — no rollback needed, deletedIds suppresses permanently
    const params = new URLSearchParams({ page_id: pageId, check_index: String(checkIndex), tester_name: name });
    fetch(`/api/qa?${params}`, { method: "DELETE" }).catch(() => {});
  }

  // Save note on blur — upserts the existing row
  function saveNoteOnBlur(pageId: string, checkIndex: number, myResult: CheckResult | null) {
    if (!myResult) return;
    const key = `${pageId}-${checkIndex}`;
    const currentNote = noteInputs[key];
    if (currentNote === undefined) return;
    if (currentNote.trim() === (myResult.note ?? "")) return;
    submitCheck(pageId, checkIndex, myResult.status);
  }

  // Copy link
  function copyLink() {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // Scroll to card
  function scrollToCard(pageId: string) {
    setActiveSection(pageId);
    cardRefs.current[pageId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const resultsByPage = useMemo(() => {
    const map: Record<string, CheckResult[]> = {};
    for (const r of results) {
      if (deletedIds.current.has(r.id)) continue;
      (map[r.page_id] ??= []).push(r);
    }
    return map;
  }, [results]);

  function getCheckResults(pageId: string, checkIndex: number): CheckResult[] {
    return (resultsByPage[pageId] ?? []).filter(r => r.check_index === checkIndex);
  }

  function getMyResult(pageId: string, checkIndex: number): CheckResult | null {
    if (!testerName.trim()) return null;
    return getCheckResults(pageId, checkIndex).find(r => r.tester_name === testerName.trim()) ?? null;
  }

  function getPageStatus(page: PageSection): "green" | "red" | "grey" {
    const pageResults = resultsByPage[page.id] ?? [];
    if (pageResults.length === 0) return "grey";
    if (pageResults.some(r => r.status === "fail")) return "red";
    const allPassed = page.checks.every((_, i) => pageResults.some(r => r.check_index === i && r.status === "pass"));
    return allPassed ? "green" : "grey";
  }

  // Check if any result for a (page, check) pair is stale
  function isCheckStale(pageId: string, checkIndex: number): boolean {
    return getCheckResults(pageId, checkIndex).some(r => r.stale === true);
  }

  // Get verified info for a check (when not stale)
  function getVerifiedInfo(pageId: string, checkIndex: number): { by: string; at: string } | null {
    const rs = getCheckResults(pageId, checkIndex);
    const verified = rs.find(r => r.stale === false && r.last_verified_at);
    if (!verified || !verified.last_verified_at || !verified.last_verified_by) return null;
    return { by: verified.last_verified_by, at: verified.last_verified_at };
  }

  // Count stale checks per page
  function getPageStaleCount(page: PageSection): number {
    return page.checks.filter((_, i) => isCheckStale(page.id, i)).length;
  }

  // Mark all checks for a page as stale (admin)
  async function markPageStale(page: PageSection) {
    setMarkingStale(prev => new Set(prev).add(page.id));
    try {
      const res = await fetch("/api/qa/mark-stale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_path: page.url }),
      });
      if (res.ok) {
        setResults(prev => prev.map(r =>
          r.page_id === page.id ? { ...r, stale: true } : r
        ));
      }
    } catch {} finally {
      setMarkingStale(prev => { const n = new Set(prev); n.delete(page.id); return n; });
    }
  }

  // Stale check count for stats bar
  const staleCheckCount = useMemo(() => {
    const staleKeys = new Set<string>();
    for (const r of results) {
      if (r.stale === true && !deletedIds.current.has(r.id)) {
        staleKeys.add(`${r.page_id}-${r.check_index}`);
      }
    }
    return staleKeys.size;
  }, [results]);

  // Collect all notes across all pages for the summary
  const allNotes = useMemo(() => {
    const notes: { page: PageSection; checkIndex: number; checkText: string; tester: string; note: string; status: string }[] = [];
    for (const page of PAGES) {
      const pageResults = resultsByPage[page.id] ?? [];
      for (const r of pageResults) {
        if (r.note?.trim()) {
          notes.push({
            page,
            checkIndex: r.check_index,
            checkText: page.checks[r.check_index] ?? "",
            tester: r.tester_name,
            note: r.note,
            status: r.status,
          });
        }
      }
    }
    return notes;
  }, [resultsByPage]);

  // Summary stats
  const totalChecks = PAGES.reduce((s, p) => s + p.checks.length, 0);
  const greenPages = PAGES.filter(p => getPageStatus(p) === "green").length;
  const failedChecks = PAGES.reduce((s, p) => {
    return s + p.checks.filter((_, i) => getCheckResults(p.id, i).some(r => r.status === "fail")).length;
  }, 0);
  const lastResult = results.length > 0 ? results[0]?.checked_at : null;

  function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60000) return "just now";
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
    return `${Math.floor(ms / 86400000)}d ago`;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg.page, color: T.text.primary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseHighlight { 0%,100% { border-color: ${T.border.DEFAULT}; } 50% { border-color: ${T.accent}; } }
        .qa-fade { animation: fadeIn 0.25s ease; }
        .qa-sidebar-item { cursor: pointer; padding: 6px 12px; border-radius: 6px; font-size: 13px; transition: background 0.15s; }
        .qa-sidebar-item:hover { background: rgba(255,255,255,0.05); }
        .qa-note-toggle { cursor: pointer; font-size: 11px; color: rgba(255,255,255,0.35); border: none; background: none; padding: 0; font-family: 'DM Sans', sans-serif; }
        .qa-note-toggle:hover { color: rgba(255,255,255,0.6); }
        .qa-name-highlight { animation: pulseHighlight 1s ease 2; }
        @media (max-width: 800px) {
          .qa-layout { flex-direction: column !important; }
          .qa-sidebar { display: none !important; }
          .qa-main { padding: 20px 16px 80px !important; }
        }
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="qa-sidebar" style={{
        width: 220, flexShrink: 0, padding: "24px 16px",
        borderRight: `1px solid ${T.border.DEFAULT}`,
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: T.text.muted, fontFamily: FONT.mono, marginBottom: 16 }}>
          Pages
        </div>
        {GROUPS.map(group => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: T.text.disabled, marginBottom: 6, paddingLeft: 12 }}>
              {group}
            </div>
            {PAGES.filter(p => p.group === group).map(page => {
              const status = getPageStatus(page);
              return (
                <div
                  key={page.id}
                  className="qa-sidebar-item"
                  onClick={() => scrollToCard(page.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    color: activeSection === page.id ? T.text.primary : T.text.tertiary,
                    fontWeight: activeSection === page.id ? 600 : 400,
                    background: activeSection === page.id ? "rgba(255,255,255,0.05)" : "transparent",
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                    background: status === "green" ? T.pass.fg : status === "red" ? T.fail.fg : T.text.disabled,
                  }} />
                  {page.name}
                </div>
              );
            })}
          </div>
        ))}
      </aside>

      {/* ── Main ── */}
      <main className="qa-main" style={{ flex: 1, minWidth: 0, padding: "32px 48px 80px", maxWidth: 820 }}>

        {/* Header */}
        <div className="qa-fade" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: T.text.heading, margin: 0 }}>
              EmpathAI QA Board
            </h1>
            <button
              onClick={copyLink}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: copied ? T.pass.bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${copied ? T.pass.border : T.border.DEFAULT}`,
                color: copied ? T.pass.fg : T.text.secondary,
                cursor: "pointer", fontFamily: FONT.body, transition: "all 0.15s",
              }}
            >
              {copied ? "Copied!" : "Copy link to share"}
            </button>
          </div>
          <p style={{ fontSize: 14, color: T.text.tertiary, marginTop: 8, lineHeight: 1.6 }}>
            Select your role on the home page first, then open each page link and run through the checks. Some pages require you to be logged in &mdash; if you see a login screen, that&apos;s expected behavior. Click Pass, Fail, or Skip for each one. Everyone&apos;s results show up here in real time.
          </p>
        </div>

        {/* Name input */}
        <div
          className={namePromptKey ? "qa-name-highlight" : ""}
          style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 4,
            padding: "14px 18px", borderRadius: 12,
            background: T.bg.card,
            border: `1px solid ${namePromptKey ? T.accent : T.border.DEFAULT}`,
            transition: "border-color 0.2s",
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 700, color: T.text.secondary, whiteSpace: "nowrap" }}>
            Your name:
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={testerName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Sarah"
            maxLength={50}
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 6, fontSize: 14,
              background: T.bg.surface, border: `1px solid ${T.border.DEFAULT}`,
              color: T.text.primary, outline: "none", fontFamily: FONT.body,
            }}
          />
        </div>
        {namePromptKey && (
          <div style={{ fontSize: 12, color: T.accent, marginBottom: 20, paddingLeft: 18, fontWeight: 600 }}>
            Enter your name first
          </div>
        )}
        {!namePromptKey && <div style={{ marginBottom: 24 }} />}

        {/* Summary bar */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16,
          padding: "14px 18px", borderRadius: 12,
          background: T.bg.card, border: `1px solid ${T.border.DEFAULT}`,
          fontSize: 13, color: T.text.secondary,
        }}>
          <span><strong style={{ color: T.text.primary }}>{totalChecks}</strong> total checks</span>
          <span><strong style={{ color: T.pass.fg }}>{greenPages}</strong> pages all green</span>
          <span><strong style={{ color: failedChecks > 0 ? T.fail.fg : T.text.muted }}>{failedChecks}</strong> issues found</span>
          <span><strong style={{ color: staleCheckCount > 0 ? T.amber.fg : T.text.muted }}>{staleCheckCount}</strong> needs re-verification</span>
          <span><strong style={{ color: allNotes.length > 0 ? T.accent : T.text.muted }}>{allNotes.length}</strong> notes</span>
          {lastResult && <span style={{ color: T.text.muted }}>Last updated: {timeAgo(lastResult)}</span>}
          {loading && <span style={{ color: T.text.disabled, fontStyle: "italic" }}>Loading...</span>}
        </div>

        {/* All Feedback — collapsible summary */}
        <div style={{
          marginBottom: 32, borderRadius: 12,
          background: T.bg.card, border: `1px solid ${T.border.DEFAULT}`,
          overflow: "hidden",
        }}>
          <button
            onClick={() => setAllNotesOpen(prev => !prev)}
            style={{
              width: "100%", padding: "12px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: T.text.secondary,
              fontFamily: FONT.body,
            }}
          >
            <span>All Feedback ({allNotes.length})</span>
            <span style={{ fontSize: 11, color: T.text.muted }}>
              {allNotesOpen ? "\u25B4 collapse" : "\u25BE expand"}
            </span>
          </button>
          {allNotesOpen && (
            allNotes.length === 0 ? (
              <div style={{ padding: "0 18px 14px", fontSize: 12, color: T.text.disabled, fontStyle: "italic" }}>
                No feedback submitted yet
              </div>
            ) : (
              <div style={{ padding: "0 18px 14px", display: "grid", gap: 10 }}>
                {allNotes.map((n, i) => {
                  const colors = n.status === "pass" ? T.pass : n.status === "fail" ? T.fail : T.skip;
                  return (
                    <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <div style={{ color: T.text.muted, fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: T.accent, cursor: "pointer" }} onClick={() => scrollToCard(n.page.id)}>
                          {n.page.name}
                        </span>
                        {" \u2192 "}
                        <span style={{ color: T.text.disabled }}>
                          {n.checkText.length > 60 ? n.checkText.slice(0, 60) + "..." : n.checkText}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{
                          display: "inline-block", padding: "1px 6px", borderRadius: 999,
                          fontSize: 10, fontWeight: 700,
                          background: colors.bg, border: `1px solid ${colors.border}`, color: colors.fg,
                        }}>
                          {n.tester}
                        </span>
                        <span style={{ color: T.text.secondary, fontStyle: "italic" }}>
                          &ldquo;{n.note}&rdquo;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Page cards */}
        {GROUPS.map(group => (
          <div key={group} style={{ marginBottom: 36 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase",
              color: T.text.muted, fontFamily: FONT.mono, marginBottom: 12,
            }}>
              {group}
            </div>

            {PAGES.filter(p => p.group === group).map(page => {
              const pageStatus = getPageStatus(page);
              return (
                <div
                  key={page.id}
                  ref={el => { cardRefs.current[page.id] = el; }}
                  className="qa-fade"
                  style={{
                    marginBottom: 16, padding: "20px 22px", borderRadius: 14,
                    background: T.bg.card,
                    border: `1px solid ${pageStatus === "red" ? T.fail.border : pageStatus === "green" ? T.pass.border : T.border.DEFAULT}`,
                    scrollMarginTop: 24,
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: pageStatus === "green" ? T.pass.fg : pageStatus === "red" ? T.fail.fg : T.text.disabled,
                    }} />
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: T.text.heading, fontFamily: FONT.display, margin: 0 }}>
                      {page.name}
                    </h2>
                    {getPageStaleCount(page) > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.amber.fg }}>
                        {getPageStaleCount(page)} check{getPageStaleCount(page) !== 1 ? "s" : ""} need{getPageStaleCount(page) === 1 ? "s" : ""} re-verification
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => markPageStale(page)}
                        disabled={markingStale.has(page.id)}
                        style={{
                          ...BTN_BASE,
                          background: "transparent",
                          border: `1px solid transparent`,
                          color: T.text.disabled,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          marginLeft: "auto",
                          opacity: markingStale.has(page.id) ? 0.5 : 1,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = T.amber.border;
                          e.currentTarget.style.color = T.amber.fg;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "transparent";
                          e.currentTarget.style.color = T.text.disabled;
                        }}
                      >
                        {markingStale.has(page.id) ? "Marking..." : "Mark page stale"}
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: T.accent, fontWeight: 600, fontFamily: FONT.mono, textDecoration: "none" }}
                    >
                      {page.url} &rarr;
                    </a>
                    <span style={{ fontSize: 11, color: T.text.disabled }}>
                      {page.who}
                    </span>
                  </div>

                  {/* Checks */}
                  <div style={{ display: "grid", gap: 0 }}>
                    {page.checks.map((check, i) => {
                      const checkResults = getCheckResults(page.id, i);
                      const myResult = getMyResult(page.id, i);
                      const key = `${page.id}-${i}`;
                      const isSubmitting = submitting.has(key);
                      const passes = checkResults.filter(r => r.status === "pass");
                      const fails = checkResults.filter(r => r.status === "fail");
                      const skips = checkResults.filter(r => r.status === "skip");
                      const resultsWithNotes = checkResults.filter(r => r.note?.trim());
                      const showNoteInput = myResult && (noteVisible.has(key) || myResult.status === "fail" || myResult.status === "skip" || noteExpanded.has(key));
                      const badgeKey = `${page.id}-${i}`;
                      const showAllBadges = badgeExpanded.has(badgeKey);
                      const visibleBadges = showAllBadges ? checkResults : checkResults.slice(0, 2);
                      const hiddenCount = checkResults.length - 2;

                      return (
                        <div key={i} style={{
                          padding: "12px 0",
                          borderBottom: i < page.checks.length - 1 ? `1px solid ${T.border.DEFAULT}` : "none",
                        }}>
                          {/* Check text */}
                          <div style={{ fontSize: 13, color: T.text.secondary, lineHeight: 1.55, marginBottom: isCheckStale(page.id, i) || getVerifiedInfo(page.id, i) ? 2 : 8 }}>
                            <span style={{ color: T.text.disabled, fontFamily: FONT.mono, fontSize: 11, marginRight: 8 }}>
                              {i + 1}.
                            </span>
                            {check}
                            {isCheckStale(page.id, i) && (
                              <span style={{
                                display: "inline-block", marginLeft: 8,
                                padding: "1px 7px", borderRadius: 999,
                                fontSize: 10, fontWeight: 700,
                                background: T.amber.bg, border: `1px solid ${T.amber.border}`,
                                color: T.amber.fg, verticalAlign: "middle",
                              }}>
                                Needs re-check
                              </span>
                            )}
                          </div>
                          {/* Staleness sub-line */}
                          {isCheckStale(page.id, i) && (
                            <div style={{ fontSize: 11, color: T.text.muted, marginBottom: 8, paddingLeft: 28 }}>
                              Page updated since last verified
                            </div>
                          )}
                          {!isCheckStale(page.id, i) && getVerifiedInfo(page.id, i) && (
                            <div style={{ fontSize: 11, color: T.text.muted, marginBottom: 8, paddingLeft: 28 }}>
                              Verified by {getVerifiedInfo(page.id, i)!.by} {timeAgo(getVerifiedInfo(page.id, i)!.at)}
                            </div>
                          )}

                          {/* Buttons — never disabled, intercept when no name */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {(["pass", "fail", "skip"] as const).map(s => {
                              const isActive = myResult?.status === s;
                              const colors = s === "pass" ? T.pass : s === "fail" ? T.fail : T.skip;
                              const label = s === "pass" ? "Pass" : s === "fail" ? "Fail" : "Skip";
                              return (
                                <button
                                  key={s}
                                  onClick={() => submitCheck(page.id, i, s)}
                                  disabled={isSubmitting}
                                  style={{
                                    ...BTN_BASE,
                                    background: isActive ? colors.bg : "transparent",
                                    border: `1px solid ${isActive ? colors.border : T.border.DEFAULT}`,
                                    color: isActive ? colors.fg : T.text.disabled,
                                    opacity: isSubmitting ? 0.5 : 1,
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}

                            {/* Clear button — only visible when tester has a result */}
                            {myResult && (
                              <button
                                onClick={() => clearCheck(page.id, i)}
                                disabled={isSubmitting}
                                style={{
                                  ...BTN_BASE,
                                  background: "transparent",
                                  border: `1px solid transparent`,
                                  color: T.text.disabled,
                                  opacity: isSubmitting ? 0.5 : 0.6,
                                  fontWeight: 500,
                                }}
                              >
                                Clear
                              </button>
                            )}

                            {/* Aggregate counts */}
                            {checkResults.length > 0 && (
                              <span style={{ fontSize: 11, color: T.text.disabled, marginLeft: 8 }}>
                                {passes.length > 0 && <span style={{ color: T.pass.fg }}>{passes.length} passed</span>}
                                {passes.length > 0 && (fails.length > 0 || skips.length > 0) && " \u00B7 "}
                                {fails.length > 0 && <span style={{ color: T.fail.fg }}>{fails.length} failed</span>}
                                {fails.length > 0 && skips.length > 0 && " \u00B7 "}
                                {skips.length > 0 && <span style={{ color: T.skip.fg }}>{skips.length} skipped</span>}
                              </span>
                            )}

                            {/* "Add a note" toggle for pass results */}
                            {myResult?.status === "pass" && !noteExpanded.has(key) && (
                              <button
                                className="qa-note-toggle"
                                onClick={() => setNoteExpanded(prev => new Set(prev).add(key))}
                                style={{ marginLeft: 4 }}
                              >
                                + Add a note
                              </button>
                            )}
                          </div>

                          {/* Name prompt inline — shown on the specific check that was clicked */}
                          {namePromptKey === key && (
                            <div style={{ marginTop: 6, fontSize: 12, color: T.accent, fontWeight: 600 }}>
                              \u2191 Enter your name above first
                            </div>
                          )}

                          {/* Note input — visible for fail/skip always, optional for pass */}
                          {showNoteInput && (
                            <div style={{ marginTop: 8 }}>
                              <input
                                type="text"
                                placeholder={myResult.status === "fail" ? "What went wrong?" : myResult.status === "skip" ? "Why did you skip this?" : "Any suggestions or observations..."}
                                value={noteInputs[key] ?? myResult.note ?? ""}
                                onChange={e => setNoteInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                onBlur={() => saveNoteOnBlur(page.id, i, myResult)}
                                onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                                style={{
                                  width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 12,
                                  background: T.bg.surface,
                                  border: `1px solid ${myResult.status === "fail" ? T.fail.border : myResult.status === "skip" ? T.skip.border : T.border.emphasis}`,
                                  color: T.text.primary, outline: "none", fontFamily: FONT.body,
                                }}
                              />
                            </div>
                          )}

                          {/* Tester badges — collapse at 3+ */}
                          {checkResults.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, alignItems: "center" }}>
                              {visibleBadges.map(r => {
                                const colors = r.status === "pass" ? T.pass : r.status === "fail" ? T.fail : T.skip;
                                return (
                                  <span
                                    key={r.id}
                                    style={{
                                      display: "inline-flex", alignItems: "center", gap: 4,
                                      padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                                      background: colors.bg, border: `1px solid ${colors.border}`,
                                      color: colors.fg,
                                    }}
                                  >
                                    {r.tester_name}
                                    {r.status === "pass" && " \u2713"}
                                    {r.status === "fail" && " \u2717"}
                                    {r.status === "skip" && " \u2014"}
                                  </span>
                                );
                              })}
                              {hiddenCount > 0 && !showAllBadges && (
                                <button
                                  onClick={() => setBadgeExpanded(prev => new Set(prev).add(badgeKey))}
                                  style={{
                                    padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                                    background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border.DEFAULT}`,
                                    color: T.text.muted, cursor: "pointer",
                                    fontFamily: FONT.body,
                                  }}
                                >
                                  +{hiddenCount} more
                                </button>
                              )}
                            </div>
                          )}

                          {/* Notes from all testers — always visible */}
                          {resultsWithNotes.length > 0 && (
                            <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                              {resultsWithNotes.map(r => {
                                const colors = r.status === "pass" ? T.pass : r.status === "fail" ? T.fail : T.skip;
                                return (
                                  <div key={`note-${r.id}`} style={{
                                    display: "flex", alignItems: "baseline", gap: 6,
                                    padding: "4px 8px", borderRadius: 6,
                                    background: colors.bg, border: `1px solid ${colors.border}`,
                                  }}>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, color: colors.fg,
                                      flexShrink: 0,
                                    }}>
                                      {r.tester_name}:
                                    </span>
                                    <span style={{ fontSize: 11, color: T.text.secondary, lineHeight: 1.4 }}>
                                      {r.note}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: T.text.disabled }}>
          {PAGES.length} pages &middot; {totalChecks} checks &middot; Share this page with anyone who wants to help test
        </div>
      </main>
    </div>
  );
}
