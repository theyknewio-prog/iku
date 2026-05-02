"use client";

/**
 * CrakRevenueCamsWidget — JerkMate prerecorded cams widget. Bottom-right
 * floating preview that drives the AI Smartlink on click. Loads via a single
 * `<script defer>` tag — the widget injects its own DOM into the parent
 * document.
 *
 * Excludes /feed (Shorts already has its own ad logic), /pricing, /checkout,
 * /login, /signup, Pro users.
 *
 * Note: there is already a `StripcashVideoSlider` (StripChat-side cams) on
 * the layout. The CrakRevenue widget rotates JerkMate / Chaturbate / etc.
 * Both can coexist — they target different revenue paths (CrakRevenue's
 * smartlink vs Stripcash's revshare).
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCrakCreatives } from "@/lib/crakrevenue-creatives";
import { getCfCountry } from "@/lib/cf-country";

const SCRIPT_ID = "iku-crak-cams";
const EXCLUDED_PATHS = [
  "/feed",
  "/pricing",
  "/checkout",
  "/login",
  "/signup",
  "/preview",
  "/forgot-password",
  "/reset-password",
];

export function CrakRevenueCamsWidget() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
    )
      return;
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
      return;
    if (document.getElementById(SCRIPT_ID)) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      try {
        const country = await getCfCountry();
        if (cancelled) return;
        const creatives = getCrakCreatives(country);

        const s = document.createElement("script");
        s.id = SCRIPT_ID;
        s.src = creatives.camsWidget.scriptSrc;
        s.defer = true;
        document.body.appendChild(s);
      } catch (e) {
        console.warn("[crak-cams] inject failed:", e);
      }
    }, 6000);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pathname]);

  return null;
}
