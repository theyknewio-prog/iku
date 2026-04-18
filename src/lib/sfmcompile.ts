/**
 * sfmcompile.ts — Data layer for sfmcompile.club (PostgreSQL)
 *
 * SFM Compile is our main "3D / SFM-rendered porn animation" source
 * (~37K clips, 10s–3min). MP4s are self-hosted on wp-content/uploads
 * with no token or auth, so the URL is stable and the row's `url`
 * column can be served as-is. We still route through /api/video-stream
 * so the origin domain never leaks into the user's network panel
 * (public-copy opsec rule).
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
    source: "sfmcompile",
    pageUrl: (row.page_url as string | undefined) || undefined,
    title: (row.title as string | undefined) || undefined,
  };
}

async function _getSfmCompilePost(id: number): Promise<Video | null> {
  const { rows } = await pool.query(
    `SELECT * FROM videos
     WHERE source = 'sfmcompile' AND source_id = $1
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

export const getSfmCompilePost = memoize(
  "sfmcompile-post",
  _getSfmCompilePost,
  5 * 60 * 1000,
);

/**
 * Returns the streaming URL for a sfmcompile video. Always wraps the
 * direct MP4 in /api/video-stream?url= so the source domain never
 * appears in the user's network tab.
 */
export function getSfmCompileStreamUrl(mp4Url: string): string {
  return `/api/video-stream?url=${encodeURIComponent(mp4Url)}`;
}
