/**
 * entity-seo.ts — runtime lookup for per-tag/character/series SEO content.
 *
 * Pulls from the `entity_seo` PG table populated by
 * scripts/enrich-entity-seo.mjs. Memoized 1h so 5K+ landing pages don't
 * hammer PG on every render.
 */

import pool from "@/lib/db";
import { memoize } from "@/lib/memo";

export type EntityType = "tag" | "character" | "series";

export interface EntitySeo {
  intro: string;
  faq: Array<{ q: string; a: string }>;
  videoCount: number;
  generatedAt: Date;
}

async function _getEntitySeo(type: EntityType, slug: string): Promise<EntitySeo | null> {
  const { rows } = await pool.query<{
    intro: string;
    faq: Array<{ q: string; a: string }>;
    video_count: number;
    generated_at: Date;
  }>(
    `SELECT intro, faq, video_count, generated_at
     FROM entity_seo
     WHERE entity_type = $1 AND slug = $2
     LIMIT 1`,
    [type, slug.toLowerCase()]
  );
  if (!rows[0]) return null;
  return {
    intro: rows[0].intro,
    faq: rows[0].faq || [],
    videoCount: rows[0].video_count,
    generatedAt: new Date(rows[0].generated_at),
  };
}

const _memo = memoize("entity-seo", _getEntitySeo, 60 * 60 * 1000);

export async function getEntitySeo(type: EntityType, slug: string): Promise<EntitySeo | null> {
  try {
    return await _memo(type, slug);
  } catch (err) {
    console.error("getEntitySeo:", err);
    return null;
  }
}
