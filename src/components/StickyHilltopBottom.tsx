"use client";

/**
 * StickyHilltopBottom — sticky 300x100 mobile banner pinned above the
 * bottom nav. Surface #6 of the Playmak3r stack (zone 6969733), mounted
 * 2026-04-30. Mobile-only — desktop uses the underplayer 728x90 slot.
 *
 * Z-stack:
 *   .v2-bottom-nav     — z=1000 (mobile nav, owns y=bottom→64px)
 *   this banner        — z=999  (sits above 64px, height 100px)
 *   page content       — z=auto (gets 164px bottom padding via CSS)
 *
 * Pro users + /feed are excluded by HilltopAdsBanner internally.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HilltopAdsBanner } from "./HilltopAdsBanner";

const DISMISS_KEY = "iku-sticky-hilltop-dismissed-at";
const DISMISS_HOURS = 12;

export function StickyHilltopBottom() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip on /feed (Shorts has its own ad logic), pricing/checkout/auth
    // (don't distract during conversion), and any /preview/* route.
    if (
      pathname === "/feed" ||
      pathname.startsWith("/feed/") ||
      pathname.startsWith("/preview/") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/checkout")
    ) {
      setVisible(false);
      return;
    }

    if (typeof document !== "undefined" && document.body?.dataset.pro === "1") {
      setVisible(false);
      return;
    }

    // Honor 12h dismissal
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (ts && Date.now() - ts < DISMISS_HOURS * 3600_000) return;
    } catch {
      /* localStorage may be blocked */
    }

    // Settle 2s so the page paints first; ad load doesn't fight LCP.
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="advertisement"
      className="sticky-hilltop-bottom"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        // .v2-bottom-nav is 64px tall (--mobile-nav-h). 56px iOS safe-area
        // adjusted by transform when keyboard is present, so sit above it.
        bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        zIndex: 999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(8, 6, 18, 0.92)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        padding: "6px 8px",
      }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss ad"
        style={{
          position: "absolute",
          top: 2,
          right: 4,
          width: 22,
          height: 22,
          border: "none",
          background: "rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)",
          borderRadius: "50%",
          cursor: "pointer",
          fontSize: 12,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        ✕
      </button>
      <HilltopAdsBanner format="banner300x100Mobile" />
    </div>
  );
}
