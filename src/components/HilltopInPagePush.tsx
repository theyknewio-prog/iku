"use client";

/**
 * HilltopInPagePush — non-blocking notification-style ad (zone 6969697).
 * Surface #5 of the Playmak3r stack, mounted 2026-04-30 after 12-day
 * dormancy.
 *
 * Why this is NOT inside HilltopAdsBanner's srcdoc iframe pattern:
 * the IPP script paints its slider into the parent document (sliding
 * notification at the corner of the screen). Inside an iframe with
 * width:0 height:0, the slider would be trapped invisibly. So we
 * inject the script tag directly into the main document.
 *
 * The script itself uses `document.scripts[document.scripts.length-1]`
 * to anchor its insertion. Since this component runs in useEffect AFTER
 * other scripts have loaded, it grabs its own injected <script> as the
 * anchor — no race with other ads.
 *
 * Pro users + /feed are excluded.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { HILLTOPADS_SCRIPTS } from "@/lib/ad-config";

const SCRIPT_ID = "iku-hilltop-ipp";

export function HilltopInPagePush() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      pathname === "/feed" ||
      pathname.startsWith("/feed/") ||
      pathname.startsWith("/preview/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/checkout")
    )
      return;
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
      return;

    // Don't double-inject when navigating between /watch slugs (the script
    // is global, one instance per page session).
    if (document.getElementById(SCRIPT_ID)) return;

    // Settle 3s — same rationale as the sticky banner: don't fight LCP.
    const t = setTimeout(() => {
      try {
        const s = document.createElement("script");
        s.id = SCRIPT_ID;
        s.src = HILLTOPADS_SCRIPTS.inPagePush;
        s.async = true;
        s.referrerPolicy = "no-referrer-when-downgrade";
        // The vendor IIFE wraps `s.settings = (arg)||{};`. We pass an empty
        // settings object via a wrapper inline script that mimics their snippet.
        const wrapper = document.createElement("script");
        wrapper.id = SCRIPT_ID + "-wrap";
        wrapper.text =
          "(function(vfgj){var d=document,s=d.createElement('script'),l=d.scripts[d.scripts.length-1];s.settings=vfgj||{};s.src=" +
          JSON.stringify(HILLTOPADS_SCRIPTS.inPagePush) +
          ";s.async=true;s.referrerPolicy='no-referrer-when-downgrade';l.parentNode.insertBefore(s,l);})({})";
        document.body.appendChild(wrapper);
      } catch (e) {
        console.warn("[hilltop-ipp] inject failed:", e);
      }
    }, 3000);

    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
