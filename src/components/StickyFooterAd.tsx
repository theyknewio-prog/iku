"use client";

/**
 * StickyFooterAd — 320x50 banner fixed at the bottom of the screen on mobile.
 *
 * Visible only on viewports narrower than 768px. Sits above the mobile
 * bottom nav bar (which is ~60px tall) so it does not cover navigation.
 * A close button lets users dismiss it; dismissal is persisted for the
 * session via sessionStorage so the banner does not reappear on navigation.
 *
 * Uses the ExoClick underplayer728 zone — ExoClick auto-serves the best
 * ad format for the slot width (320x50 on mobile).
 *
 * Industry context: xHamster and Pornhub both run a sticky 320x50 mobile
 * footer banner. It is the highest-RPM mobile placement after the pre-roll.
 * Positioned at bottom: 64px to clear the 60px bottom nav + 4px gap.
 *
 * Pro users never see this.
 */

import { useEffect, useRef, useState } from "react";
import { AD_ZONES } from "@/lib/ad-config";
import { insertExoClickZone } from "@/lib/ad-utils";

// Use the 300x50 mobile banner zone, NOT watchUnderplayer728 (728x90).
// Previous version loaded a 728-wide creative into a ~160-wide container →
// ExoClick rendered the full 728x90 creative and the nested iframe clipped
// to the narrow parent so users saw only a ~160px top-left slice of the
// creative (Sab screenshot 2026-04-11: "your Porn squad of..." zoomed corner).
// 300x50 is the format ExoClick actually sells for this slot size.
const ZONE_ID =
  AD_ZONES.exoclick.mobileBanner300x50 ?? AD_ZONES.exoclick.watchUnderplayer728;
const STORAGE_KEY = "iku_sticky_footer_dismissed";

export function StickyFooterAd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Do not show for Pro users
    if (document.body.dataset.pro === "1") return;
    // Do not show if dismissed this session
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    setVisible(true);
  }, []);

  // Insert the ad zone once the banner becomes visible
  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    if (!container) return;
    insertExoClickZone(container, ZONE_ID, insertedRef);
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const container = containerRef.current;
      if (container) {
        const ins = container.querySelector("ins");
        if (ins) ins.remove();
      }
      insertedRef.current = false;
    };
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="sticky-footer-ad" aria-label="Advertisement">
      <div ref={containerRef} className="sticky-footer-ad__zone" />
      <button
        className="sticky-footer-ad__close"
        onClick={dismiss}
        aria-label="Close advertisement"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
