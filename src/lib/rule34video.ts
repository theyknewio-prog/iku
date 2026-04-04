/**
 * rule34video.ts — Data layer for rule34video.com videos (PostgreSQL)
 *
 * Video stream URLs are resolved on-demand via yt-dlp (see /api/resolve-video).
 */

import pool from "@/lib/db";
import type { Video, PaginatedResult } from "@/types/video";

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
    source: "rule34video",
  };
}

export async function getRule34VideoPost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    "SELECT * FROM videos WHERE source = 'rule34video' AND source_id = $1 LIMIT 1",
    [id]
  );
  if (rows.length === 0) return null;
  return rowToVideo(rows[0]);
}

export async function getRule34VideoPageUrl(id: number): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT page_url FROM videos WHERE source = 'rule34video' AND source_id = $1 LIMIT 1",
    [id]
  );
  return rows[0]?.page_url ?? null;
}

export interface Rule34VideoSearchOptions {
  tags?: string;
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export async function searchRule34Video(
  options: Rule34VideoSearchOptions = {}
): Promise<PaginatedResult<Video>> {
  const { tags = "", page = 1, limit = 20, order = "date" } = options;
  const offset = (page - 1) * limit;

  const conditions = ["source = 'rule34video'"];
  const params: unknown[] = [];
  let paramIndex = 1;

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
    data: rows.slice(0, limit).map(rowToVideo),
    hasMore,
  };
}
