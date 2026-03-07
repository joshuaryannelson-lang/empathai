"use client";

import React from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  {
    id: "admin",
    label: "Admin",
    descriptor: "Full system access",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    onClick: () => {
      document.cookie = "empathAI_role=admin; path=/; max-age=3600";
      try { sessionStorage.setItem("empathAI_selected_role", "admin"); } catch {}
      try { localStorage.setItem("selected_persona", "admin"); } catch {}
    },
    route: "/admin",
  },
  {
    id: "practice_owner_multi",
    label: "Practice Owner (Multiple)",
    descriptor: "Manage multiple practices",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="9" rx="1" />
        <rect x="8" y="14" width="8" height="7" rx="1" />
      </svg>
    ),
    onClick: () => {
      try { localStorage.setItem("selected_persona", "manager"); } catch {}
      try { localStorage.setItem("selected_manager_mode", "multi"); } catch {}
    },
    route: "/dashboard/manager",
  },
  {
    id: "practice_owner_single",
    label: "Practice Owner (Single)",
    descriptor: "Manage your practice",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    onClick: () => {
      try { localStorage.setItem("selected_persona", "manager"); } catch {}
      try { localStorage.setItem("selected_manager_mode", "single"); } catch {}
      try { localStorage.setItem("selected_practice_id", "demo-practice-01"); } catch {}
    },
    route: "/dashboard/manager",
  },
  {
    id: "therapist",
    label: "Therapist",
    descriptor: "Cases, sessions & clinical tools",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
        <circle cx="20" cy="10" r="2" />
      </svg>
    ),
    onClick: () => {
      try { localStorage.setItem("selected_persona", "therapist"); } catch {}
      try { localStorage.setItem("selected_therapist_id", "demo-therapist-01"); } catch {}
    },
    route: "/dashboard/therapists/demo-therapist-01/care",
  },
  {
    id: "patient",
    label: "Patient",
    descriptor: "Your care portal",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    onClick: () => {
      try { localStorage.setItem("selected_persona", "patient"); } catch {}
    },
    route: "/portal/onboarding?code=TEST-0000",
  },
];

export default function LoginPage() {
  const router = useRouter();

  function handleCardClick(role: typeof ROLES[number]) {
    role.onClick();
    router.push(role.route);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .login-card {
          background: #0d1018;
          border: 1px solid #1a2035;
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: all 200ms ease;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .login-card:hover {
          box-shadow: 0 0 0 2px #6b82d4, 0 4px 32px rgba(107,130,212,0.25);
        }
        .login-card:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px #6b82d4, 0 4px 32px rgba(107,130,212,0.25);
        }
        .login-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          max-width: 720px;
          width: 100%;
        }
        .login-grid-bottom {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          max-width: 480px;
          width: 100%;
        }
        @media (max-width: 640px) {
          .login-grid,
          .login-grid-bottom {
            grid-template-columns: 1fr !important;
            max-width: 360px;
          }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#080c12",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          fontFamily: "'DM Sans', system-ui",
        }}
      >
        {/* Wordmark */}
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: -0.5,
            marginBottom: 8,
            background: "linear-gradient(135deg, #6b82d4 0%, #94a3b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontFamily: "'DM Sans', system-ui",
          }}
        >
          EmpathAI
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 14,
            color: "#94a3b8",
            marginBottom: 48,
          }}
        >
          Therapy practice management
        </p>

        {/* Top row: 3 cards */}
        <div className="login-grid">
          {ROLES.slice(0, 3).map((role) => (
            <div
              key={role.id}
              className="login-card"
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(role)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(role);
                }
              }}
            >
              <div style={{ color: "#6b82d4" }}>{role.icon}</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "#f1f5f9",
                }}
              >
                {role.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#94a3b8",
                }}
              >
                {role.descriptor}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row: 2 cards centered */}
        <div className="login-grid-bottom" style={{ marginTop: 16 }}>
          {ROLES.slice(3).map((role) => (
            <div
              key={role.id}
              className="login-card"
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(role)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(role);
                }
              }}
            >
              <div style={{ color: "#6b82d4" }}>{role.icon}</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "#f1f5f9",
                }}
              >
                {role.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#94a3b8",
                }}
              >
                {role.descriptor}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: 48,
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          EmpathAI is a secure, PHI-compliant platform
        </p>
      </div>
    </>
  );
}
