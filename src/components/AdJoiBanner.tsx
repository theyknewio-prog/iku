/**
 * AdRotationBanner — generic 300x250 affiliate ad slot.
 *
 * Server component. Reads pool from `lib/ad-registry.ts` (slug × surface).
 * Per `feedback_respect_ad_format.md`: ZERO wrapper, ZERO badge, ZERO
 * chrome. Plain `<a><img></a>` at native 300x250.
 */

import { CR_CREATIVES, type CrSlug } from "@/lib/ad-registry";

interface Props {
  slug: CrSlug;
  surface: string;
}

export function AdRotationBanner({ slug, surface }: Props) {
  const pool = CR_CREATIVES[slug]?.[surface];
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
