/**
 * 3dhentaitube.ts — Data layer for 3dhentai.tube (PostgreSQL)
 *
 * ~477 CGI / 3D motion-anime clips. MP4s are hosted on a rotating set
 * of CDN domains (naughtyhentai, watchpornmovie, hentaivideo.tube, ...).
 * Direct stream URL — no token, no IP bind. Served through video-stream
 * proxy to keep the source domain out of the user's network tab.
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
    source: "3dhentaitube",
    pageUrl: (row.page_url as string | undefined) || undefined,
    title: (row.title as string | undefined) || undefined,
  };
}

async function _get3dHentaiTubePost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    `SELECT * FROM videos
     WHERE source = '3dhentaitube' AND source_id = $1
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

export const get3dHentaiTubePost = memoize(
  "3dhentaitube-post",
  _get3dHentaiTubePost,
  5 * 60 * 1000,
);

export function get3dHentaiTubeStreamUrl(mp4Url: string): string {
  return `/api/video-stream?url=${encodeURIComponent(mp4Url)}`;
}
