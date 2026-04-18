"use client";

/**
 * NativeAdCard — ExoClick native ad styled like a video card.
 *
 * Renders inside video grids every N positions. Matches the dark theme
 * and card dimensions so it blends with ThumbnailCard/PosterCard.
 * Pro users see nothing.
 *
 * Fix 2026-04-07: Uses waitForAdProvider() so the push() fires only after
 * ExoClick's script has bootstrapped.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AD_ZONES } from "@/lib/ad-config";
import { insertExoClickZone } from "@/lib/ad-utils";

const ZONE_ID = AD_ZONES.exoclick.nativeGrid;

export function NativeAdCard({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const [isPro, setIsPro] = useState(false); // default show ads, hide if Pro detected

  useEffect(() => {
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  const insertAd = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    insertExoClickZone(container, ZONE_ID, insertedRef);
  }, []);

  useEffect(() => {
    if (isPro) return;
    insertAd();
  }, [isPro, insertAd]);

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

  if (isPro) return null;

  return (
    <div
      ref={containerRef}
      className={`native-ad-card ${className}`.trim()}
      aria-hidden="true"
    >
      <span className="native-ad-card__badge">Ad</span>
    </div>
  );
}
