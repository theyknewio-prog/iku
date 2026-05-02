/**
 * CrakRevenue AI creatives — geo-aware routing.
 *
 * Tier 1 (US/UK/CA/AU/NZ/IE) → direct Joi-AI offer 8080 (PPS Premium, $0.46 EPC,
 * 660× the Smartlink). Non-Tier-1 keeps the Smartlink 9403 fallback which
 * auto-routes by geo (no conversion in Tier 1, but salvages tier-2/3 traffic).
 *
 * Each creative routes through the same CR account (aff_sub5=SF_006OG000004lmDN)
 * with a different aff_sub4 tag so we can split surfaces in the dashboard.
 *
 * AT_xxxx codes:
 *   AT_0002 — banner image (300x250)
 *   AT_0005 — popunder (mnpw3 script)
 *   AT_0018 — cams widget (im_jerky)
 *   AT_0019 — pop-in overlay (affstitial)
 */

const TIER_1 = new Set(["US", "UK", "GB", "CA", "AU", "NZ", "IE"]);

// Tier-1 traffic → Joi-AI direct offer (CR 8080, $42 PPS, EPC $0.46).
const JOI_AI_BASE =
  "https://t.vlmai-1.com/410186/8080?aff_sub5=SF_006OG000004lmDN";

// Everywhere else → Smartlink fallback (auto-routes by geo, low EPC but
// salvages tier-2/3 traffic that can't convert on the Tier-1-only PPS).
const SMARTLINK_BASE =
  "https://t.mbjms.com/410186/9403/0?target=nativeads&aff_sub5=SF_006OG000004lmDN";

function pickBase(country: string): string {
  return TIER_1.has(country.toUpperCase()) ? JOI_AI_BASE : SMARTLINK_BASE;
}

export function getCrakCreatives(country: string) {
  const base = pickBase(country);
  return {
    /** Hentai-themed 300x250 banner — perfect fit for iku.gg sidebar / inline. */
    hentaiBanner300x250: {
      image:
        "https://www.imglnkx.com/9403/ADV-1207_DESIGN-21652_Hentai-Banners_300250.jpg",
      href: `${base}&file_id=613431&aff_sub4=AT_0002`,
      width: 300,
      height: 250,
      alt: "AI Hentai Girlfriend — Try Free",
    },

    /** Generic 300x250 banner (non-hentai). Backup creative for variety. */
    genericBanner300x250: {
      image: "https://www.imglnkx.com/9403/ADV-21652_DESIGN-21652_300250.jpg",
      href: `${base}&file_id=613421&aff_sub4=AT_0002`,
      width: 300,
      height: 250,
      alt: "AI Girlfriend — Chat & Roleplay",
    },

    /** Popunder — opens a new tab on first qualifying click, 24h cookie. */
    popunder: {
      scriptSrc: "https://static.scptp9.com/mnpw3.js",
      initCall: `mnpw.add('${base}&aff_sub4=AT_0005&pud=scptp9', { newTab: true, cookieExpires: 86401 });`,
    },

    /** PopIn overlay — covers the page, ~14 min cookie. Click-triggered. */
    popInOverlay: {
      scriptSrc: "https://crxcra.com/popin/latest/affstitial-min.js",
      initVar: "crakPopInParamsOverlay",
      config: {
        url: `${base}&aff_sub4=AT_0019`,
        decryptUrl: false,
        contentType: "overlay" as const,
        coverOverlay: true,
        expireDays: 0.01,
      },
    },

    /** Cams widget — prerecorded mode, bottom-right floating preview. */
    camsWidget: {
      scriptSrc: `https://crxcr2.com/cams-widget-ext/im_jerky?&lang=en&mode=prerecorded&outlinkUrl=${encodeURIComponent(`${base}&aff_sub4=AT_0018`)}`,
    },
  } as const;
}

// Default export (Smartlink-only) kept for any non-geo-aware caller.
export const CRAK_CREATIVES = getCrakCreatives("XX");

export type CrakCreatives = ReturnType<typeof getCrakCreatives>;
export type CrakBanner = CrakCreatives["hentaiBanner300x250"];
