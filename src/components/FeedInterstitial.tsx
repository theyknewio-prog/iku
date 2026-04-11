"use client";

/**
 * FeedInterstitial — Fullscreen interstitial ad between feed swipes.
 *
 * Renders an AdultForce HentaiPros 300x250 rotating iframe inside a centered
 * fullscreen overlay. We switched away from ExoClick's interstitial zone
 * because it returned empty fill ~90% of the time (silent black screen in
 * Shorts). HentaiPros always rotates real hentai creatives.
 *
 * Close button appears after 3 seconds. Pro users never see this.
 */

import { useEffect, useState } from "react";
import { HentaiProsBanner } from "./HentaiProsBanner";

const CLOSE_DELAY = 3000; // close button appears after 3s

interface FeedInterstitialProps {
  onClose: () => void;
}

export function FeedInterstitial({ onClose }: FeedInterstitialProps) {
  const [canClose, setCanClose] = useState(false);

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

  return (
    <div className="feed-interstitial" aria-label="Advertisement">
      {/* Ad container — HentaiPros 300x250 rotating iframe (no mobile downgrade,
          already mobile-friendly) */}
      <div className="feed-interstitial__ad">
        <HentaiProsBanner format="300x250" mobileFormat={null} />
      </div>

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
