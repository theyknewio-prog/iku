/**
 * ad-config.ts — Playmak3r stack rebuild in progress (started 2026-04-24).
 *
 * Surfaces being restored one at a time per feedback_ads_one_at_a_time.md.
 * Each addition deploys alone + measures J+7 before next surface is wired.
 *
 * Active now:
 *  - Surface #1: HilltopAds banner 300x250 on /watch (zone 6969681) — mounted 2026-04-24
 *  - Surface #2: VAST preroll 1/3 via HilltopAds (zone 6969713) — mounted 2026-04-24
 *  - Surface #3: Stripcash cam revshare "Live Cams" sidebar link — mounted 2026-04-27
 *
 * Queued (waiting on reviews / future deploys):
 *  - Clickadu popunder — REJECTED 2026-04-27 (insufficient traffic). Replace with PopAds or TrafficStars.
 *  - HilltopAds IPP (zone 6969697)
 *  - HilltopAds banner 300x100 mobile (zone 6969733)
 *  - Stripcash Video Slider widget on /watch — waiting on JS embed code from publisher panel
 */

export const AD_ZONES = {
  exoclick: {
    /** Legacy placeholder — not mounted anywhere. */
    videoPreroll: "",
  },
} as const;

/**
 * HilltopAds zones for iku.gg (site 890489, account 378863 —
 * iku.media.gg@gmail.com). Zones created 2026-04-18, all approved.
 *
 * CSP hosts whitelisted in middleware.ts:
 *   selfassured-celebration.com (banner + in-page scripts)
 *   sorrowfulpsychology.com    (popunder DirectLink)
 *   difficultblock.com         (VAST preroll)
 */
export const HILLTOPADS_ZONES = {
  popunderId: "6969665-6969669",
  banner300x250Id: "6969681",
  inPagePushId: "6969697",
  vastPrerollId: "6969713",
  banner300x100MobileId: "6969733",
} as const;

/**
 * Stripcash (StripChat parent) — cam revshare smart link.
 * Account: ikumediagg (iku.media.gg@gmail.com), approved 2026-04-27.
 * Scheme: REV 20% lifetime.
 *
 * Domain `go.mavrtracktor.com` is Stripcash's tracker — it 302s to the
 * best-converting StripChat landing for the visitor's geo. Add to CSP if
 * we ever need to render it inside an iframe; for plain `<a target="_blank">`
 * links no CSP change is needed (top-level navigation).
 *
 * Placement per plan-monetisation-iku.md ligne 144:
 *   "Link menu dédié 'Live Cam 🔴' dans sidebar (comme Playmak3r)"
 * Explicitly NOT a popunder — popunder slot is reserved for Clickadu/PopAds.
 */
export const STRIPCASH = {
  smartLinkUrl:
    "https://go.mavrtracktor.com?userId=17e833691806534d444a0f2a237e4ac61d0cd81990649940427306c52266eced",
} as const;

export const HILLTOPADS_SCRIPTS = {
  /** Banner 300x250 — zone 6969681 */
  banner300x250:
    "https://selfassured-celebration.com/b.XTVysFduGPl-0jYXWPcK/-enm/9xumZCUOlBkPPxTeY/5SN/jDkE2MOKDzEZteNgjqkg2UOGTMYt4GNbQa",
  /** In-page push — zone 6969697 */
  inPagePush:
    "https://selfassured-celebration.com/bxXeVYs.drGQlu0_Y/WGcY/GeLm_9/u-ZaUalBkRPPTiYS5VNqjIkd2POqTrc/tBN/jYkR2bOLT/c/w/MBQL",
  /** Banner 300x100 mobile — zone 6969733 */
  banner300x100Mobile:
    "https://selfassured-celebration.com/bNXtVwsMd.G/lm0BYBWycx/heJmt9dubZpUdlfkTPYTxYH5NNwjvkc3ZMbzxMPtlNJj/kX2yO/TGcxzdN-wx",
  /** Popunder DirectLink — zone 6969665-6969669. Use as window.open target. */
  popunderUrl:
    "https://sorrowfulpsychology.com/bR3kV.0-PQ3/pbvRbjmNV/JDZsDP0Q2aOGTHYF5rNsj/Y/1/LUTvYo5sNWjOkb2oNcjYkN",
  /** VAST preroll XML URL — zone 6969713. Feed to the video player VAST adapter. */
  vastPrerollUrl:
    "https://difficultblock.com/dhm.FyzcdeGzNQvWZ-G-Uq/tePmw9Ou/Z/U/lskxPVTlYT5/Nbj/k/3tMbTTMUtmN/jZkm2LO/TscXxSNeww",
} as const;
