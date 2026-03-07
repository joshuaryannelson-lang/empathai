"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PortalIdentityContext } from "./layout";

export default function PortalIndex() {
  const { session } = useContext(PortalIdentityContext);
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.replace("/portal/welcome");
    } else {
      router.replace("/portal/onboarding");
    }
  }, [session, router]);

  return null;
}
