/**
 * eporner.ts — Data layer for eporner.com (PostgreSQL)
 *
 * ~72K hentai/anime/3D clips. Page URLs are IP-bound token at playback
 * time (same pattern as rule34video), so we never pre-resolve — the
 * video-stream proxy resolves via yt-dlp and streams bytes from our
 * server IP, which the token was issued to.
 *
 * source_id is a 52-bit SHA1 hash of the base62 string id. PG column
 * is BIGINT; JS Number holds up to 2^53-1 safely.
 */

import pool from "@/lib/db";
import type { Video } from "@/types/video";
import { BANNED_TAGS_ARRAY, containsBannedContent } from "@/lib/content";
import { memoize } from "@/lib/memo";

function rowToVideo(row: Record<string, unknown>): Video {
  const rawId = row.source_id;
  const id = typeof rawId === "string" ? Number(rawId) : (rawId as number);
  return {
    id,
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
    source: "eporner",
    pageUrl: (row.page_url as string | undefined) || undefined,
    title: (row.title as string | undefined) || undefined,
  };
}

async function _getEpornerPost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    `SELECT * FROM videos
     WHERE source = 'eporner' AND source_id = $1
       AND NOT (tags && $2::text[])
       AND NOT (COALESCE(characters, ARRAY[]::text[]) && $2::text[])
       AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $2::text[])
     LIMIT 1`,
    [id, BANNED_TAGS_ARRAY],
  );
  if (rows.length === 0) return null;
  const video = rowToVideo(rows[0]);
  if (containsBannedContent(video)) return null;
  return video;
}

export const getEpornerPost = memoize(
  "eporner-post",
  _getEpornerPost,
  5 * 60 * 1000,
);

export function getEpornerStreamUrl(pageUrl: string): string {
  return `/api/video-stream?url=${encodeURIComponent(pageUrl)}`;
}
