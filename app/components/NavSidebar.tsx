"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  dim?: boolean;
  note?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export function NavSidebar({
  practiceId,
  practiceName,
  therapistId,
  weekStart,
  adminOnly = false,
  mode = "full",
  therapists,
  hideGroups = [],
}: {
  practiceId: string | null;
  practiceName: string | null;
  therapistId: string | null;
  weekStart: string;
  adminOnly?: boolean;
  mode?: "full" | "practice";
  therapists?: Array<{ id: string; name: string | null }>;
  hideGroups?: string[];
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const practiceOverviewItem = practiceId
    ? {
        label: "Practice overview",
        href: `/practices/${encodeURIComponent(practiceId)}/therapist-overview?week_start=${encodeURIComponent(weekStart)}`,
        note: practiceName ?? practiceId,
      }
    : { label: "Practice overview", href: "#", dim: true, note: "select a practice" };

  const careDashboardItem = therapistId
    ? {
        label: "Care dashboard",
        href: `/dashboard/therapists/${encodeURIComponent(therapistId)}/care?week_start=${encodeURIComponent(weekStart)}`,
        note: "current therapist",
      }
    : { label: "Care dashboard", href: "#", dim: true, note: "select a therapist" };

  const adminGroup: NavGroup = {
    label: "Admin",
    items: [
      { label: "Admin", href: "/admin" },
      { label: "Therapists", href: "/admin/therapists" },
      { label: "Patients", href: "/admin/patients" },
      { label: "Developer Tools", href: "/admin/dev" },
    ],
  };

  const allGroups: NavGroup[] = [
    {
      label: "Manager",
      items: [
        { label: "Dashboard", href: "/dashboard/manager" },
        { label: "Case queue", href: "/cases" },
      ],
    },
    {
      label: "Therapist",
      items: [careDashboardItem],
    },
    adminGroup,
  ];

  const therapistItems: NavItem[] = therapists && therapists.length > 0
    ? therapists.map(t => ({
        label: t.name ?? t.id,
        href: `/dashboard/therapists/${encodeURIComponent(t.id)}/care?week_start=${encodeURIComponent(weekStart)}`,
      }))
    : [careDashboardItem];

  const practiceGroups: NavGroup[] = [
    {
      label: "Practice",
      items: [
        practiceOverviewItem,
        { label: "Case queue", href: "/cases" },
      ],
    },
    {
      label: "Therapists",
      items: therapistItems,
    },
    adminGroup,
  ];

  const baseGroups = adminOnly
    ? allGroups.filter(g => g.label === "Admin")
    : mode === "practice"
      ? practiceGroups
      : allGroups;

  const groups = hideGroups.length
    ? baseGroups.filter(g => !hideGroups.includes(g.label))
    : baseGroups;

  const navContent = (
    <>
      {/* Brand */}
      <Link href="/" onClick={() => setMobileOpen(false)} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, marginBottom: 32 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, #4f6ef7, #7c5cfc)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>◎</div>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3, color: "#e2e8f0" }}>
          empathAI
        </span>
      </Link>

      <div style={{ display: "grid", gap: 20 }}>
        {groups.map((group) => (
          <div key={group.label}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, opacity: 0.4, textTransform: "uppercase", marginBottom: 6 }}>
              {group.label}
            </div>
            <div style={{ display: "grid", gap: 2 }}>
              {group.items.map((item) => {
                const isActive = item.href !== "#" && pathname === item.href.split("?")[0];
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: "block",
                      padding: "6px 8px",
                      borderRadius: 7,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: isActive ? 900 : 700,
                      color: isActive ? "#e2e8f0" : item.dim ? "#4b5563" : "#9ca3af",
                      background: isActive ? "#1a1e2a" : "transparent",
                      pointerEvents: item.dim ? "none" : "auto",
                      lineHeight: 1.3,
                    }}
                  >
                    {item.label}
                    {item.note && (
                      <span style={{ display: "block", fontSize: 10, opacity: 0.55, marginTop: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.note}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <style>{`
        .nav-sidebar {
          width: 200px;
          flex-shrink: 0;
          border-right: 1px solid #1a1e2a;
          padding: 28px 20px 28px 4px;
          position: sticky;
          top: 0;
          align-self: flex-start;
          max-height: 100vh;
          overflow-y: auto;
        }
        .nav-ham {
          display: none;
        }
        @media (max-width: 767px) {
          .nav-sidebar {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 230px;
            height: 100vh;
            z-index: 1000;
            background: #080c12;
            border-right: 1px solid #1a1e2a;
            padding: 24px 20px 24px 16px;
            overflow-y: auto;
          }
          .nav-sidebar--open {
            display: block;
          }
          .nav-ham {
            display: flex;
            align-items: center;
            justify-content: center;
            position: fixed;
            top: 14px;
            left: 14px;
            z-index: 1001;
            width: 36px;
            height: 36px;
            border-radius: 9px;
            background: #0d1018;
            border: 1px solid #1a1e2a;
            color: #e2e8f0;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
          }
          .nav-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 999;
          }
        }
      `}</style>

      {/* Mobile hamburger */}
      <button className="nav-ham" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
        {mobileOpen ? "✕" : "☰"}
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && <div className="nav-overlay" onClick={() => setMobileOpen(false)} />}

      <nav className={`nav-sidebar${mobileOpen ? " nav-sidebar--open" : ""}`}>
        {navContent}
      </nav>
    </>
  );
}
