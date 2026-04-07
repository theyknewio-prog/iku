"use client";

/**
 * AdZoneClient — ExoClick ad zone renderer.
 *
 * Renders a container with exact dimensions (zero CLS), then imperatively
 * inserts an <ins> tag that ExoClick's ad-provider.js mutates. Uses
 * IntersectionObserver for lazy loading below-fold ads.
 *
 * Pro users: renders nothing (checked via data-pro on <body>).
 *
 * Fix 2026-04-07: Uses waitForAdProvider() so the push() only fires after
 * ExoClick's script has bootstrapped, eliminating the race where the zone
 * push happened before ad-provider.js finished loading.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { insertExoClickZone } from "@/lib/ad-utils";

interface AdZoneProps {
  zoneId: string;
  size: "728x90" | "300x250" | "320x50" | "native";
  lazy?: boolean;
  className?: string;
}

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  "728x90": { width: 728, height: 90 },
  "300x250": { width: 300, height: 250 },
  "320x50": { width: 320, height: 50 },
  native: { width: 0, height: 250 }, // full-width, min-height
};

export function AdZoneClient({ zoneId, size, lazy = false, className = "" }: AdZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const [isPro, setIsPro] = useState(true); // default hidden until checked
  const [visible, setVisible] = useState(!lazy);

  useEffect(() => {
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  // IntersectionObserver for lazy ads.
  // Guard: skip entirely until isPro is resolved (avoids creating observer
  // for Pro users who will never need it).
  useEffect(() => {
    if (!lazy || visible || isPro) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, visible, isPro]);

  const insertAd = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    insertExoClickZone(container, zoneId, insertedRef);
  }, [zoneId]);

  // Insert ad when visible and not Pro
  useEffect(() => {
    if (isPro || !visible) return;
    insertAd();
  }, [isPro, visible, insertAd]);

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

  const dims = SIZE_MAP[size] || SIZE_MAP["300x250"];
  const sizeClass = `ad-zone--${size}`;

  return (
    <div
      ref={containerRef}
      className={`ad-zone ${sizeClass} ${className}`.trim()}
      data-ad-zone={zoneId}
      aria-hidden="true"
      style={size === "native" ? { width: "100%", minHeight: dims.height } : undefined}
    />
  );
}
