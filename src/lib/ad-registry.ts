/**
 * Ad registry — single source of truth for all ad URLs, zone IDs and
 * creative pools used across iku.gg.
 *
 * Replaces the scattered constants previously in components. Any new
 * placement reads from here. Only the network-provided URLs/IDs live
 * here — no chrome, no "Sponsored" label, no badge config (per
 * `feedback_respect_ad_format.md`: we render the network's creative
 * verbatim at native IAB size).
 */

// ─── CrakRevenue ──────────────────────────────────────────────────────

export const CR_AFFILIATE_SUB = "?aff_sub5=SF_006OG000004lmDN";

/** CR offer IDs mapped to /go/[slug] redirect targets. */
export const CR_OFFERS = {
  "joi-ai": "8080", // $42 PPS T1 Premium, EPC $0.46
  "candy-ai": "8025", // $44 PPS T1 Premium, EPC $0.22
  "girlfriend-gpt": "8184", // $55 PPS, EPC $0.20
} as const;

export type CrSlug = keyof typeof CR_OFFERS;

/** CR redirect URL for a given slug. */
export function crRedirect(slug: CrSlug): string {
  return `https://t.vlmai-1.com/410186/${CR_OFFERS[slug]}${CR_AFFILIATE_SUB}`;
}

/**
 * CrakRevenue 300x250 GIF creative pools by slug × surface. No overlap
 * between surfaces so the same user navigating across pages never sees
 * the same creative twice.
 *
 * URLs are pulled directly from CR Ad Tools dashboard. Files live at
 * `https://www.imglnkx.com/<offer_id>/<filename>`.
 */
export const CR_CREATIVES: Record<CrSlug, Record<string, readonly string[]>> = {
  "joi-ai": {
    // Homepage Placement A — between Hero and Trending
    "homepage-a": [
      "https://www.imglnkx.com/10138/anime---succubus.gif",
      "https://www.imglnkx.com/10138/300x250---AI-Girls-Just-Want-To-Make-You-Cum---Copy.gif",
    ],
    // /watch Placement C — below player (mobile + desktop)
    "watch-c": [
      "https://www.imglnkx.com/10138/anime---lesbian.gif",
      "https://www.imglnkx.com/10138/anime---tentacle.gif",
      "https://www.imglnkx.com/10138/anime---slimebondage.gif",
    ],
    // Native in-grid (Trending carousel position 9 + Top Rated grid)
    "trending-grid": [
      "https://www.imglnkx.com/10138/anime---monsters.gif",
      "https://www.imglnkx.com/10138/anime---tied.gif",
      "https://www.imglnkx.com/10138/50k-characters.gif",
    ],
  },
  "candy-ai": {
    // Homepage Placement A2 — between Top Rated and Popular Characters
    "homepage-a2": [
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset1.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset2.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset3.gif",
    ],
    // /watch Placement D — sidebar bottom (desktop only)
    "watch-d": [
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset4.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset5.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset6.gif",
    ],
    // /feed full-screen interstitial every 8 swipes
    "feed-f": [
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_1.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_02.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_3.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_4.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_5.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_6.gif",
    ],
  },
  "girlfriend-gpt": {
    // No creatives in CR Ad Tools for offer 8184 (gated/restricted).
    // /go/girlfriend-gpt redirect still works but no surface mounts
    // any creative for it yet.
  },
};

// ─── HilltopAds ───────────────────────────────────────────────────────

/**
 * HilltopAds zone scripts. Each zone has a unique long-form URL that
 * the IIFE script reads via `s.settings`. Embedded inside a srcdoc
 * iframe for isolation (the IIFE references
 * `document.scripts[length-1]` which only resolves cleanly when the
 * iframe owns its document).
 */
export const HILLTOPADS_ZONES = {
  /** Banner 300x250 — zone 6969681 (homepage B + /watch E + 6 listing pages) */
  banner300x250:
    "https://selfassured-celebration.com/b.XTVysFduGPl-0jYXWPcK/-enm/9xumZCUOlBkPPxTeY/5SN/jDkE2MOKDzEZteNgjqkg2UOGTMYt4GNbQa",
  /** In-page push — zone 6969697 (currently unused) */
  inPagePush:
    "https://selfassured-celebration.com/bxXeVYs.drGQlu0_Y/WGcY/GeLm_9/u-ZaUalBkRPPTiYS5VNqjIkd2POqTrc/tBN/jYkR2bOLT/c/w/MBQL",
  /** Banner 300x100 mobile — zone 6969733 (currently unused) */
  banner300x100Mobile:
    "https://selfassured-celebration.com/bNXtVwsMd.G/lm0BYBWycx/heJmt9dubZpUdlfkTPYTxYH5NNwjvkc3ZMbzxMPtlNJj/kX2yO/TGcxzdN-wx",
} as const;
