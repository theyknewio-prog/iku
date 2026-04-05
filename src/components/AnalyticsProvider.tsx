"use client";

/**
 * AnalyticsProvider — initializes PostHog on mount and identifies the
 * logged-in user when session is available.
 *
 * Mounted inside SessionProviderClient in the root layout so useSession
 * works.
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { identify, reset, track, EVENTS } from "@/lib/analytics";

export function AnalyticsProvider() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user?.id) {
      identify(session.user.id, {
        username: session.user.username,
        email: session.user.email,
      });
    } else if (status === "unauthenticated") {
      reset();
    }
  }, [status, session?.user?.id, session?.user?.email, session?.user?.username]);

  // Track "app_loaded" once
  useEffect(() => {
    track("app_loaded", {
      url: typeof window !== "undefined" ? window.location.pathname : "",
    });
  }, []);

  return null;
}

// Re-export for convenience
export { track, EVENTS };
