"use client";

/**
 * HentaiProsBanner — AdultForce hentai-niche rotating iframe ad unit.
 *
 * Embeds AdultForce's server-side rotating ad iframe (adtng.com/get/{spot_id})
 * which auto-rotates the best-converting hentai creatives. The `?ata=iku.media.gg`
 * sub-id attributes clicks back to our affiliate account (ID 1661356).
 *
 * Payouts rotate through HentaiPros ($25-35 PPS), Candy.ai ($30 CPA Tier 1),
 * MyDirtyHobby, and other hentai-niche offers per geo+device.
 *
 * Grabbed from publishers.adultforce.com Marketing Assets on 2026-04-11 via
 * Playwright MCP (Niche=Hentai filter, all 6 sizes).
 *
 * Responsive: the `format` prop is a target format for DESKTOP. On mobile
 * (<768px) we auto-swap to `300x250` to avoid 728x90 iframes overflowing
 * the viewport. Call with `format="728x90"` on desktop slots and let the
 * component handle mobile downgrade.
 *
 * Pro users + /feed never see these.
 */

import { usePathname } from "next/navigation";

// Spot IDs from AdultForce (Hentai niche, 2026-04-11)
const SPOTS = {
  "160x600": { spotId: 10001821, w: 160, h: 600 },
  "300x100": { spotId: 10001817, w: 300, h: 100 },
  "300x250": { spotId: 10001808, w: 300, h: 250 },
  "315x300": { spotId: 10001816, w: 315, h: 300 },
  "728x90": { spotId: 10001811, w: 728, h: 90 },
  "900x250": { spotId: 10001820, w: 900, h: 250 },
} as const;

type HentaiBannerFormat = keyof typeof SPOTS;

interface HentaiProsBannerProps {
  /** Desktop format. On mobile (<768px) we auto-swap to a mobile-friendly size. */
  format: HentaiBannerFormat;
  /**
   * Mobile fallback format. Defaults to 300x250 which fits every viewport.
   * Set to null to render the desktop format unchanged on mobile.
   */
  mobileFormat?: HentaiBannerFormat | null;
  className?: string;
}

function renderIframe(format: HentaiBannerFormat, ariaLabel: string) {
  const spot = SPOTS[format];
  const src = `//a.adtng.com/get/${spot.spotId}?ata=iku.media.gg`;
  return (
    <iframe
      title={`hentaipros-${format}`}
      aria-label={ariaLabel}
      src={src}
      width={spot.w}
      height={spot.h}
      loading="lazy"
      scrolling="no"
      frameBorder={0}
      allowTransparency
      marginHeight={0}
      marginWidth={0}
      name={`spot_id_${spot.spotId}`}
      style={{
        backgroundColor: "transparent",
        border: "none",
        display: "block",
        maxWidth: "100%",
      }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}

export function HentaiProsBanner({
  format,
  mobileFormat = "300x250",
  className,
}: HentaiProsBannerProps) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  if (isFeed) return null;
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
    return null;

  const desktop = SPOTS[format];
  const useDifferentMobile = mobileFormat && mobileFormat !== format;
  const mobile = useDifferentMobile ? SPOTS[mobileFormat!] : desktop;

  // Shared wrapper — centers the iframe, prevents horizontal overflow, and
  // reserves vertical space so the layout doesn't shift when the iframe
  // paints.
  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    maxWidth: "100%",
    overflow: "hidden",
    margin: "12px auto",
  };

  if (!useDifferentMobile) {
    // Single render path
    return (
      <div
        className={["hp-iframe-wrap", className].filter(Boolean).join(" ")}
        style={{ ...wrapperStyle, minHeight: desktop.h }}
      >
        {renderIframe(format, `Advertisement ${format}`)}
      </div>
    );
  }

  // Dual render — CSS media queries show the right one per viewport.
  // We use inline <style> rather than Tailwind/CSS Modules so this component
  // is self-contained (no external stylesheet dependency).
  return (
    <>
      <style>{`
        @media (max-width: 767px) { .hp-iframe-wrap--desktop { display: none !important; } }
        @media (min-width: 768px) { .hp-iframe-wrap--mobile  { display: none !important; } }
      `}</style>
      <div
        className={["hp-iframe-wrap", "hp-iframe-wrap--desktop", className]
          .filter(Boolean)
          .join(" ")}
        style={{ ...wrapperStyle, minHeight: desktop.h }}
      >
        {renderIframe(format, `Advertisement ${format}`)}
      </div>
      <div
        className={["hp-iframe-wrap", "hp-iframe-wrap--mobile", className]
          .filter(Boolean)
          .join(" ")}
        style={{ ...wrapperStyle, minHeight: mobile.h }}
      >
        {renderIframe(mobileFormat!, `Advertisement ${mobileFormat}`)}
      </div>
    </>
  );
}
