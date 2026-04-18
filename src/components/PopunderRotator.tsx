"use client";

/**
 * PopunderRotator — picks Adsterra OR HilltopAds 50/50 per session.
 *
 * Never stacks two popunders (ad-network policy + memory rule). One pick
 * per sessionStorage key, sticks for the whole visit.
 *
 * - Adsterra: drops their one-liner script tag (listener wired inside).
 * - HilltopAds: registers a one-time click listener that window.open()s
 *   their DirectLink popunder URL, then self-removes.
 *
 * Skipped on /feed, /login, /signup, /pricing, /checkout, /preview and
 * for Pro users.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADSTERRA_SCRIPTS, HILLTOPADS_SCRIPTS } from "@/lib/ad-config";

const SCRIPT_ID = "popunder-script";
const SESSION_KEY = "iku-pop-loaded";
const SESSION_PROVIDER_KEY = "iku-pop-provider";

type Provider = "adsterra" | "hilltopads";

function pickProvider(): Provider {
  try {
    const existing = sessionStorage.getItem(SESSION_PROVIDER_KEY);
    if (existing === "adsterra" || existing === "hilltopads") return existing;
    const pick: Provider = Math.random() < 0.5 ? "adsterra" : "hilltopads";
    sessionStorage.setItem(SESSION_PROVIDER_KEY, pick);
    return pick;
  } catch {
    return Math.random() < 0.5 ? "adsterra" : "hilltopads";
  }
}

export function PopunderRotator() {
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
    )
      return;

    if (document.body?.dataset.pro === "1") return;
    if (document.getElementById(SCRIPT_ID)) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* quota */
    }

    const provider = pickProvider();

    if (provider === "adsterra") {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = ADSTERRA_SCRIPTS.popunder;
      s.async = true;
      s.setAttribute("data-cfasync", "false");
      document.body.appendChild(s);
      return;
    }

    // HilltopAds DirectLink popunder — open on first user click.
    let fired = false;
    const handler = () => {
      if (fired) return;
      fired = true;
      try {
        const w = window.open(
          HILLTOPADS_SCRIPTS.popunderUrl,
          "_blank",
          "noopener,noreferrer",
        );
        if (w && typeof w.blur === "function") w.blur();
        window.focus();
      } catch {
        /* blocked */
      }
      document.removeEventListener("click", handler, true);
      document.removeEventListener("touchend", handler, true);
    };
    document.addEventListener("click", handler, true);
    document.addEventListener("touchend", handler, true);

    // Mark DOM so the session-guard check catches repeat mounts.
    const marker = document.createElement("span");
    marker.id = SCRIPT_ID;
    marker.hidden = true;
    document.body.appendChild(marker);
  }, [pathname]);

  return null;
}
