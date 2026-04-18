"use client";

/**
 * PrerollAd — Pre-roll ad overlay for the watch page.
 *
 * Shows a 15-second ExoClick ad zone before EVERY video plays.
 * Industry standard: Pornhub, xHamster, and all major tubes show pre-rolls
 * on every video load — not once per session. This is 5-10x more revenue.
 * - Skip button appears at 5 seconds
 * - Auto-skips after 15 seconds or if ad fails to load within 3 seconds
 * - Pro users are skipped entirely
 *
 * Fix 2026-04-07:
 * 1. Uses waitForAdProvider() — the push() now fires only after ExoClick's
 *    script has bootstrapped (eliminates the "ad-provider not ready" race).
 * 2. The overlay is rendered with a guaranteed min-height (300px) so that
 *    position:absolute inset:0 has a real bounding box to fill, even before
 *    the video's natural dimensions are known.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AD_ZONES } from "@/lib/ad-config";
import { waitForAdProvider } from "@/lib/ad-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PrerollAdProps {
  onComplete: () => void;
}

// Use the 300x250 banner zone as pre-roll — it has the best fill rate.
// The video pre-roll zone (type 18) requires VAST integration which ExoClick
// doesn't serve via simple <ins> tags. The 300x250 banner displays as a
// centered ad in the overlay, which is the standard approach for sites
// without VAST player integration.
const ZONE_ID = AD_ZONES.exoclick.sidebar300;
const TOTAL_SECONDS = 15;
const SKIP_AFTER = 5;
const LOAD_TIMEOUT = 5000; // auto-skip if ad doesn't load within 5s

export function PrerollAd({ onComplete }: PrerollAdProps) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [adLoaded, setAdLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setDismissed(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Pro users skip immediately
    if (document.body.dataset.pro === "1") {
      finish();
      return;
    }

    // Insert the <ins> element immediately so it's in the DOM.
    // The actual AdProvider.push() fires once the script is ready.
    const container = containerRef.current;
    if (container && !insertedRef.current) {
      insertedRef.current = true;
      const ins = document.createElement("ins");
      ins.className = "eas6a97888e2";
      ins.dataset.zoneid = ZONE_ID;
      container.appendChild(ins);

      waitForAdProvider(() => {
        (window.AdProvider = window.AdProvider || []).push({ serve: {} });
      });
    }

    // Start countdown
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          finish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Ad load timeout — if nothing renders in 3s, skip
    loadTimerRef.current = setTimeout(() => {
      const c = containerRef.current;
      if (c) {
        const hasContent =
          c.querySelector("iframe") ||
          c.querySelector("img") ||
          c.querySelector("video") ||
          c.querySelector("a");
        if (hasContent) {
          setAdLoaded(true);
        } else {
          finish();
        }
      }
    }, LOAD_TIMEOUT);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [finish]);

  // MutationObserver: detect when ExoClick injects content
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => {
      if (
        container.querySelector("iframe") ||
        container.querySelector("img") ||
        container.querySelector("video") ||
        container.querySelector("a")
      ) {
        setAdLoaded(true);
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (dismissed) return null;

  const canSkip = secondsLeft <= TOTAL_SECONDS - SKIP_AFTER;

  return (
    <div className="preroll-overlay" aria-label="Advertisement">
      {/* Ad container */}
      <div ref={containerRef} className="preroll-ad-container" />

      {/* Top-left label */}
      <div className="preroll-label">Ad {adLoaded ? "" : "loading..."}</div>

      {/* Bottom-right countdown / skip */}
      <div className="preroll-controls">
        {canSkip ? (
          <button className="preroll-skip-btn" onClick={finish}>
            Skip Ad &rsaquo;
          </button>
        ) : (
          <span className="preroll-countdown">
            Skip in {SKIP_AFTER - (TOTAL_SECONDS - secondsLeft)}s
          </span>
        )}
      </div>

      {/* Progress bar at bottom */}
      <div className="preroll-progress">
        <div
          className="preroll-progress__bar"
          style={{
            width: `${((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
