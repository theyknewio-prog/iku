"use client";

/**
 * FeedInterstitial — Fullscreen interstitial ad between feed swipes.
 *
 * Shows an ExoClick interstitial zone (fullpage overlay).
 * Close button appears after 3 seconds. Pro users never see this.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AD_ZONES } from "@/lib/ad-config";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AdProvider?: any[];
  }
}

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
    if (!container || insertedRef.current) return;
    insertedRef.current = true;

    const ins = document.createElement("ins");
    ins.className = "eas6a97888e2";
    ins.dataset.zoneid = ZONE_ID;
    container.appendChild(ins);

    (window.AdProvider = window.AdProvider || []).push({ serve: {} });
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
          Ad closes in {Math.ceil((CLOSE_DELAY - 0) / 1000)}s...
        </div>
      )}
    </div>
  );
}
