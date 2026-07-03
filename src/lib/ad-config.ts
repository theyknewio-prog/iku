/**
 * ad-config.ts — ExoClick zone IDs for iku.gg (site validated in the
 * ExoClick dashboard, zones created 2026-04-07, re-lit 2026-07-03).
 *
 * ExoClick is the display/CPM layer. Affiliate CPA links live in
 * src/app/go/[slug]/route.ts — the two systems are independent.
 */

export const EXOCLICK_SCRIPT_URL = "https://a.magsrv.com/ad-provider.js";

export const AD_ZONES = {
  /** Banner 728x90 — under the video player on desktop */
  watchUnderplayer728: "5893256",
  /** Banner 300x50 — under the video player on mobile */
  watchUnderplayer300x50: "5895978",
  /** Banner 300x250 — watch sidebar top */
  sidebar300: "5893266",
  /** Native — inside browse/tag video grids */
  nativeGrid: "5893292",
} as const;
