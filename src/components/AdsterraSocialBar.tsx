"use client";

/**
 * AdsterraSocialBar — Adsterra Social Bar (zone 28986140).
 *
 * Social Bar is Adsterra's highest-CPM mobile format. It renders as a
 * sticky icon cluster at the bottom of the screen, expands on tap. Works
 * in parallel with ExoClick — they don't conflict because Social Bar is
 * a self-contained script that doesn't use atOptions globals (unlike the
 * Banner/Native formats which DO require the iframe srcDoc wrapper).
 *
 * This was stubbed out on 2026-04-08 because the previous implementation
 * hardcoded a wrong URL (`www.topcreativeformat.com/<zone_id>/invoke.js`)
 * that 404'd silently. Adsterra script URLs actually use a hashed token
 * path per zone — you only get it from the publisher dashboard "Get Code"
 * modal.
 *
 * The real URL was grabbed via Playwright MCP on 2026-04-11 and is now
 * centralized in src/lib/ad-config.ts → ADSTERRA_SCRIPTS.socialBar. That's
 * the single source of truth; update this component only via that constant.
 *
 * Pro users and /feed route never see this.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADSTERRA_SCRIPTS } from "@/lib/ad-config";

const SCRIPT_TAG_ID = "adsterra-social-bar";

export function AdsterraSocialBar() {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  useEffect(() => {
    if (isFeed) return;
    if (document.body.dataset.pro === "1") return;
    if (document.getElementById(SCRIPT_TAG_ID)) return;

    const s = document.createElement("script");
    s.id = SCRIPT_TAG_ID;
    s.src = ADSTERRA_SCRIPTS.socialBar;
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);
  }, [isFeed]);

  return null;
}
