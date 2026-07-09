/**
 * AdRotationBanner — generic 300x250 affiliate ad slot.
 *
 * Server component. Picks ONE 300x250 creative at random per request
 * from a (slug × surface)-specific pool. Different surfaces get
 * non-overlapping GIFs so the same user navigating homepage → /watch
 * doesn't see the same creative twice (ad blindness killer).
 *
 * Brand-matched: each slug uses creatives for its actual landing page
 * (Joi-AI uses anime-themed ourdream GIFs since Joi 10163 has no 300x250
 * banners; Candy-AI uses Candy-branded Cartoon-Hentai GIFs from offer
 * 10022 — pulled directly from CR Ad Tools 2026-05-02).
 *
 * Per `feedback_respect_ad_format.md`: ZERO wrapper, ZERO badge, ZERO
 * chrome. Plain `<a><img></a>` at native 300x250.
 */

// CrakRevenue creative pools by slug × surface.
// Each surface has its own dedicated subset → 0 overlap between mounts.
const POOLS: Record<string, Record<string, readonly string[]>> = {
  // Joi-AI uses anime-themed creatives (ourdream offer 10138 — Joi
  // offer 10163 only has 300x100 banners, no 300x250).
  "joi-ai": {
    "homepage-a": [
      "https://www.imglnkx.com/10138/anime---succubus.gif",
      "https://www.imglnkx.com/10138/300x250---AI-Girls-Just-Want-To-Make-You-Cum---Copy.gif",
    ],
    "watch-c": [
      "https://www.imglnkx.com/10138/anime---lesbian.gif",
      "https://www.imglnkx.com/10138/anime---tentacle.gif",
      "https://www.imglnkx.com/10138/anime---slimebondage.gif",
    ],
    // Native in-grid — Trending carousel position 9 inline ad-break.
    // Per feedback_respect_ad_format: NO fake-card wrapper, GIF stays
    // at native 300x250 even though surrounded by ~210x300 PosterCards.
    "trending-grid": [
      "https://www.imglnkx.com/10138/anime---monsters.gif",
      "https://www.imglnkx.com/10138/anime---tied.gif",
      "https://www.imglnkx.com/10138/50k-characters.gif",
    ],
  },
  // Candy.AI uses Candy-branded Cartoon-Hentai creatives (offer 10022).
  // 6 GIFs split between homepage-a2 (Hasset 1-3) and watch-d (Hasset
  // 4-6) so the same user navigating / → /watch never sees the same
  // creative twice (ad blindness killer).
  "candy-ai": {
    // Homepage A2 — between Top Rated and Popular Games sections.
    "homepage-a2": [
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset1.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset2.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset3.gif",
    ],
    "watch-d": [
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset4.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset5.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset6.gif",
    ],
    // Candy Realistic "tired of porn" series — different style from
    // Cartoon-Hentai pool above. Used for /feed interstitial overlay
    // every 8 swipes.
    "feed-f": [
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_1.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_02.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_3.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_4.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_5.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Realistic_tired_of_porn_banner_6.gif",
    ],
  },
  // Swipey AI — added 2026-05-08 for brand-rotation variety. CR offer
  // 10100, $38.50 PPS, EPC $0.0591. 14 Realistic + 2 Anime 300x250 GIFs
  // pulled directly from CR Ad Tools 2026-05-08. Lower EPC than Joi/Candy
  // but third-brand mixed in cuts ad blindness on multi-page sessions.
  swipey: {
    "default-realistic": [
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_1.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_2.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_3.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_4.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_5.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_6.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_7.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_8.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_9.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_10.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_11.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_12.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_13.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_14.gif",
    ],
    "default-anime": [
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Anime_15.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Anime_16.gif",
    ],
  },
};

type Surface = string;

interface Props {
  slug: keyof typeof POOLS;
  surface: Surface;
  /** Créa proche de l'above-fold → charge immédiate (sinon lazy). */
  eager?: boolean;
}

export function AdRotationBanner({ slug, surface, eager }: Props) {
  let pool = POOLS[slug]?.[surface];
  // Fallback: unknown surface → flatten all pools for this slug. Lets us
  // mount AI on any new placement (3d/hentai/episodes/listings/etc.) without
  // adding a dedicated pool entry every time. `surface` still matters as a
  // string for /go logging when we wire it.
  if (!pool || pool.length === 0) {
    const slugPools = POOLS[slug];
    if (!slugPools) return null;
    const flat: string[] = [];
    for (const k of Object.keys(slugPools)) flat.push(...slugPools[k]);
    if (flat.length === 0) return null;
    pool = flat;
  }
  const src = pool[Math.floor(Math.random() * pool.length)];
  return (
    <a
      href={`/go/${slug}`}
      target="_blank"
      rel="sponsored noopener"
      style={{ display: "block", width: 300, height: 250, margin: "0 auto" }}
    >
      <img
        src={src}
        alt=""
        width={300}
        height={250}
        style={{ display: "block", width: 300, height: 250 }}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        // Ads must never win the bandwidth race against content (CF Web
        // Analytics 2026-07-09: these GIFs WERE the LCP element at 3.4-4s).
        fetchPriority="low"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </a>
  );
}

/** Backwards-compat alias for the homepage Placement A. */
export function AdJoiBanner() {
  return <AdRotationBanner slug="joi-ai" surface="homepage-a" />;
}
