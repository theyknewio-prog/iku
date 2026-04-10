/**
 * wp-hentai.ts — Data layer for WordPress-based hentai sites (PostgreSQL)
 *
 * Sources: hentaimama.io, hentai.tv, animeidhentai.com,
 * watchhentai.net, hentaiworld.tv, hentaigasm.com
 *
 * Like rule34video, these have no direct video URLs —
 * they're resolved on-demand via /api/resolve-video with yt-dlp.
 */

import pool from "@/lib/db";
import type { Video, PaginatedResult } from "@/types/video";
import { BANNED_TAGS_ARRAY, containsBannedContent, filterBannedContent } from "@/lib/content";
import { memoize } from "@/lib/memo";

/** Known slug prefixes for each WP site */
const WP_PREFIXES = ["hmm", "htv", "aid", "wh", "hw", "hg"] as const;

export function isWPHentaiSlug(slug: string): boolean {
  return WP_PREFIXES.some((p) => slug.startsWith(p + "-"));
}

function rowToVideo(row: Record<string, unknown>): Video {
  return {
    id: row.source_id as number,
    slug: row.slug as string,
    url: row.url as string,
    thumbnail: row.thumbnail as string,
    preview: row.preview as string,
    score: row.score as number,
    favorites: row.favorites as number,
    tags: (row.tags as string[]) || [],
    characters: (row.characters as string[]) || [],
    copyrights: (row.copyrights as string[]) || [],
    artists: (row.artists as string[]) || [],
    width: row.width as number,
    height: row.height as number,
    fileSize: row.file_size as number,
    duration: row.duration as number | null,
    createdAt: new Date(row.created_at as string),
    source: "wp",
    pageUrl: (row.page_url as string | undefined) || undefined,
    title: (row.title as string | undefined) || undefined,
  };
}

async function _getWPHentaiPost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    `SELECT * FROM videos
     WHERE source = 'wp' AND source_id = $1
       AND NOT (tags && $2::text[])
       AND NOT (COALESCE(characters, ARRAY[]::text[]) && $2::text[])
       AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $2::text[])
     LIMIT 1`,
    [id, BANNED_TAGS_ARRAY]
  );
  if (rows.length === 0) return null;
  const video = rowToVideo(rows[0]);
  if (containsBannedContent(video)) return null;
  return video;
}
export const getWPHentaiPost = memoize(
  "wp-hentai-post",
  _getWPHentaiPost,
  5 * 60 * 1000,
);

export async function getWPHentaiPageUrl(id: number): Promise<string | null> {
  const v = await getWPHentaiPost(id);
  return v?.pageUrl ?? null;
}

export interface WPHentaiSearchOptions {
  tags?: string;
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export async function searchWPHentai(
  options: WPHentaiSearchOptions = {}
): Promise<PaginatedResult<Video>> {
  const { tags = "", page = 1, limit = 20, order = "date" } = options;
  const offset = (page - 1) * limit;

  const conditions = ["source = 'wp'"];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Banned content filter (SQL level)
  conditions.push(
    `NOT (tags && $${paramIndex}::text[])
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && $${paramIndex}::text[])
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $${paramIndex}::text[])`
  );
  params.push(BANNED_TAGS_ARRAY);
  paramIndex++;

  if (tags) {
    const searchTerms = tags.toLowerCase().split(/\s+/);
    for (const term of searchTerms) {
      conditions.push(`(title ILIKE '%' || $${paramIndex} || '%' OR $${paramIndex} = ANY(tags))`);
      params.push(term);
      paramIndex++;
    }
  }

  const orderClause = order === "date" ? "ORDER BY created_at DESC" : "ORDER BY score DESC";

  params.push(limit + 1, offset);
  const query = `SELECT * FROM videos WHERE ${conditions.join(" AND ")} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const { rows } = await pool.query(query, params);
  const hasMore = rows.length > limit;

  return {
    data: filterBannedContent(rows.slice(0, limit).map(rowToVideo)),
    hasMore,
  };
}
