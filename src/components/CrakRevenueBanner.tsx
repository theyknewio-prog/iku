"use client";

/**
 * CrakRevenueBanner — rotating text/CTA banner for CrakRevenue hentai offers.
 *
 * Grabbed 3 tracking URLs from affiliates.crakrevenue.com on 2026-04-11
 * via Playwright MCP (logged in as Iku gg / iku.media.gg account 410186):
 *
 *  1. Harem Villa (offer 10229) — Adult Gaming, 45% revshare lifetime
 *     Best-converting hentai game on iku.gg audience. Users recruit
 *     waifus + battle + progress = retention = lifetime commission.
 *
 *  2. AI Smartlink (offer 9403) — Auto-rotate AI waifu/chatbot offers
 *     (Candy.ai, Replika, etc.) optimized per geo + device. Multi-CPA
 *     model — payout varies per underlying offer.
 *
 *  3. BootyCallz (offer 7411) — Dating SOI $3.50 per sign-up
 *     Low-friction dating signup, high volume, good filler.
 *
 * CrakRevenue doesn't provide pre-built banner creatives (unlike
 * AdultForce's iframe zones), so we ship a simple gradient+text card.
 * Rotation is random-per-mount so different placements on the same
 * page link to different offers.
 *
 * Pro users + /feed never see these.
 */

import { useMemo } from "react";
import { usePathname } from "next/navigation";

interface CrakOffer {
  id: string;
  url: string;
  title: string;
  sub: string;
  emoji: string;
  gradient: string;
}

const OFFERS: CrakOffer[] = [
  {
    id: "harem-villa",
    url: "https://t.anadw.link/410186/10229/0?bo=3511,3512,3521,3522&aff_sub5=SF_006OG000004lmDN",
    title: "Harem Villa — Recruit 100+ Waifus",
    sub: "Free hentai RPG · Play in browser",
    emoji: "💎",
    gradient: "linear-gradient(135deg, #ff006e 0%, #ff6b35 100%)",
  },
  {
    id: "ai-smartlink",
    url: "https://t.mbjms.com/410186/9403/0?aff_sub5=SF_006OG000004lmDN",
    title: "Chat with Your Anime Waifu",
    sub: "AI girlfriend · Uncensored · Free trial",
    emoji: "💬",
    gradient: "linear-gradient(135deg, #3a86ff 0%, #8338ec 100%)",
  },
  {
    id: "bootycallz",
    url: "https://t.crdtg2.com/410186/7411?bo=2753,2754,2755,2756&aff_sub5=SF_006OG000004lmDN",
    title: "Hentai Dating — Free Signup",
    sub: "Real users · Match in 60 seconds",
    emoji: "💘",
    gradient: "linear-gradient(135deg, #8338ec 0%, #ff006e 100%)",
  },
];

interface CrakRevenueBannerProps {
  /** Pin to a specific offer id. Default = random rotation. */
  offerId?: "harem-villa" | "ai-smartlink" | "bootycallz";
  className?: string;
  /** If true, this banner won't render on desktop (>=768px) */
  mobileOnly?: boolean;
  /** If true, this banner won't render on mobile (<768px) */
  desktopOnly?: boolean;
}

export function CrakRevenueBanner({
  offerId,
  className,
  mobileOnly,
  desktopOnly,
}: CrakRevenueBannerProps) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  const offer = useMemo(() => {
    if (offerId) return OFFERS.find((o) => o.id === offerId) ?? OFFERS[0];
    return OFFERS[Math.floor(Math.random() * OFFERS.length)];
  }, [offerId]);

  if (isFeed) return null;
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1") return null;

  const wrapperClass = [
    "crakrevenue-banner",
    className,
    mobileOnly ? "cr-banner--mobile-only" : "",
    desktopOnly ? "cr-banner--desktop-only" : "",
  ].filter(Boolean).join(" ");

  return (
    <a
      href={offer.url}
      target="_blank"
      rel="sponsored nofollow noopener"
      className={wrapperClass}
      aria-label={offer.title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        margin: "16px 8px",
        padding: "16px 18px",
        borderRadius: 12,
        background: offer.gradient,
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textDecoration: "none",
        boxShadow: "0 6px 24px rgba(255, 0, 110, 0.35)",
        position: "relative",
        overflow: "hidden",
        minHeight: 78,
      }}
    >
      <span
        style={{
          fontSize: 38,
          flexShrink: 0,
          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
          lineHeight: 1,
        }}
      >
        {offer.emoji}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "inline-block",
            background: "rgba(0,0,0,0.35)",
            padding: "2px 7px",
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.6px",
            marginBottom: 4,
          }}
        >
          SPONSORED
        </span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>
          {offer.title}
        </span>
        <span style={{ display: "block", fontSize: 11, opacity: 0.92, marginTop: 2 }}>
          {offer.sub}
        </span>
      </span>
      <span style={{ fontSize: 24, flexShrink: 0, marginLeft: 6 }}>›</span>
    </a>
  );
}
