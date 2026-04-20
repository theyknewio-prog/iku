"use client";

/**
 * HilltopAdsInPagePush — non-blocking slide-in push notification ad.
 *
 * Zone 6969697. Loads the HilltopAds in-page push script once per page load.
 * The script renders its own floating UI (corner slide-in with dismiss);
 * we just drop the script tag.
 *
 * Skipped on /feed, /login, /signup, /pricing, /checkout, /preview, for
 * Pro users, AND on iOS (Sab feedback 2026-04-20: in-page push notifs
 * mimic Chrome system notifications which don't exist on iOS Safari/Chrome,
 * so they look fake and sketchy on Apple devices — kills trust). Android
 * + desktop still get the format.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { HILLTOPADS_SCRIPTS } from "@/lib/ad-config";

const SCRIPT_TAG_ID = "hilltopads-inpage-push";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad on iOS 13+ reports Mac UA with touch — covered by maxTouchPoints
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && navigator.maxTouchPoints > 1)
  );
}

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
    if (isIOS()) return;
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
