"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PortalIdentityContext } from "../layout";

/**
 * Redirects to /portal/profile-setup if the patient has not
 * completed their profile. No-op for demo sessions (no JWT).
 */
export function useProfileGate() {
  const router = useRouter();
  const { session } = useContext(PortalIdentityContext);

  useEffect(() => {
    if (!session?.token) return;
    fetch("/api/portal/profile", {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data && !data.has_completed_profile) {
          router.replace("/portal/profile-setup");
        }
      })
      .catch(() => {});
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
}
