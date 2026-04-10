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
 *
 * Ad refresh (2026-04-08): When `refresh` prop is true (default for banner
 * sizes), a 30-second interval calls AdProvider.push({ serve: {} }) to
 * request a fresh fill. The interval only fires while the zone is in
 * viewport (IntersectionObserver). This matches industry-standard banner
 * refresh rates and maximises fill RPM without wasting impressions on
 * off-screen slots.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { insertExoClickZone } from "@/lib/ad-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AdProvider?: any;
  }
}

const REFRESH_INTERVAL_MS = 30_000;

interface AdZoneProps {
  zoneId: string;
  size: "728x90" | "300x250" | "300x600" | "320x50" | "300x50" | "native";
  lazy?: boolean;
  className?: string;
  /**
   * Whether to auto-refresh every 30s when in viewport.
   * Defaults to true for banner sizes, false for native.
   */
  refresh?: boolean;
  /**
   * Optional mobile override. When the viewport is ≤767px, these replace
   * `zoneId` and `size`. ExoClick sells 300x50 (not 320x50) for mobile
   * sticky banners — it fits any ≥300px viewport with no clipping.
   */
  mobileZoneId?: string;
  mobileSize?: "300x50" | "300x250" | "native";
}

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  "728x90":  { width: 728, height: 90 },
  "300x250": { width: 300, height: 250 },
  "300x600": { width: 300, height: 600 },
  "320x50":  { width: 320, height: 50 },
  "300x50":  { width: 300, height: 50 },
  native:    { width: 0,   height: 250 }, // full-width, min-height
};

function defaultRefresh(size: AdZoneProps["size"]): boolean {
  return size !== "native";
}

export function AdZoneClient({
  zoneId: desktopZoneId,
  size: desktopSize,
  lazy = false,
  className = "",
  refresh,
  mobileZoneId,
  mobileSize,
}: AdZoneProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const insertedRef   = useRef(false);
  const inViewportRef = useRef(false);
  const refreshTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPro, setIsPro]       = useState(true); // default hidden until checked
  const [visible, setVisible]   = useState(!lazy);
  // Track whether we're mobile at mount time. Client-only so it's safe to
  // read window here. We don't listen for resize on purpose — ExoClick zones
  // don't handle mid-life re-targeting well.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(typeof window !== "undefined" && window.innerWidth <= 767);
  }, []);

  const zoneId = isMobile && mobileZoneId ? mobileZoneId : desktopZoneId;
  const size = isMobile && mobileSize ? mobileSize : desktopSize;

  const shouldRefresh = refresh !== undefined ? refresh : defaultRefresh(size);

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

  // Ad refresh — runs only when the zone is in the viewport.
  // A separate IntersectionObserver tracks viewport state so the interval
  // skips refreshes for off-screen banners (saves requests, avoids waste).
  useEffect(() => {
    if (isPro || !visible || !shouldRefresh) return;
    const el = containerRef.current;
    if (!el) return;

    const viewportObserver = new IntersectionObserver(
      (entries) => {
        inViewportRef.current = !!entries[0]?.isIntersecting;
      },
      { threshold: 0.1 }
    );
    viewportObserver.observe(el);

    refreshTimer.current = setInterval(() => {
      if (!inViewportRef.current) return;
      (window.AdProvider = window.AdProvider || []).push({ serve: {} });
    }, REFRESH_INTERVAL_MS);

    return () => {
      viewportObserver.disconnect();
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [isPro, visible, shouldRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
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
