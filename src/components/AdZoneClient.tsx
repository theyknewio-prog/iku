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
  /**
   * Skip mounting this zone for visitors in any of these 2-letter ISO
   * country codes. Uses `cf-ipcountry` via /api/geo. Fail-open: if the
   * geo lookup errors or times out, the ad mounts as usual. Default: no
   * country is blocked.
   *
   * Set for ExoClick zones that waste inventory on low-CPM geos (TR, RU
   * etc.). ExoClick publisher UI has no geo-exclusion so we gate at the
   * mount level instead. See memory feedback_geo_waterfall_2026_04_23.
   */
  blockCountries?: readonly string[];
}

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  "728x90": { width: 728, height: 90 },
  "300x250": { width: 300, height: 250 },
  "300x600": { width: 300, height: 600 },
  "320x50": { width: 320, height: 50 },
  "300x50": { width: 300, height: 50 },
  native: { width: 0, height: 250 },
};

function defaultRefresh(size: AdZoneProps["size"]): boolean {
  return size !== "native";
}

// Cache the geo lookup across all AdZoneClient instances in the same tab.
// /api/geo response is stable per-session (country doesn't change mid-browse),
// so we fetch once per page load max.
let geoPromise: Promise<string | null> | null = null;
function getGeo(): Promise<string | null> {
  if (geoPromise) return geoPromise;
  geoPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch("/api/geo", {
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(t);
      if (!r.ok) return null;
      const j = (await r.json()) as { country?: string | null };
      return typeof j.country === "string" ? j.country.toUpperCase() : null;
    } catch {
      // Fail-open: unknown country = treat as not blocked
      return null;
    }
  })();
  return geoPromise;
}

export function AdZoneClient({
  zoneId: desktopZoneId,
  size: desktopSize,
  lazy = false,
  className = "",
  refresh,
  mobileZoneId,
  mobileSize,
  blockCountries,
}: AdZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const inViewportRef = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isPro, setIsPro] = useState(false);
  // null = not yet resolved, false = mount allowed, true = skip mount.
  const [geoBlocked, setGeoBlocked] = useState<boolean | null>(
    blockCountries && blockCountries.length > 0 ? null : false,
  );

  // One mount-time check: detect mobile + Pro status from <body data-pro>.
  useEffect(() => {
    setIsMobile(window.innerWidth <= 767);
    setIsPro(document.body.dataset.pro === "1");
  }, []);

  // Geo check (only when blockCountries is set). Sets geoBlocked async.
  useEffect(() => {
    if (!blockCountries || blockCountries.length === 0) return;
    let cancelled = false;
    getGeo().then((country) => {
      if (cancelled) return;
      if (!country) {
        // Fail-open: no geo info → allow mount
        setGeoBlocked(false);
        return;
      }
      const upper = blockCountries.map((c) => c.toUpperCase());
      setGeoBlocked(upper.includes(country));
    });
    return () => {
      cancelled = true;
    };
  }, [blockCountries]);

  const zoneId = isMobile && mobileZoneId ? mobileZoneId : desktopZoneId;
  const size = isMobile && mobileSize ? mobileSize : desktopSize;
  const shouldRefresh = refresh !== undefined ? refresh : defaultRefresh(size);

  const insertAd = useCallback(() => {
    const container = containerRef.current;
    if (!container || isPro) return;
    const fb =
      size === "728x90" ||
      size === "300x250" ||
      size === "300x600" ||
      size === "320x50" ||
      size === "300x50"
        ? size
        : undefined;
    insertExoClickZone(container, zoneId, insertedRef, fb);
  }, [zoneId, isPro, size]);

  // Insert immediately if not lazy, otherwise wait for IntersectionObserver.
  // If geo lookup is still pending (geoBlocked === null) wait; if blocked,
  // never insert.
  useEffect(() => {
    if (isPro) return;
    if (geoBlocked === null) return;
    if (geoBlocked) return;
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
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPro, lazy, insertAd, geoBlocked]);

  // 30s refresh while in viewport.
  useEffect(() => {
    if (isPro || !shouldRefresh) return;
    const el = containerRef.current;
    if (!el) return;

    const viewportObserver = new IntersectionObserver(
      (entries) => {
        inViewportRef.current = !!entries[0]?.isIntersecting;
      },
      { threshold: 0.1 },
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
  // Render nothing for blocked geos — no empty slot, no ExoClick request.
  // We return null only after geo is resolved to avoid flashing an empty
  // container and then removing it. Null while geo is pending would suppress
  // the layout-preserving placeholder, so we keep the container div but
  // don't insert the ad.
  if (geoBlocked === true) return null;

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
