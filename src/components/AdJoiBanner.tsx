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
  },
  // Candy.AI uses Candy-branded Cartoon-Hentai creatives (offer 10022).
  // 6 GIFs, brand-matched for hentai audience landing on Candy.AI.
  "candy-ai": {
    "watch-d": [
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset1.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset2.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset3.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset4.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset5.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset6.gif",
    ],
  },
};

type Surface = string;

interface Props {
  slug: keyof typeof POOLS;
  surface: Surface;
}

export function AdRotationBanner({ slug, surface }: Props) {
  const pool = POOLS[slug]?.[surface];
  if (!pool || pool.length === 0) return null;
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
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </a>
  );
}

/** Backwards-compat alias for the homepage Placement A. */
export function AdJoiBanner() {
  return <AdRotationBanner slug="joi-ai" surface="homepage-a" />;
}
