// app/auth/select-role/page.tsx
// Phase 2 placeholder — post-login role selector.
// In Phase 2 this will read app_metadata.role from the JWT after Supabase login
// and redirect accordingly. For now it simply redirects to the landing page
// where the Phase 1 sessionStorage role selector lives.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SelectRolePage() {
  const router = useRouter();

  useEffect(() => {
    // Phase 2: read JWT, auto-set role, redirect to dashboard.
    // Phase 1: redirect to landing page role selector.
    router.replace("/");
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c12",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        fontSize: 14,
        color: "rgba(255,255,255,0.3)",
        fontFamily: "'DM Sans', system-ui",
      }}>
        Redirecting...
      </div>
    </div>
  );
}
