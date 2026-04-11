/**
 * hentaicity.ts — Data layer for hentaicity.com (PostgreSQL)
 *
 * hentaicity is our first "long-form animated hentai episode" source,
 * adding full 20-30min episodes to complement our existing short-clip
 * catalog from Danbooru/Gelbooru/Rule34/Rule34Video.
 *
 * Unlike rule34video and the WP sources, hentaicity serves MP4 files
 * DIRECTLY from its own domain (https://www.hentaicity.com/flv/.../mobile.mp4)
 * with no token or auth — so we store the raw URL and don't need yt-dlp
 * resolution. We still proxy through /api/video-stream in the watch page
 * for CORS safety and to keep our user IP hidden from the source.
 */

import pool from "@/lib/db";
import type { Video } from "@/types/video";
import { BANNED_TAGS_ARRAY, containsBannedContent } from "@/lib/content";
import { memoize } from "@/lib/memo";

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
    source: "hentaicity",
    pageUrl: (row.page_url as string | undefined) || undefined,
    title: (row.title as string | undefined) || undefined,
  };
}

async function _getHentaicityPost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    `SELECT * FROM videos
     WHERE source = 'hentaicity' AND source_id = $1
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

export const getHentaicityPost = memoize(
  "hentaicity-post",
  _getHentaicityPost,
  5 * 60 * 1000,
);

/**
 * Returns the MP4 URL to use in the WatchPlayer for a hentaicity video.
 * Since the MP4 is served from a third-party domain, we always wrap it
 * in /api/video-stream?url= to avoid CORS / hotlink referer checks.
 */
export function getHentaicityStreamUrl(mp4Url: string): string {
  return `/api/video-stream?url=${encodeURIComponent(mp4Url)}`;
}
