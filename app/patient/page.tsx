"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy patient page — redirects to the new /portal routes */
export default function PatientRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/portal");
  }, [router]);
  return null;
}
