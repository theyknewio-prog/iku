/**
 * Shared PG pool for scraper scripts.
 * Reads DATABASE_URL from env.
 */

import { Pool } from "pg";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL env var is required");
  process.exit(1);
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
});

/**
 * Upsert a batch of videos into PostgreSQL.
 * Uses INSERT ... ON CONFLICT (source, source_id) DO UPDATE to merge new data.
 */
export async function upsertVideos(
  rows: Array<{
    source: string; source_id: number; slug: string;
    url?: string; page_url?: string | null; site?: string | null;
    title?: string | null; thumbnail?: string; preview?: string;
    score?: number; favorites?: number;
    tags?: string[]; characters?: string[]; copyrights?: string[]; artists?: string[];
    width?: number; height?: number; file_size?: number;
    duration?: number | null; created_at?: string;
  }>
): Promise<number> {
  if (rows.length === 0) return 0;

  // Safety net: reject any row with banned tags or a slug/title matching
  // banned keywords. This is the LAST line of defense — every scraper should
  // also filter upstream, but we never want illegal content to reach the DB
  // even if an upstream filter is missed or bypassed.
  const filtered = rows.filter((r) => {
    // Check ALL array columns where sources classify subjects, not just tags.
    // Danbooru/Gelbooru put character/copyright names in dedicated columns and
    // nothing relevant in `tags`, so checking only tags was a critical hole.
    const lists: string[][] = [r.tags ?? [], r.characters ?? [], r.copyrights ?? []];
    for (const list of lists) {
      for (const t of list) {
        if (BANNED_TAGS.has(t.toLowerCase())) return false;
      }
    }
    if (r.slug && hasBannedTitle(r.slug)) return false;
    if (r.title && hasBannedTitle(r.title)) return false;
    return true;
  });
  const rejected = rows.length - filtered.length;
  if (rejected > 0) {
    console.warn(`[upsertVideos] rejected ${rejected}/${rows.length} rows for banned content`);
  }
  if (filtered.length === 0) return 0;
  rows = filtered;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const o = i * 20;
    placeholders.push(
      `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10},$${o+11},$${o+12},$${o+13},$${o+14},$${o+15},$${o+16},$${o+17},$${o+18},$${o+19},$${o+20})`
    );
    values.push(
      r.source, r.source_id, r.slug, r.url ?? "", r.page_url ?? null,
      r.site ?? null, r.title ?? null, r.thumbnail ?? "", r.preview ?? "",
      r.score ?? 0, r.favorites ?? 0,
      r.tags ?? [], r.characters ?? [], r.copyrights ?? [], r.artists ?? [],
      r.width ?? 0, r.height ?? 0, r.file_size ?? 0, r.duration ?? null,
      r.created_at ?? new Date().toISOString()
    );
  }

  // characters / copyrights / artists use a COALESCE-IF-NON-EMPTY pattern so
  // a subsequent scraper run on a row that was previously enriched (either
  // by Danbooru's native metadata OR by scripts/enrich-characters-from-
  // danbooru.ts) doesn't blow away the enrichment. Most scrapers (gelbooru,
  // rule34, rule34video, wp, hentaicity, hentaigasm) send `characters: []`
  // because those sites don't expose character metadata — those empty
  // arrays would otherwise overwrite real enrichment data via the ordinary
  // `characters = EXCLUDED.characters` update.
  //
  // Regression discovered 2026-04-12: enrichment job ran while scrapers
  // were also running → scrapers committed empty arrays last → 33K rule34
  // video rows lost their enrichment in the span of a single run.
  const query = `
    INSERT INTO videos (source, source_id, slug, url, page_url, site, title, thumbnail, preview, score, favorites, tags, characters, copyrights, artists, width, height, file_size, duration, created_at)
    VALUES ${placeholders.join(",")}
    ON CONFLICT (source, source_id) DO UPDATE SET
      slug = EXCLUDED.slug, url = EXCLUDED.url,
      page_url = EXCLUDED.page_url, site = EXCLUDED.site, title = EXCLUDED.title,
      thumbnail = EXCLUDED.thumbnail, preview = EXCLUDED.preview,
      score = EXCLUDED.score, favorites = EXCLUDED.favorites,
      tags = EXCLUDED.tags,
      characters = CASE
        WHEN COALESCE(array_length(EXCLUDED.characters, 1), 0) > 0
          THEN EXCLUDED.characters
        ELSE videos.characters
      END,
      copyrights = CASE
        WHEN COALESCE(array_length(EXCLUDED.copyrights, 1), 0) > 0
          THEN EXCLUDED.copyrights
        ELSE videos.copyrights
      END,
      artists = CASE
        WHEN COALESCE(array_length(EXCLUDED.artists, 1), 0) > 0
          THEN EXCLUDED.artists
        ELSE videos.artists
      END,
      width = EXCLUDED.width, height = EXCLUDED.height,
      file_size = EXCLUDED.file_size, duration = EXCLUDED.duration
  `;

  const result = await pool.query(query, values);
  return result.rowCount ?? 0;
}
