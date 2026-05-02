/**
 * AdRotationBanner — generic 300x250 affiliate ad slot.
 *
 * Server component. Picks ONE 300x250 GIF at random per request from the
 * shared anime-themed CR creative pool (offer 10138 ourdream.ai —
 * generic creatives that fit any AI girlfriend landing). Click goes to
 * /go/<slug> → CR redirect.
 *
 * Per `feedback_respect_ad_format.md`: ZERO wrapper, ZERO badge, ZERO
 * chrome. Plain `<a><img></a>` at native 300x250.
 */

const GIFS = [
  "https://www.imglnkx.com/10138/anime---succubus.gif",
  "https://www.imglnkx.com/10138/anime---tentacle.gif",
  "https://www.imglnkx.com/10138/anime---lesbian.gif",
  "https://www.imglnkx.com/10138/anime---slimebondage.gif",
  "https://www.imglnkx.com/10138/300x250---AI-Girls-Just-Want-To-Make-You-Cum---Copy.gif",
] as const;

interface Props {
  slug: string;
  /** Optional override — useful if a specific offer has dedicated creatives. */
  gifs?: readonly string[];
}

export function AdRotationBanner({ slug, gifs = GIFS }: Props) {
  const src = gifs[Math.floor(Math.random() * gifs.length)];
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

/** Backwards-compat alias for the homepage Placement A (uses joi-ai). */
export function AdJoiBanner() {
  return <AdRotationBanner slug="joi-ai" />;
}
