"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { clearDemoStorage } from "@/lib/demo";

/**
 * Clears demo localStorage keys whenever the user navigates away from
 * demo context (no ?demo=true param and not on /demo route).
 * Mount once in the root layout.
 */
export default function DemoStorageGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const isDemo =
      searchParams.get("demo") === "true" ||
      pathname === "/demo" ||
      pathname.startsWith("/demo/");

    if (!isDemo) {
      clearDemoStorage();
    }
  }, [pathname, searchParams]);

  return null;
}
