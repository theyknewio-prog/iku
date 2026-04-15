"use client";

/**
 * AdZoneClient — ExoClick ad zone renderer.
 *
 * Renders a fixed-size container, then injects ExoClick's <ins> tag once
 * on mount (or when the lazy IntersectionObserver fires). Pro users get
 * an empty container.
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
  refresh?: boolean;
  mobileZoneId?: string;
  mobileSize?: "300x50" | "300x250" | "native";
}

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  "728x90":  { width: 728, height: 90 },
  "300x250": { width: 300, height: 250 },
  "300x600": { width: 300, height: 600 },
  "320x50":  { width: 320, height: 50 },
  "300x50":  { width: 300, height: 50 },
  native:    { width: 0,   height: 250 },
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
  const [isMobile, setIsMobile] = useState(false);
  const [isPro, setIsPro] = useState(false);

  // One mount-time check: detect mobile + Pro status from <body data-pro>.
  useEffect(() => {
    setIsMobile(window.innerWidth <= 767);
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  const zoneId = isMobile && mobileZoneId ? mobileZoneId : desktopZoneId;
  const size = isMobile && mobileSize ? mobileSize : desktopSize;
  const shouldRefresh = refresh !== undefined ? refresh : defaultRefresh(size);

  const insertAd = useCallback(() => {
    const container = containerRef.current;
    if (!container || isPro) return;
    insertExoClickZone(container, zoneId, insertedRef);
  }, [zoneId, isPro]);

  // Insert immediately if not lazy, otherwise wait for IntersectionObserver.
  useEffect(() => {
    if (isPro) return;
    const el = containerRef.current;
    if (!el) return;

    if (!lazy) {
      insertAd();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          insertAd();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPro, lazy, insertAd]);

  // 30s refresh while in viewport.
  useEffect(() => {
    if (isPro || !shouldRefresh) return;
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
      if (!inViewportRef.current || !insertedRef.current) return;
      (window.AdProvider = window.AdProvider || []).push({ serve: {} });
    }, REFRESH_INTERVAL_MS);

    return () => {
      viewportObserver.disconnect();
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [isPro, shouldRefresh]);

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
