"use client";

/**
 * StickyHilltopBottom — sticky mobile affiliate card pinned above the
 * bottom nav. Surface #6 of the Playmak3r stack (A3 affiliate swap 2026-05-01).
 * Mobile-only — desktop uses the sidebar slot.
 *
 * Z-stack:
 *   .v2-bottom-nav     — z=1000 (mobile nav, owns y=bottom→64px)
 *   this banner        — z=999  (sits above 64px, height ~80px)
 *   page content       — z=auto (gets 164px bottom padding via CSS)
 *
 * Pro users + /feed are excluded internally.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AffiliateCard from "./AffiliateCard";
import { getAffiliate } from "@/lib/affiliates";

const DISMISS_KEY = "iku-sticky-hilltop-dismissed-at";
const DISMISS_HOURS = 12;

export function StickyHilltopBottom() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mobile-only — desktop uses underplayer slot. Below 768px is the
    // standard mobile breakpoint everywhere else in the codebase.
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setVisible(false);
      return;
    }

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

    // Lazy: wait for first user interaction (scroll/click) OR 8s idle.
    // Loading another iframe immediately on mount tanked perception of
    // page speed — Sab said 7-min load on his phone (commit 2026-04-30).
    // Defer until we know the user is engaged.
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      setVisible(true);
    };
    const onScroll = () => window.scrollY > 100 && arm();
    const onClick = () => arm();
    const idle = setTimeout(arm, 8000);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("touchstart", onClick, { passive: true });

    return () => {
      clearTimeout(idle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onClick);
    };
  }, [pathname]);

  const aff = getAffiliate("candy-ai");

  if (!visible || !aff) return null;

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
      aria-label="Sponsored"
      className="sticky-hilltop-bottom"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        zIndex: 999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(8, 6, 18, 0.92)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        padding: "6px 8px",
        transition: "opacity 200ms",
      }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
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
          zIndex: 1,
        }}
      >
        ✕
      </button>
      <AffiliateCard
        slug={aff.slug}
        brand={aff.brand}
        tagline={aff.tagline}
        thumbnail={aff.thumbnail}
        rating={aff.rating}
        badge={aff.badge}
        variant="stacked"
      />
    </div>
  );
}
