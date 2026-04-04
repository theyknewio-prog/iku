/**
 * Shared PG pool for scraper scripts.
 * Reads DATABASE_URL from env.
 */

import { Pool } from "pg";

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

  const query = `
    INSERT INTO videos (source, source_id, slug, url, page_url, site, title, thumbnail, preview, score, favorites, tags, characters, copyrights, artists, width, height, file_size, duration, created_at)
    VALUES ${placeholders.join(",")}
    ON CONFLICT (source, source_id) DO UPDATE SET
      slug = EXCLUDED.slug, url = EXCLUDED.url,
      thumbnail = EXCLUDED.thumbnail, preview = EXCLUDED.preview,
      score = EXCLUDED.score, favorites = EXCLUDED.favorites,
      tags = EXCLUDED.tags, characters = EXCLUDED.characters,
      copyrights = EXCLUDED.copyrights, artists = EXCLUDED.artists,
      width = EXCLUDED.width, height = EXCLUDED.height,
      file_size = EXCLUDED.file_size, duration = EXCLUDED.duration
  `;

  const result = await pool.query(query, values);
  return result.rowCount ?? 0;
}
