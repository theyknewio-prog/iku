"use client";

/**
 * AffiliateRail — Vertical stack or horizontal carousel of AffiliateCards.
 *
 * Pulls affiliate data from src/lib/affiliates.ts (single source of truth).
 * Pass `slugs` to cherry-pick which affiliates appear and in what order.
 * Pass `layout="vertical"` for sidebar stacks, `layout="carousel"` for
 * inline horizontal scrolling rows.
 *
 * Usage examples (mount in a future task — do NOT add to layout.tsx yet):
 *
 *   // Sidebar: top 3 picks, vertical
 *   <AffiliateRail slugs={["candy-ai","dream-gf","only-waifus"]} layout="vertical" />
 *
 *   // Between content sections: horizontal carousel, all 8
 *   <AffiliateRail
 *     title="Try AI girlfriend chat — free trial"
 *     slugs={["candy-ai","dream-gf","kupid-ai","crush-on","only-waifus","anime-genius","soulkyn","nomi-ai"]}
 *     layout="carousel"
 *   />
 */

import { getAffiliate } from "@/lib/affiliates";
import AffiliateCard from "@/components/AffiliateCard";

export interface AffiliateRailProps {
  title?: string;
  slugs: string[];
  layout: "vertical" | "carousel";
  limit?: number;
}

export default function AffiliateRail({
  title,
  slugs,
  layout,
  limit = 3,
}: AffiliateRailProps) {
  // Resolve slugs → affiliate data, drop unknown slugs silently
  const affiliates = slugs
    .slice(0, limit)
    .map((s) => getAffiliate(s))
    .filter(Boolean) as NonNullable<ReturnType<typeof getAffiliate>>[];

  if (affiliates.length === 0) return null;

  // compact variant for vertical sidebar stacks
  // wide variant for horizontal carousel items (scrollable row)
  const cardVariant = layout === "vertical" ? "compact" : "wide";

  return (
    <section className={`aff-rail aff-rail--${layout}`}>
      {title && <h3 className="aff-rail__title">{title}</h3>}

      <div className={`aff-rail__track aff-rail__track--${layout}`}>
        {affiliates.map((aff) => (
          <AffiliateCard
            key={aff.slug}
            slug={aff.slug}
            brand={aff.brand}
            tagline={aff.tagline}
            thumbnail={aff.thumbnail}
            rating={aff.rating}
            badge={aff.badge}
            variant={cardVariant}
          />
        ))}
      </div>
    </section>
  );
}
