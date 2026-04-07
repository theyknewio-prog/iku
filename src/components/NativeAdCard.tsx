"use client";

/**
 * NativeAdCard — ExoClick native ad styled like a video card.
 *
 * Renders inside video grids every N positions. Matches the dark theme
 * and card dimensions so it blends with ThumbnailCard/PosterCard.
 * Pro users see nothing.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AD_ZONES } from "@/lib/ad-config";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AdProvider?: any[];
  }
}

const ZONE_ID = AD_ZONES.exoclick.nativeGrid;

export function NativeAdCard({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const [isPro, setIsPro] = useState(true); // default hidden until checked

  useEffect(() => {
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  const insertAd = useCallback(() => {
    const container = containerRef.current;
    if (!container || insertedRef.current) return;
    insertedRef.current = true;

    const ins = document.createElement("ins");
    ins.className = "eas6a97888e2";
    ins.dataset.zoneid = ZONE_ID;
    container.appendChild(ins);

    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
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
