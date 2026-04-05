/**
 * content.ts — Unified content layer (PostgreSQL)
 *
 * All pages should import from here instead of calling source-specific modules.
 * Videos are queried from PostgreSQL instead of calling external APIs.
 */

import pool from "@/lib/db";
import { memoize } from "@/lib/memo";
import type { Video, PaginatedResult } from "@/types/video";

// ---------------------------------------------------------------------------
// Global server-side content filter — CANNOT be bypassed by users.
// Removes illegal/underage content before it reaches any page or API.
// ---------------------------------------------------------------------------

const BANNED_TAGS = new Set([
  "loli", "lolicon", "lolidom", "loli_focus",
  "shota", "shotacon", "shotadom", "shota_focus",
  "child", "children", "minor", "underage",
  "toddler", "toddlercon", "infant",
  "young_girl", "young_boy",
  "child_on_child",
  "cub", "baby",
  "oppai_loli", "legal_loli",
  "elementary_school", "kindergarten",
  "randoseru",
]);

const BANNED_TAGS_ARRAY = Array.from(BANNED_TAGS);

/** Check if a single video contains banned content */
export function containsBannedContent(video: { tags: string[] }): boolean {
  return video.tags.some((t) => BANNED_TAGS.has(t.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Thumbnail lookup from PostgreSQL
// ---------------------------------------------------------------------------

/** Get the best thumbnail for a tag (character name, series name, etc.) from database */
async function _getThumbnailForTag(tag: string): Promise<string> {
  try {
    const { rows } = await pool.query(
      `SELECT thumbnail FROM videos
       WHERE (source = 'danbooru' OR source = 'gelbooru')
         AND thumbnail != ''
         AND ($1 = ANY(characters) OR $1 = ANY(copyrights) OR $1 = ANY(tags))
         AND NOT (tags && $2::text[])
       ORDER BY score DESC
       LIMIT 1`,
      [tag.toLowerCase(), BANNED_TAGS_ARRAY]
    );

    if (rows.length === 0 || !rows[0].thumbnail) return "";
    return rows[0].thumbnail
      .replace("/180x180/", "/720x720/")
      .replace(/\.jpg$/, ".webp");
  } catch {
    return "";
  }
}
// Memoize — tag→thumbnail mapping is very stable, 1h TTL is safe
export const getThumbnailForTag = memoize("thumb-for-tag", _getThumbnailForTag, 60 * 60 * 1000);

/** Get thumbnails for multiple tags at once (batch) */
export async function getThumbnailsForTags(tags: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    tags.map(async (tag) => {
      result[tag] = await getThumbnailForTag(tag);
    })
  );
  return result;
}

// ---------------------------------------------------------------------------
// Main query interface
// ---------------------------------------------------------------------------

export interface GetVideosOptions {
  limit?: number;
  page?: number;
  order?: "score" | "date" | "favcount";
  tags?: string;
  source?: "all" | "danbooru" | "gelbooru";
  /** Exclude videos without a thumbnail (WP sources). Use on homepage/carousels. */
  requireThumbnail?: boolean;
}

/** Map a database row to a Video object */
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
    source: row.source as Video["source"],
    title: (row.title as string) || undefined,
  };
}

/**
 * Fetch videos from PostgreSQL with filtering, sorting, and pagination.
 * Banned content is excluded at the SQL level (never leaves the database).
 */
async function _getVideos(
  options: GetVideosOptions = {}
): Promise<PaginatedResult<Video>> {
  const {
    limit = 20,
    page = 1,
    order = "score",
    tags = "",
    source = "all",
    requireThumbnail = false,
  } = options;

  const clampedLimit = Math.min(limit, 200);
  const offset = (page - 1) * clampedLimit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Banned content filter (always applied)
  conditions.push(`NOT (tags && $${paramIndex}::text[])`);
  params.push(BANNED_TAGS_ARRAY);
  paramIndex++;

  // Thumbnail filter — hide WP entries that still lack a poster image
  if (requireThumbnail) {
    conditions.push(`thumbnail IS NOT NULL AND thumbnail <> ''`);
  }

  // Source filter
  if (source === "danbooru") {
    conditions.push(`source = $${paramIndex}`);
    params.push("danbooru");
    paramIndex++;
  } else if (source === "gelbooru") {
    conditions.push(`source = $${paramIndex}`);
    params.push("gelbooru");
    paramIndex++;
  }

  // Tag search
  if (tags) {
    const searchTerms = tags.toLowerCase().split(/\s+/).filter(Boolean);
    for (const term of searchTerms) {
      conditions.push(
        `($${paramIndex} = ANY(tags) OR $${paramIndex} = ANY(characters) OR $${paramIndex} = ANY(copyrights) OR (title IS NOT NULL AND title ILIKE '%' || $${paramIndex} || '%'))`
      );
      params.push(term);
      paramIndex++;
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const orderClause =
    order === "score" ? "ORDER BY score DESC, created_at DESC"
    : order === "favcount" ? "ORDER BY favorites DESC, score DESC"
    : "ORDER BY created_at DESC";

  const query = `
    SELECT source, source_id, slug, url, page_url, site, title,
           thumbnail, preview, score, favorites,
           tags, characters, copyrights, artists,
           width, height, file_size, duration, created_at
    FROM videos
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(clampedLimit + 1, offset);

  try {
    const { rows } = await pool.query(query, params);
    const hasMore = rows.length > clampedLimit;
    const data = rows.slice(0, clampedLimit).map(rowToVideo);
    return { data, hasMore };
  } catch (err) {
    console.error("getVideos PG error:", err);
    return { data: [], hasMore: false };
  }
}

// Memoize — 5 min TTL. Short enough to still feel fresh, long enough
// to absorb bursts from ISR regeneration + warmup pings.
export const getVideos = memoize("videos", _getVideos, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Curated genre tags for the homepage "Browse by Genre" section.
// These are deliberately chosen to be "sexy" / genre-ish, not generic
// descriptors like "1girl" or "solo".
// ---------------------------------------------------------------------------

export const CURATED_GENRES: { name: string; emoji: string }[] = [
  { name: "anal",         emoji: "🍑" },
  { name: "uncensored",   emoji: "🔥" },
  { name: "vanilla",      emoji: "💗" },
  { name: "3d",           emoji: "🎮" },
  { name: "monster",      emoji: "👹" },
  { name: "fantasy",      emoji: "🧚" },
  { name: "schoolgirl",   emoji: "🎒" },
  { name: "maid",         emoji: "🎀" },
  { name: "futa",         emoji: "✨" },
  { name: "milf",         emoji: "💋" },
  { name: "elf",          emoji: "🧝" },
  { name: "catgirl",      emoji: "🐱" },
  { name: "tentacles",    emoji: "🐙" },
  { name: "cosplay",      emoji: "👗" },
  { name: "bondage",      emoji: "⛓️" },
  { name: "group",        emoji: "👥" },
  { name: "ahegao",       emoji: "😵" },
  { name: "creampie",     emoji: "🍦" },
  { name: "oral",         emoji: "👄" },
  { name: "threesome",    emoji: "3️⃣" },
];

/** Count how many videos match each curated genre tag. Returns [{name, emoji, count}]. */
async function _getCuratedGenreCounts(): Promise<
  { name: string; emoji: string; count: number }[]
> {
  try {
    const names = CURATED_GENRES.map((g) => g.name);
    const { rows } = await pool.query(
      `SELECT tag, COUNT(*)::int AS count
       FROM (
         SELECT unnest(tags) AS tag FROM videos
         WHERE NOT (tags && $1::text[])
       ) t
       WHERE tag = ANY($2::text[])
       GROUP BY tag`,
      [BANNED_TAGS_ARRAY, names]
    );
    const byName = new Map<string, number>(rows.map((r) => [r.tag, r.count]));
    return CURATED_GENRES.map((g) => ({
      ...g,
      count: byName.get(g.name) ?? 0,
    })).filter((g) => g.count > 0);
  } catch (err) {
    console.error("getCuratedGenreCounts error:", err);
    return [];
  }
}

// Cache aggressively — curated tag counts are extremely stable
export const getCuratedGenreCounts = memoize(
  "curated-genres",
  _getCuratedGenreCounts,
  60 * 60 * 1000 // 1h
);

// ---------------------------------------------------------------------------
// Video of the Day — deterministic pick per UTC day from the top 500 by score
// ---------------------------------------------------------------------------

function hashDayToIndex(date: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0;
  return Math.abs(h) % modulo;
}

async function _getVideoOfTheDay(): Promise<Video | null> {
  try {
    const { rows } = await pool.query(
      `SELECT source, source_id, slug, url, page_url, site, title,
              thumbnail, preview, score, favorites,
              tags, characters, copyrights, artists,
              width, height, file_size, duration, created_at
       FROM videos
       WHERE thumbnail IS NOT NULL AND thumbnail <> ''
         AND NOT (tags && $1::text[])
       ORDER BY score DESC
       LIMIT 500`,
      [BANNED_TAGS_ARRAY]
    );
    if (rows.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const idx = hashDayToIndex(today, rows.length);
    return rowToVideo(rows[idx]);
  } catch (err) {
    console.error("getVideoOfTheDay error:", err);
    return null;
  }
}

// Memoize 1h — the "day" doesn't change that often
export const getVideoOfTheDay = memoize("vod", _getVideoOfTheDay, 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// User library — favorites + history fetched from PG for logged-in users
// ---------------------------------------------------------------------------

const USER_VIDEO_SELECT = `
  SELECT v.source, v.source_id, v.slug, v.url, v.page_url, v.site, v.title,
         v.thumbnail, v.preview, v.score, v.favorites,
         v.tags, v.characters, v.copyrights, v.artists,
         v.width, v.height, v.file_size, v.duration, v.created_at
`;

/** Fetch a logged-in user's favorites as full Video objects, newest first. */
export async function getUserFavorites(userId: string | number): Promise<Video[]> {
  try {
    const { rows } = await pool.query(
      `${USER_VIDEO_SELECT}
       FROM videos v
       JOIN user_favorites f ON v.slug = f.video_slug
       WHERE f.user_id = $1
         AND NOT (v.tags && $2::text[])
       ORDER BY f.created_at DESC
       LIMIT 500`,
      [userId, BANNED_TAGS_ARRAY]
    );
    return rows.map(rowToVideo);
  } catch (err) {
    console.error("getUserFavorites error:", err);
    return [];
  }
}

/** Fetch a logged-in user's watch history as full Video objects, newest first. */
export async function getUserHistory(userId: string | number): Promise<Video[]> {
  try {
    const { rows } = await pool.query(
      `${USER_VIDEO_SELECT}, h.watched_at
       FROM videos v
       JOIN user_history h ON v.slug = h.video_slug
       WHERE h.user_id = $1
         AND NOT (v.tags && $2::text[])
       ORDER BY h.watched_at DESC
       LIMIT 500`,
      [userId, BANNED_TAGS_ARRAY]
    );
    return rows.map(rowToVideo);
  } catch (err) {
    console.error("getUserHistory error:", err);
    return [];
  }
}
