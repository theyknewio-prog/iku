"use client";

/**
 * FeedInterstitial — Fullscreen interstitial ad between feed swipes.
 *
 * Renders an AdultForce HentaiPros 300x250 rotating iframe inline (NOT via
 * the <HentaiProsBanner> component) because that component has an
 * `if (pathname.startsWith("/feed")) return null` guard to prevent ads
 * from appearing on the Shorts feed — but the interstitial is the ONE
 * place on /feed where we explicitly WANT an ad. Inlining the iframe
 * bypasses that guard cleanly without adding another prop to the shared
 * component.
 *
 * Why HentaiPros and not ExoClick: ExoClick's interstitial zone (5893294)
 * returned empty fill ~90% of the time → silent black screen. AdultForce's
 * server-side rotating spot (adtng.com) always fills with real hentai
 * creatives rotating through HentaiPros / Candy.ai / MyDirtyHobby offers.
 *
 * Close button appears after 3 seconds. Pro users never see this.
 */

import { useEffect, useState } from "react";

const CLOSE_DELAY = 3000; // close button appears after 3s

// HentaiPros 300x250 spot id (grabbed 2026-04-11 from publishers.adultforce
// .com Marketing Assets, Hentai niche filter). ?ata=iku.media.gg attributes
// clicks back to our affiliate account (id 1661356).
const HP_SPOT_ID = 10001808;
const HP_SPOT_URL = `//a.adtng.com/get/${HP_SPOT_ID}?ata=iku.media.gg`;

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
      {/* Ad container — HentaiPros 300x250 AdultForce iframe inlined to
          bypass the /feed guard inside <HentaiProsBanner>. */}
      <div className="feed-interstitial__ad">
        <iframe
          title="hentaipros-interstitial"
          aria-label="Advertisement"
          src={HP_SPOT_URL}
          width={300}
          height={250}
          scrolling="no"
          frameBorder={0}
          allowTransparency
          marginHeight={0}
          marginWidth={0}
          name={`spot_id_${HP_SPOT_ID}`}
          style={{
            backgroundColor: "transparent",
            border: "none",
            display: "block",
            maxWidth: "100%",
          }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
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
