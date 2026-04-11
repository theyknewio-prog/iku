"use client";

/**
 * HentaiProsBanner — AdultForce hentai-niche rotating iframe ad unit.
 *
 * Instead of hardcoded static creatives, this component embeds the actual
 * AdultForce server-side rotating ad iframe (adtng.com/get/{spot_id}).
 * Each spot id is a hentai-niche zone that AdultForce auto-rotates with
 * their best-converting creatives for that moment — we don't have to pick
 * banners manually or update code when new offers go live.
 *
 * Tracking: the `?ata=iku.media.gg` sub-id is our affiliate account. Every
 * click attributes back to us. Payout depends on which offer is currently
 * being rotated — HentaiPros ($25-35 PPS), Hentai Heroes, Nutaku rev-share,
 * etc. — all funnel through the same adtng.com zone.
 *
 * Grabbed from AdultForce Marketing Assets page on 2026-04-11 via MCP
 * (Niche filter = Hentai, copy-paste iframe snippets from 6 sizes).
 *
 * Pro users + /feed don't see these. Sandbox iframe so it can't touch
 * parent-page data.
 */

import { usePathname } from "next/navigation";

// Spot IDs from AdultForce (Hentai niche, 2026-04-11 grab)
const SPOTS = {
  "160x600": { spotId: 10001821, w: 160, h: 600 },
  "300x100": { spotId: 10001817, w: 300, h: 100 },
  "300x250": { spotId: 10001808, w: 300, h: 250 },
  "315x300": { spotId: 10001816, w: 315, h: 300 },
  "728x90":  { spotId: 10001811, w: 728, h: 90  },
  "900x250": { spotId: 10001820, w: 900, h: 250 },
} as const;

type HentaiBannerFormat = keyof typeof SPOTS;

interface HentaiProsBannerProps {
  format: HentaiBannerFormat;
  className?: string;
  /** Hide on desktop viewports (useful for 300x100 / 300x250 mobile slots) */
  mobileOnly?: boolean;
  /** Hide on mobile viewports (useful for 160x600 / 900x250 desktop slots) */
  desktopOnly?: boolean;
}

export function HentaiProsBanner({
  format,
  className,
  mobileOnly,
  desktopOnly,
}: HentaiProsBannerProps) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  if (isFeed) return null;
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1") return null;

  const spot = SPOTS[format];
  const src = `//a.adtng.com/get/${spot.spotId}?ata=iku.media.gg`;
  const name = `spot_id_${spot.spotId}`;

  const wrapperClass = [
    "hp-iframe-wrap",
    className,
    mobileOnly ? "hp-iframe-wrap--mobile-only" : "",
    desktopOnly ? "hp-iframe-wrap--desktop-only" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={wrapperClass}
      style={{ display: "block", margin: "12px auto", textAlign: "center" }}
    >
      <iframe
        title={`hentaipros-${format}`}
        src={src}
        width={spot.w}
        height={spot.h}
        scrolling="no"
        frameBorder={0}
        allowTransparency
        marginHeight={0}
        marginWidth={0}
        name={name}
        style={{
          backgroundColor: "transparent",
          border: "none",
          display: "block",
          margin: "0 auto",
          maxWidth: "100%",
        }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
