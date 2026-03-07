// app/admin/layout.tsx
// Client-side role guard for /admin/* routes.
// Defense-in-depth fallback — primary guard is server-side middleware.
// This catches cases where the cookie hasn't been set yet (e.g. first visit).
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getRoleAsync, type Role } from "@/lib/roleContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getRoleAsync().then((role: Role) => {
      if (cancelled) return;

      console.log("[admin-layout] role=", role, "path=", pathname);

      // therapist, patient, or no role → redirect to home
      if (role !== "admin" && role !== "manager") {
        router.replace("/");
        return;
      }

      // manager trying to reach /admin/dev → redirect to /admin/status
      if (role === "manager" && pathname.startsWith("/admin/dev")) {
        router.replace("/admin/status");
        return;
      }

      setAllowed(true);
    });

    return () => { cancelled = true; };
  }, [pathname, router]);

  // Show nothing until role check completes to avoid flash of protected content
  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
