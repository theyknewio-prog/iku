"use client";

/**
 * FeedAdSlide — sponsored slide woven into the Shorts scroll-snap flow
 * (TikTok in-feed ad pattern). NOT an overlay: it's a regular .feed-item
 * the user swipes past like any short. Owner rule 2026-07-08: 1 ad every
 * ~4 slides, zero popups.
 *
 * Renders data-ad (no data-index): SwipeFeed's IntersectionObserver sets
 * activeIndex to -1 when an ad slide is in view so every video pauses
 * behind it.
 */

import { useState } from "react";

const CREATIVES: { href: string; src: string; w: number; h: number }[] = [
  // Candy Realistic "tired of porn" série — pool feed-f historique.
  ...[
    "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_1.gif",
    "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_02.gif",
    "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_3.gif",
    "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_4.gif",
    "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_5.gif",
    "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_6.gif",
  ].map((src) => ({ href: "/go/candy-ai", src, w: 300, h: 250 })),
  // Joi anime — matche le contenu du feed.
  ...[
    "https://www.imglnkx.com/10138/anime---succubus.gif",
    "https://www.imglnkx.com/10138/anime---lesbian.gif",
    "https://www.imglnkx.com/10138/anime---tentacle.gif",
  ].map((src) => ({ href: "/go/joi-ai", src, w: 300, h: 250 })),
];

export function FeedAdSlide({ slot }: { slot: number }) {
  const [creative] = useState(
    () => CREATIVES[Math.floor(Math.random() * CREATIVES.length)],
  );
  return (
    <div
      className="feed-item"
      data-ad="1"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(60,20,60,0.55) 0%, #0a0a0a 70%)",
      }}
      data-surface={`feed-slide-${slot}`}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        Sponsored
      </span>
      <a
        href={creative.href}
        target="_blank"
        rel="sponsored noopener"
        style={{
          display: "block",
          width: creative.w,
          height: creative.h,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        }}
      >
        <img
          src={creative.src}
          alt="Sponsored"
          width={creative.w}
          height={creative.h}
          style={{ display: "block", width: creative.w, height: creative.h }}
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </a>
      <span
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.35)",
        }}
      >
        Swipe up to keep watching ↑
      </span>
    </div>
  );
}
