"use client";

/**
 * StripcashVideoSlider — corner cam preview widget (Surface #4).
 * Loaded 2026-04-30 — snippet was queued in ad-config.ts since 2026-04-27.
 *
 * Lazy strategy:
 *   1. Wait for requestIdleCallback (or 4s timeout fallback)
 *   2. Skip if Pro
 *   3. Inject <script src=lib.js> with a global hook that, when the
 *      lib loads, instantiates StripchatSpot and mounts to OUR ref
 *      (NOT document.body — caused hydration mismatch in tests)
 *   4. On unmount (route change), remove the script + DOM node
 *
 * CSP: creative.mavrtracktor.com is added to script-src + connect-src
 * in middleware.ts in the same commit.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { STRIPCASH } from "@/lib/ad-config";

declare global {
  interface Window {
    StripchatSpot?: new (config: { userId: string }) => {
      mount: (el: HTMLElement) => void;
    };
  }
}

export function StripcashVideoSlider() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // /watch only — keeps surfaces non-overlapping (per ad-config.ts comment).
    if (!pathname.startsWith("/watch/")) return;
    if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
      return;

    let scriptEl: HTMLScriptElement | null = null;
    let instanceMounted = false;

    const start = () => {
      if (loaded || instanceMounted) return;

      const mountWidget = () => {
        if (!ref.current || !window.StripchatSpot || instanceMounted) return;
        try {
          const spot = new window.StripchatSpot({
            userId: STRIPCASH.videoSliderUserId,
          });
          spot.mount(ref.current);
          instanceMounted = true;
          setLoaded(true);
        } catch (e) {
          console.warn("[stripcash] mount failed:", e);
        }
      };

      if (window.StripchatSpot) {
        mountWidget();
        return;
      }

      scriptEl = document.createElement("script");
      scriptEl.src = STRIPCASH.videoSliderLibUrl;
      scriptEl.async = true;
      scriptEl.id = "iku-stripcash-spot";
      scriptEl.onload = mountWidget;
      scriptEl.onerror = () => console.warn("[stripcash] script load failed");
      document.body.appendChild(scriptEl);
    };

    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: object) => number;
      }
    ).requestIdleCallback;
    let idleId = 0;
    const fallback = setTimeout(start, 4000);
    if (typeof ric === "function") {
      idleId = ric(start, { timeout: 4000 });
    }

    return () => {
      clearTimeout(fallback);
      const cic = (
        window as unknown as { cancelIdleCallback?: (id: number) => void }
      ).cancelIdleCallback;
      if (idleId && typeof cic === "function") cic(idleId);
      // Cleanup on route change
      if (scriptEl && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
      if (ref.current) ref.current.innerHTML = "";
      // Force re-init on next /watch mount
      try {
        delete window.StripchatSpot;
      } catch {
        /* may be non-configurable */
      }
    };
  }, [pathname, loaded]);

  // Don't render the host node off /watch — the lib appends to whatever
  // ref it gets, no point keeping an empty div on the homepage.
  if (!pathname.startsWith("/watch/")) return null;

  return (
    <div
      ref={ref}
      data-stripcash-slider=""
      aria-hidden="true"
      style={{ position: "fixed", zIndex: 998, pointerEvents: "auto" }}
    />
  );
}
