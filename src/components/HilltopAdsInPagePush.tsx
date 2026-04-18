"use client";

/**
 * HilltopAdsInPagePush — non-blocking slide-in push notification ad.
 *
 * Zone 6969697. Loads the HilltopAds in-page push script once per page load.
 * The script renders its own floating UI (corner slide-in with dismiss);
 * we just drop the script tag. Doesn't conflict with banners or popunder
 * because it's a separate inventory format from HilltopAds.
 *
 * Skipped on /feed, /login, /signup, /pricing, /checkout, /preview, and
 * for Pro users.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { HILLTOPADS_SCRIPTS } from "@/lib/ad-config";

const SCRIPT_TAG_ID = "hilltopads-inpage-push";

export function HilltopAdsInPagePush() {
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
    if (document.getElementById(SCRIPT_TAG_ID)) return;

    const s = document.createElement("script");
    s.id = SCRIPT_TAG_ID;
    s.src = HILLTOPADS_SCRIPTS.inPagePush;
    s.async = true;
    s.referrerPolicy = "no-referrer-when-downgrade";
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);
  }, [pathname]);

  return null;
}
