/**
 * generic-source.ts — unified PG lookup for sources that store MP4s directly.
 *
 * Each source (hanime1, hentaibros, hentaicloud, hentaifreak, hentaimama,
 * hentaiplay, hentaisea, hentaistream) ingests rows into `videos` with a
 * distinct `source` column and a slug prefix (hn1-, hbro-, hcld-, hfk-,
 * hmam-, hpl-, hs-, hst-). Their MP4 URL is already playable — we just
 * proxy through /api/video-stream to avoid leaking the source domain and
 * to dodge potential hotlink/CORS checks.
 *
 * This module replaces per-source duplicated lookup files.
 */

import pool from "@/lib/db";
import type { Video } from "@/types/video";
import { BANNED_TAGS_ARRAY, containsBannedContent } from "@/lib/content";
import { memoize } from "@/lib/memo";

export type GenericSource =
  | "hanime1"
  | "hentaibros"
  | "hentaicloud"
  | "hentaifreak"
  | "hentaimama"
  | "hentaiplay"
  | "hentaisea"
  | "hentaistream"
  | "porn3dx";

function rowToVideo(
  row: Record<string, unknown>,
  source: GenericSource,
): Video {
  return {
    id: row.source_id as number,
    slug: row.slug as string,
    url: row.url as string,
    thumbnail: row.thumbnail as string,
    preview: row.preview as string,
    score: (row.score as number) ?? 0,
    favorites: (row.favorites as number) ?? 0,
    tags: (row.tags as string[]) || [],
    characters: (row.characters as string[]) || [],
    copyrights: (row.copyrights as string[]) || [],
    artists: (row.artists as string[]) || [],
    width: (row.width as number) ?? 0,
    height: (row.height as number) ?? 0,
    fileSize: (row.file_size as number) ?? 0,
    duration: (row.duration as number | null) ?? null,
    createdAt: new Date(row.created_at as string),
    source,
    pageUrl: (row.page_url as string | undefined) || undefined,
    title: (row.title as string | undefined) || undefined,
  };
}

async function queryPost(
  source: GenericSource,
  id: number,
): Promise<Video | null> {
  const { rows } = await pool.query(
    `SELECT * FROM videos
     WHERE source = $1 AND source_id = $2
       AND NOT (tags && $3::text[])
       AND NOT (COALESCE(characters, ARRAY[]::text[]) && $3::text[])
       AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $3::text[])
     LIMIT 1`,
    [source, id, BANNED_TAGS_ARRAY],
  );
  if (rows.length === 0) return null;
  const video = rowToVideo(rows[0], source);
  if (containsBannedContent(video)) return null;
  return video;
}

const memoByKey = new Map<
  GenericSource,
  (id: number) => Promise<Video | null>
>();

export function getGenericSourcePost(
  source: GenericSource,
  id: number,
): Promise<Video | null> {
  let fn = memoByKey.get(source);
  if (!fn) {
    fn = memoize(
      `generic-source-${source}`,
      (sid: number) => queryPost(source, sid),
      5 * 60 * 1000,
    );
    memoByKey.set(source, fn);
  }
  return fn(id);
}

/**
 * Wraps an MP4 URL in /api/video-stream to keep the source host private
 * and to normalize Range handling across sources.
 */
export function getGenericSourceStreamUrl(mp4Url: string): string {
  return `/api/video-stream?url=${encodeURIComponent(mp4Url)}`;
}
