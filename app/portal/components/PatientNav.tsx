"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/portal/checkin", label: "Check-in", icon: "\uD83D\uDCAC" },
  { href: "/portal/history", label: "History", icon: "\uD83D\uDCC8" },
  { href: "/portal/goals", label: "Goals", icon: "\uD83C\uDFAF" },
];

const ACCENT = "#38bdf8";
const ACCENT_RGB = "56,189,248";

export default function PatientNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: "flex",
      gap: 4,
      padding: "4px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      {NAV_ITEMS.map(item => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? ACCENT : "rgba(255,255,255,0.45)",
              background: isActive ? `rgba(${ACCENT_RGB},0.1)` : "transparent",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
              fontFamily: "'DM Sans', system-ui",
            }}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
