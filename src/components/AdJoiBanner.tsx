/**
 * AdRotationBanner — generic 300x250 affiliate ad slot.
 *
 * Server component. Picks ONE 300x250 GIF at random per request from a
 * surface-specific pool. The 5 anime GIFs we have are split across
 * surfaces so the same user doesn't see the same creative on homepage
 * + /watch (ad blindness killer).
 *
 * Per `feedback_respect_ad_format.md`: ZERO wrapper, ZERO badge, ZERO
 * chrome. Plain `<a><img></a>` at native 300x250.
 */

// Surface-specific GIF pools (no overlap between surfaces).
const POOLS = {
  // Homepage A — entre Hero et Trending
  "homepage-a": [
    "https://www.imglnkx.com/10138/anime---succubus.gif",
    "https://www.imglnkx.com/10138/300x250---AI-Girls-Just-Want-To-Make-You-Cum---Copy.gif",
  ],
  // /watch C — sous le player (mobile + desktop)
  "watch-c": [
    "https://www.imglnkx.com/10138/anime---lesbian.gif",
    "https://www.imglnkx.com/10138/anime---tentacle.gif",
  ],
  // /watch D — sidebar bottom desktop
  "watch-d": ["https://www.imglnkx.com/10138/anime---slimebondage.gif"],
} as const;

type Surface = keyof typeof POOLS;

interface Props {
  slug: string;
  surface: Surface;
}

export function AdRotationBanner({ slug, surface }: Props) {
  const pool = POOLS[surface];
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
