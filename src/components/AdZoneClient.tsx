"use client";

/**
 * AdZoneClient — ExoClick ad zone renderer.
 *
 * Renders a container with exact dimensions (zero CLS), then imperatively
 * inserts an <ins> tag that ExoClick's ad-provider.js mutates. Uses
 * IntersectionObserver for lazy loading below-fold ads.
 *
 * Pro users: renders nothing (checked via data-pro on <body>).
 */

import { useEffect, useRef, useState, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AdProvider?: any[];
  }
}

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

export function AdZoneClient({
  zoneId,
  size,
  lazy = false,
  className = "",
}: AdZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const [isPro, setIsPro] = useState(true); // default hidden until checked
  const [visible, setVisible] = useState(!lazy);
  const [noFill, setNoFill] = useState(false);

  useEffect(() => {
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  // IntersectionObserver for lazy ads
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
      { rootMargin: "200px" }, // start loading 200px before viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, visible, isPro]);

  const insertAd = useCallback(() => {
    const container = containerRef.current;
    if (!container || insertedRef.current) return;
    insertedRef.current = true;

    // Create the <ins> element ExoClick expects
    const ins = document.createElement("ins");
    ins.className = "eas6a97888e2";
    ins.dataset.zoneid = zoneId;
    container.appendChild(ins);

    // Trigger ExoClick to fill the zone
    (window.AdProvider = window.AdProvider || []).push({ serve: {} });

    // No-fill collapse: if nothing painted after 3.5s, hide the reserved
    // box so it doesn't leave an empty gap (audit 2026-07-08 flagged blank
    // 320x50 / 300x250 / tablet gaps). Check the CONTAINER's rendered
    // children (iframe/img/ins-with-content), not just <ins> presence —
    // ExoClick leaves an empty <ins> on no-fill (feedback_exoclick_fill_patterns).
    setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const painted = el.querySelector("iframe, img, ins > *");
      if (!painted) setNoFill(true);
    }, 3500);
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
        // Remove the <ins> element ExoClick added
        const ins = container.querySelector("ins");
        if (ins) ins.remove();
      }
      insertedRef.current = false;
    };
  }, []);

  if (isPro || noFill) return null;

  const dims = SIZE_MAP[size] || SIZE_MAP["300x250"];
  const sizeClass = `ad-zone--${size}`;

  return (
    <div
      ref={containerRef}
      className={`ad-zone ${sizeClass} ${className}`.trim()}
      data-ad-zone={zoneId}
      aria-hidden="true"
      style={
        size === "native"
          ? { width: "100%", minHeight: dims.height }
          : undefined
      }
    />
  );
}
