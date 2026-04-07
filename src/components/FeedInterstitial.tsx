"use client";

/**
 * FeedInterstitial — Fullscreen interstitial ad between feed swipes.
 *
 * Shows an ExoClick interstitial zone (fullpage overlay).
 * Close button appears after 3 seconds. Pro users never see this.
 *
 * Fix 2026-04-07: Uses waitForAdProvider() so the push() fires only after
 * ExoClick's script has bootstrapped.
 */

import { useEffect, useRef, useState } from "react";
import { AD_ZONES } from "@/lib/ad-config";
import { insertExoClickZone } from "@/lib/ad-utils";

const ZONE_ID = AD_ZONES.exoclick.feedInterstitial;
const CLOSE_DELAY = 3000; // close button appears after 3s

interface FeedInterstitialProps {
  onClose: () => void;
}

export function FeedInterstitial({ onClose }: FeedInterstitialProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const insertedRef = useRef(false);
  const [canClose, setCanClose] = useState(false);

  // Insert ad zone
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    insertExoClickZone(container, ZONE_ID, insertedRef);
  }, []);

  // Show close button after delay
  useEffect(() => {
    const timer = setTimeout(() => setCanClose(true), CLOSE_DELAY);
    return () => clearTimeout(timer);
  }, []);

  // Lock body scroll while interstitial is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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

  return (
    <div className="feed-interstitial" aria-label="Advertisement">
      {/* Ad container */}
      <div ref={containerRef} className="feed-interstitial__ad" />

      {/* Close button — appears after 3s */}
      {canClose ? (
        <button
          className="feed-interstitial__close"
          onClick={onClose}
          aria-label="Close ad"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : (
        <div className="feed-interstitial__wait">
          Ad closes in {Math.ceil(CLOSE_DELAY / 1000)}s...
        </div>
      )}
    </div>
  );
}
