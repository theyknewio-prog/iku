"use client";

/**
 * FeedAdInterstitial — full-bleed dark overlay shown every 8 swipes on
 * /feed (Shorts). One CR Candy-AI 300x250 GIF centered, plain Skip
 * button bottom-right.
 *
 * Per `feedback_respect_ad_format.md`: the GIF is rendered at native
 * 300x250 — no stretch, no border-radius wrapping the creative, no
 * "Sponsored" label, no rating, no chrome. Only addition is a Skip
 * button so users can dismiss.
 *
 * Per `feedback_think_consequences.md`: tap-to-dismiss ONLY on the X
 * (not on the GIF body) so users mid-swipe don't accidentally close
 * before viewing.
 *
 * Cadence is owned by SwipeFeed (every 8 swipes, offset from the
 * FeedConversionCTA every 12, LCM=24).
 */

import { useEffect, useState } from "react";

// Candy.AI Realistic "tired of porn" series (offer 10022) — pulled
// directly from CR Ad Tools 2026-05-02. Different from the Cartoon-Hentai
// pool used in /watch sidebar so a single user doesn't see the same GIF
// across the site.
const FEED_GIFS = [
  "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_1.gif",
  "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_02.gif",
  "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_3.gif",
  "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_4.gif",
  "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_5.gif",
  "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_6.gif",
];

interface Props {
  onDismiss: () => void;
}

export function FeedAdInterstitial({ onDismiss }: Props) {
  // Pick a random GIF on mount — stable for the lifetime of this overlay.
  const [src] = useState(
    () => FEED_GIFS[Math.floor(Math.random() * FEED_GIFS.length)],
  );

  // Lock body scroll while the overlay is up so swipes don't
  // accidentally advance the feed underneath.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sponsored"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <a
        href="/go/candy-ai"
        target="_blank"
        rel="sponsored noopener"
        style={{ display: "block", width: 300, height: 250 }}
      >
        <img
          src={src}
          alt=""
          width={300}
          height={250}
          style={{ display: "block", width: 300, height: 250 }}
          decoding="async"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Skip ad"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 22,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}
