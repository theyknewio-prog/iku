/**
 * CrakRevenue AI Smartlink creatives (provided by user 2026-05-01).
 *
 * Smartlink ID: SF_006OG000004lmDN
 * Account: iku.media.gg@gmail.com
 *
 * Each creative routes through the same Smartlink but with a different
 * `aff_sub4` tracking code so we can see which surface converts best in
 * the CrakRevenue dashboard.
 *
 * AT_xxxx codes:
 *   AT_0002 — banner image (300x250)
 *   AT_0005 — popunder (mnpw3 script)
 *   AT_0018 — cams widget (im_jerky)
 *   AT_0019 — pop-in overlay (affstitial)
 */

const SMARTLINK_BASE =
  "https://t.mbjms.com/410186/9403/0?target=nativeads&aff_sub5=SF_006OG000004lmDN";

export const CRAK_CREATIVES = {
  /** Hentai-themed 300x250 banner — perfect fit for iku.gg sidebar / inline. */
  hentaiBanner300x250: {
    image:
      "https://www.imglnkx.com/9403/ADV-1207_DESIGN-21652_Hentai-Banners_300250.jpg",
    href: `${SMARTLINK_BASE}&file_id=613431&aff_sub4=AT_0002`,
    width: 300,
    height: 250,
    alt: "AI Hentai Girlfriend — Try Free",
  },

  /** Generic 300x250 banner (non-hentai). Backup creative for variety. */
  genericBanner300x250: {
    image: "https://www.imglnkx.com/9403/ADV-21652_DESIGN-21652_300250.jpg",
    href: `${SMARTLINK_BASE}&file_id=613421&aff_sub4=AT_0002`,
    width: 300,
    height: 250,
    alt: "AI Girlfriend — Chat & Roleplay",
  },

  /** Popunder — opens a new tab on first qualifying click, 24h cookie. */
  popunder: {
    scriptSrc: "https://static.scptp9.com/mnpw3.js",
    initCall: `mnpw.add('${SMARTLINK_BASE}&aff_sub4=AT_0005&pud=scptp9', { newTab: true, cookieExpires: 86401 });`,
  },

  /** PopIn overlay — covers the page, ~14 min cookie. Click-triggered. */
  popInOverlay: {
    scriptSrc: "https://crxcra.com/popin/latest/affstitial-min.js",
    initVar: "crakPopInParamsOverlay",
    config: {
      url: `${SMARTLINK_BASE}&aff_sub4=AT_0019`,
      decryptUrl: false,
      contentType: "overlay" as const,
      coverOverlay: true,
      expireDays: 0.01,
    },
  },

  /** Cams widget — prerecorded mode, bottom-right floating preview. */
  camsWidget: {
    scriptSrc: `https://crxcr2.com/cams-widget-ext/im_jerky?&lang=en&mode=prerecorded&outlinkUrl=${encodeURIComponent(`${SMARTLINK_BASE}&aff_sub4=AT_0018`)}`,
  },
} as const;

export type CrakBanner = typeof CRAK_CREATIVES.hentaiBanner300x250;
