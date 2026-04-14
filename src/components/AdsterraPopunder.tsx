"use client";

/**
 * AdsterraPopunder — loads Adsterra's popunder script once per session.
 *
 * Replaces the disabled ExoClick popunder (which hijacked Next.js router
 * clicks). Adsterra's implementation waits for an actual user click before
 * triggering, so it plays nicely with SPA navigation.
 *
 * Loads on every route except /feed, /login, /signup, /pricing. Pro users
 * skip entirely. Loaded once per session via sessionStorage guard to keep
 * frequency cap at roughly 1 pop per visit.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADSTERRA_SCRIPTS } from "@/lib/ad-config";

const SCRIPT_ID = "adsterra-popunder";
const SESSION_KEY = "iku-pop-loaded";

export function AdsterraPopunder() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (
      pathname.startsWith("/feed") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/checkout") ||
      pathname.startsWith("/preview")
    ) return;

    if (document.body?.dataset.pro === "1") return;
    if (document.getElementById(SCRIPT_ID)) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch { /* quota */ }

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = ADSTERRA_SCRIPTS.popunder;
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);
  }, [pathname]);

  return null;
}
