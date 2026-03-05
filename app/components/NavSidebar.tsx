"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav
      style={{
        width: 200,
        flexShrink: 0,
        borderRight: "1px solid #1a1e2a",
        paddingRight: 20,
        paddingTop: 28,
        paddingLeft: 4,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        maxHeight: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, marginBottom: 32 }}>
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
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1,
                opacity: 0.4,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {group.label}
            </div>
            <div style={{ display: "grid", gap: 2 }}>
              {group.items.map((item) => {
                const isActive =
                  item.href !== "#" && pathname === item.href.split("?")[0];
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
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
                      <span
                        style={{
                          display: "block",
                          fontSize: 10,
                          opacity: 0.55,
                          marginTop: 1,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
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
    </nav>
  );
}
