"use client";

/**
 * AffiliateCard — Reusable affiliate offer card for AI girlfriend programs.
 *
 * Three layout variants:
 *   compact  — sidebar column (~280px wide). Full thumbnail + name + CTA.
 *   wide     — inline content banner (~728px desktop / full-width mobile).
 *   stacked  — mobile sticky bottom strip. Thumb left, text center, CTA right.
 *
 * The card links to /go/{slug} which handles PostHog logging + redirect to the
 * real affiliate tracking URL. rel="sponsored" is required by FTC + Google
 * guidelines for adult affiliate placements.
 *
 * Thumbnail images live at /public/img/affiliates/{slug}.jpg — these are
 * placeholders and will 404 until uploaded.
 */

import Image from "next/image";

export interface AffiliateCardProps {
  slug: string;
  brand: string;
  tagline: string;
  thumbnail: string;
  rating?: number;
  badge?: string;
  variant: "compact" | "wide" | "stacked";
}

/** Render a star rating string, e.g. 4.8 → "★★★★★ 4.8" */
function StarRating({ value }: { value: number }) {
  const full = Math.round(value);
  const stars = "★".repeat(Math.min(full, 5));
  return (
    <span className="aff-card__stars" aria-label={`Rating: ${value} out of 5`}>
      {stars} <span className="aff-card__rating-value">{value.toFixed(1)}</span>
    </span>
  );
}

export default function AffiliateCard({
  slug,
  brand,
  tagline,
  thumbnail,
  rating,
  badge,
  variant,
}: AffiliateCardProps) {
  return (
    <a
      href={`/go/${slug}`}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={`aff-card aff-card--${variant}`}
      aria-label={`${brand} — ${tagline}`}
    >
      {/* Corner badge pill — "EDITOR'S PICK", "FREE TRIAL", etc. */}
      {badge && <span className="aff-card__badge">{badge}</span>}

      {/* Thumbnail */}
      <div className="aff-card__thumb">
        <Image
          src={thumbnail}
          alt={brand}
          fill
          sizes={
            variant === "compact"
              ? "280px"
              : variant === "stacked"
                ? "80px"
                : "(min-width: 768px) 120px, 80px"
          }
          className="aff-card__thumb-img"
          // Graceful degradation — thumbnail files won't exist until uploaded
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {/* Text content */}
      <div className="aff-card__body">
        <span className="aff-card__brand">{brand}</span>
        <span className="aff-card__tagline">{tagline}</span>
        {rating !== undefined && <StarRating value={rating} />}
      </div>

      {/* CTA button */}
      <span className="aff-card__cta" aria-hidden="true">
        Try Free
      </span>
    </a>
  );
}
