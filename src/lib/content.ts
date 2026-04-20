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
  "loli",
  "lolicon",
  "lolidom",
  "loli_focus",
  "shota",
  "shotacon",
  "shotadom",
  "shota_focus",
  "child",
  "children",
  "minor",
  "underage",
  "toddler",
  "toddlercon",
  "infant",
  "young_girl",
  "young_boy",
  "child_on_child",
  "cub",
  "baby",
  "oppai_loli",
  "legal_loli",
  "elementary_school",
  "kindergarten",
  "randoseru",
]);

export const BANNED_TAGS_ARRAY = Array.from(BANNED_TAGS);

/**
 * Returns true if a single tag/character/series slug should NEVER be exposed
 * as a taxonomy URL. Used by /tag/[tag], /character/[slug], /series/[slug] to
 * 404 banned terms before rendering an empty SEO-indexable shell page.
 *
 * Without this, Google indexes pages titled "Loli Hentai Videos | iku.gg" even
 * though the grid is empty — which torches brand safety, ad-network approval,
 * and is just legally bad.
 */
export function isBannedTag(slug: string): boolean {
  if (!slug) return false;
  const s = slug.toLowerCase();
  if (BANNED_TAGS.has(s)) return true;
  return BANNED_WORD_RE.test(` ${s.replace(/-/g, "_")} `);
}

// Substring patterns for title/slug scanning. Intentionally broad because
// Danbooru/Gelbooru embed these words in titles even when they're not in
// general tags. A positive match on any of these kills the row.
/** Words that must appear as whole words (word-boundary match) to avoid
 *  false positives like "hololive" matching "loli". Limited to unambiguous
 *  terms for slug/title scanning. Ambiguous words like "child" / "baby" /
 *  "cub" are still blocked when they appear as explicit tags (array check). */
const BANNED_WORD_RE =
  /(?:^|[\s_\-/])(?:loli|shota|lolicon|shotacon|toddlercon|toddler|lolidom|shotadom|oppai[_ ]loli|legal[_ ]loli|young[_ ]girl|young[_ ]boy|kindergarten)(?:$|[\s_\-/])/i;

/**
 * Check if a single video contains banned content.
 *
 * Checks ALL the places source APIs classify subjects, not just general tags:
 *   - tags, characters, copyrights (array columns)
 *   - title and slug (substring scan)
 *
 * This is the function of last resort before rendering to a user. It MUST be
 * called anywhere a Video object leaves the DB layer (related grids, live API
 * fetches, direct lookups by slug, etc.).
 */
export function containsBannedContent(video: {
  tags?: string[];
  characters?: string[];
  copyrights?: string[];
  slug?: string;
  title?: string | null;
}): boolean {
  const lists: string[][] = [
    video.tags ?? [],
    video.characters ?? [],
    video.copyrights ?? [],
  ];
  for (const list of lists) {
    for (const t of list) {
      if (BANNED_TAGS.has(t.toLowerCase())) return true;
    }
  }
  const hay = ` ${video.slug ?? ""} ${video.title ?? ""} `.toLowerCase();
  if (hay.trim()) {
    if (BANNED_WORD_RE.test(hay)) return true;
  }
  return false;
}

/**
 * Filter an array of videos, removing any that contain banned content.
 * Used as a JS-side belt-and-suspenders check after SQL queries and for
 * live-API results (Danbooru getRelatedPosts, etc.) that bypass the DB.
 */
export function filterBannedContent<
  T extends {
    tags?: string[];
    characters?: string[];
    copyrights?: string[];
    slug?: string;
    title?: string | null;
  },
>(videos: T[]): T[] {
  return videos.filter((v) => !containsBannedContent(v));
}

/**
 * Build a set of SQL conditions that exclude banned content for a videos table
 * row (optionally prefixed with an alias like `v.`). Pushes the shared
 * BANNED_TAGS_ARRAY parameter ONCE and reuses its index across all three
 * array-column checks. Returns `{ condition, nextIdx }`.
 */
export function buildBannedSqlCondition(
  alias: string,
  params: unknown[],
  startIdx: number,
): { condition: string; nextIdx: number } {
  params.push(BANNED_TAGS_ARRAY);
  const p = `$${startIdx}::text[]`;
  const a = alias ? `${alias}.` : "";
  const condition = `NOT (${a}tags && ${p}) AND NOT (COALESCE(${a}characters, ARRAY[]::text[]) && ${p}) AND NOT (COALESCE(${a}copyrights, ARRAY[]::text[]) && ${p})`;
  return { condition, nextIdx: startIdx + 1 };
}

// ---------------------------------------------------------------------------
// Thumbnail lookup from PostgreSQL
// ---------------------------------------------------------------------------

/** Get the best thumbnail for a tag (character name, series name, etc.) from database */
async function _getThumbnailForTag(tag: string): Promise<string> {
  try {
    // Search ALL sources — previously restricted to danbooru/gelbooru which
    // meant characters only present in rule34/rule34video returned empty
    // thumbnails and the card fell back to initials. We still rank by score
    // so the best available thumbnail wins.
    const { rows } = await pool.query(
      `SELECT thumbnail, source FROM videos
       WHERE thumbnail != ''
         AND ($1 = ANY(characters) OR $1 = ANY(copyrights) OR $1 = ANY(tags))
         AND NOT (tags && $2::text[])
         AND NOT (COALESCE(characters, ARRAY[]::text[]) && $2::text[])
         AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $2::text[])
       ORDER BY score DESC
       LIMIT 1`,
      [tag.toLowerCase(), BANNED_TAGS_ARRAY],
    );

    if (rows.length === 0 || !rows[0].thumbnail) return "";
    const raw = rows[0].thumbnail as string;
    // Only upgrade size for danbooru URLs — gelbooru/rule34/etc use different
    // thumbnail paths and the replacements would break them.
    if (rows[0].source === "danbooru" && raw.includes("/180x180/")) {
      return raw.replace("/180x180/", "/720x720/").replace(/\.jpg$/, ".webp");
    }
    return raw;
  } catch {
    return "";
  }
}
// Memoize — tag→thumbnail mapping is very stable, 1h TTL is safe
export const getThumbnailForTag = memoize(
  "thumb-for-tag",
  _getThumbnailForTag,
  60 * 60 * 1000,
);

/** Get thumbnails for multiple tags at once (batch) */
export async function getThumbnailsForTags(
  tags: string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    tags.map(async (tag) => {
      result[tag] = await getThumbnailForTag(tag);
    }),
  );
  return result;
}

// ---------------------------------------------------------------------------
// Main query interface
// ---------------------------------------------------------------------------

export interface GetVideosOptions {
  limit?: number;
  page?: number;
  order?: "score" | "date" | "favcount" | "duration";
  tags?: string;
  source?: "all" | "danbooru" | "gelbooru";
  /**
   * High-level catalogue vertical split.
   * - `hentai` = animated 2D hentai (hentaicity + hentaigasm + wp + danbooru).
   *   Cible le keyword "hentai" au sens classique (OAV, épisodes 2D anime).
   * - `3d` = 3D rule34 / SFM / game porn (rule34video + rule34 + gelbooru).
   *   Cible les keywords "3d hentai", "3d porn", "cartoon porn", per-game,
   *   per-character (Genshin, Overwatch, Chun-Li, etc.).
   * - `all` = tout le catalogue mélangé (défaut).
   */
  vertical?: "all" | "hentai" | "3d";
  /** Exclude videos without a thumbnail (WP sources). Use on homepage/carousels. */
  requireThumbnail?: boolean;
  /**
   * Long-format only: source IN (hentaicity, hentaigasm) OR duration >= 600s.
   * Used by /episodes landing — same predicate the Pro gate uses on /watch
   * so the listing matches what's actually behind the paywall.
   */
  longFormat?: boolean;
}

/** Source groups backing the `vertical` filter. Add new scraper outputs here
 *  when they're onboarded. */
export const VERTICAL_SOURCES = {
  hentai: ["hentaicity", "hentaigasm", "wp", "danbooru"] as const,
  "3d": ["rule34video", "rule34", "gelbooru"] as const,
} as const;

/** Map a database row to a Video object */
function rowToVideo(row: Record<string, unknown>): Video {
  return {
    id: row.source_id as number,
    pk: typeof row.pk === "number" ? row.pk : undefined,
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
    pageUrl: (row.page_url as string) || undefined,
  };
}

/**
 * Fetch videos from PostgreSQL with filtering, sorting, and pagination.
 * Banned content is excluded at the SQL level (never leaves the database).
 */
async function _getVideos(
  options: GetVideosOptions = {},
): Promise<PaginatedResult<Video>> {
  const {
    limit = 20,
    page = 1,
    order = "score",
    tags = "",
    source = "all",
    vertical = "all",
    requireThumbnail = false,
    longFormat = false,
  } = options;

  const clampedLimit = Math.min(limit, 200);
  const offset = (page - 1) * clampedLimit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Banned content filter (always applied) — checks tags, characters, copyrights
  const banned = buildBannedSqlCondition("", params, paramIndex);
  conditions.push(banned.condition);
  paramIndex = banned.nextIdx;

  // Dead-source filter — source removed the video (marked by batch scanner
  // or by the player's onError POST to /api/mark-dead). Pages stay reachable
  // via /watch/[slug] for SEO, but they won't appear in listings.
  conditions.push(`dead_at IS NULL`);

  // Thumbnail filter — hide WP entries that still lack a poster image
  if (requireThumbnail) {
    conditions.push(`thumbnail IS NOT NULL AND thumbnail <> ''`);
  }

  // Source filter (single source)
  if (source === "danbooru") {
    conditions.push(`source = $${paramIndex}`);
    params.push("danbooru");
    paramIndex++;
  } else if (source === "gelbooru") {
    conditions.push(`source = $${paramIndex}`);
    params.push("gelbooru");
    paramIndex++;
  }

  // Vertical filter (group of sources — used by /hentai and /3d routes).
  // Only applies when `source` isn't already restricting.
  if (source === "all" && vertical !== "all") {
    const group = VERTICAL_SOURCES[vertical];
    conditions.push(`source = ANY($${paramIndex}::text[])`);
    params.push(group as readonly string[] as string[]);
    paramIndex++;
  }

  // Long-format: hentaicity + hentaigasm only on the listing.
  if (longFormat) {
    conditions.push(`source IN ('hentaicity','hentaigasm')`);
  }

  // Tag/character/copyright search — rewritten 2026-04-18 as a CTE UNION
  // because the previous `(tags && X OR characters && X OR copyrights && X)`
  // form defeated the bitmap planner. With a matching tag (e.g. "naruto")
  // PG would pick "Index Scan on idx_videos_score + filter", scanning
  // 362K rows end-to-end — 12+s. The UNION pattern forces a BitmapOr across
  // the three GIN indexes (30-100ms) → JOIN back → sort. Previously also
  // had a title ILIKE fallback; that seq-scanned 350K rows on every hit
  // and has been dropped because tag lists are auto-generated from these
  // same arrays (no coverage loss).
  const searchTerms = tags
    ? tags.toLowerCase().split(/\s+/).filter(Boolean)
    : [];
  let hasMatchesCte = false;
  let cteClause = "";
  if (searchTerms.length >= 1) {
    // Build N per-term CTEs (m1, m2, ...) each forcing a BitmapOr across the
    // three GIN indexes, then INTERSECT them into `matches`. The single-term
    // path is a special case of this — no INTERSECT needed. The previous
    // multi-term fallback used an inline `(tags && A OR ...) AND (tags && B OR ...)`
    // form that defeated the planner: PG switched to idx_videos_score + filter
    // and scanned 362K rows, timing out the container and triggering PG
    // restarts under load (2026-04-20 auto-heal).
    const termCteNames: string[] = [];
    searchTerms.forEach((term, i) => {
      const idx = paramIndex;
      params.push(term);
      paramIndex++;
      const name = `m${i + 1}`;
      termCteNames.push(name);
      const cte = `${name} AS MATERIALIZED (
        SELECT pk FROM videos WHERE tags && ARRAY[$${idx}]::text[]
        UNION
        SELECT pk FROM videos WHERE characters && ARRAY[$${idx}]::text[]
        UNION
        SELECT pk FROM videos WHERE copyrights && ARRAY[$${idx}]::text[]
      )`;
      cteClause += (cteClause ? ", " : "WITH ") + cte;
    });
    cteClause +=
      ", matches AS MATERIALIZED (" +
      termCteNames.map((n) => `SELECT pk FROM ${n}`).join(" INTERSECT ") +
      ")";
    hasMatchesCte = true;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const orderClause =
    order === "score"
      ? "ORDER BY score DESC, created_at DESC"
      : order === "favcount"
        ? "ORDER BY favorites DESC, score DESC"
        : order === "duration"
          ? "ORDER BY duration DESC NULLS LAST, score DESC"
          : "ORDER BY created_at DESC";

  const query = hasMatchesCte
    ? `${cteClause}
         SELECT v.pk, v.source, v.source_id, v.slug, v.url, v.page_url, v.site, v.title,
                v.thumbnail, v.preview, v.score, v.favorites,
                v.tags, v.characters, v.copyrights, v.artists,
                v.width, v.height, v.file_size, v.duration, v.created_at
         FROM videos v JOIN matches m ON m.pk = v.pk
         ${whereClause
           .replace(/\btags\b/g, "v.tags")
           .replace(/\bthumbnail\b/g, "v.thumbnail")
           .replace(/\bsource\b/g, "v.source")}
         ${orderClause
           .replace(/\bscore\b/g, "v.score")
           .replace(/\bcreated_at\b/g, "v.created_at")
           .replace(/\bfavorites\b/g, "v.favorites")
           .replace(/\bduration\b/g, "v.duration")}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    : `SELECT pk, source, source_id, slug, url, page_url, site, title,
                thumbnail, preview, score, favorites,
                tags, characters, copyrights, artists,
                width, height, file_size, duration, created_at
         FROM videos
         ${whereClause}
         ${orderClause}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(clampedLimit + 1, offset);

  // NOTE: this function deliberately does NOT catch PG errors. If the query
  // fails (timeout, connection drop, etc.) we re-throw so the memoize wrapper
  // above DOESN'T cache a bogus empty result for 5 minutes. The `getVideos`
  // public wrapper below catches at the boundary and returns empty to
  // callers — that way the empty response is only a per-request fallback,
  // not a 5-min cached poison pill.
  //
  // Perf guard (2026-04-18): wrap in a 3s per-query timeout. Planner picks
  // a bad "incremental sort over idx_videos_score" plan for certain tag
  // filters (e.g. tags that match 0 rows), scanning 362K rows before
  // giving up. Failing at 3s + empty fallback beats 10s of wasted TTFB.
  const client = await pool.connect();
  let rows: Record<string, unknown>[];
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = '3s'`);
    const res = await client.query(query, params);
    await client.query("COMMIT");
    rows = res.rows;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* already rolled back by PG on timeout */
    }
    throw err;
  } finally {
    client.release();
  }
  const mapped = rows.slice(0, clampedLimit).map(rowToVideo);
  // JS-side belt-and-suspenders: catches banned title/slug that SQL arrays miss
  const data = filterBannedContent(mapped);
  const hasMore = rows.length > clampedLimit;
  return { data, hasMore };
}

// Memoize — 30 min TTL. Longer window prevents cold-hit spikes (13-18s
// TTFB on /hentai, /3d, /tag/*, /character/*) seen in the 20-persona
// sim on 2026-04-17. Stale-while-revalidate means users past the first
// hit always see a warm response while the refresh runs in the background.
const _getVideosMemo = memoize("videos", _getVideos, 30 * 60 * 1000);

/**
 * Public getVideos — catches PG errors at the boundary so callers always
 * get a valid PaginatedResult. The underlying memoize only caches SUCCESSFUL
 * results; failures are re-thrown inside _getVideos, memoize deletes the
 * failed key, and this wrapper returns an empty page to the caller.
 * Fixes the "poisoned cache" bug where a single PG timeout during warmup
 * could wedge `/tag/<xxx>` into serving "0 videos" for 5 minutes.
 */
export async function getVideos(
  opts: GetVideosOptions = {},
): Promise<PaginatedResult<Video>> {
  try {
    return await _getVideosMemo(opts);
  } catch (err) {
    console.error("getVideos fallback:", err);
    return { data: [], hasMore: false };
  }
}

/**
 * Count total matching videos for a given filter combo. Uses the same
 * WHERE-clause builder as _getVideos so pagination totals always agree
 * with the visible results. Memoized 1h — counts move slowly enough
 * that stale-by-an-hour is fine, and pagination numbers on /hentai,
 * /3d, /trending etc. get hammered by crawlers.
 *
 * Perf guard (2026-04-18): wraps the count in a per-query 3s statement
 * timeout. /3d spans ~320K rows and the COUNT(*) scan was timing out
 * at the default 10s PG session timeout, stalling every cold hit by
 * a full 10 seconds before falling back to 0. On timeout we return
 * a reltuples-based estimate so pagination UI still renders instantly.
 */

// Rough per-vertical selectivity for the fallback estimate. Derived from
// `SELECT source, COUNT(*) FROM videos GROUP BY source` on 2026-04-18.
// Tracks the (vertical, requireThumbnail) combo used by /hentai and /3d.
const VERTICAL_ESTIMATE: Record<string, number> = {
  "hentai:true": 42000,
  "hentai:false": 42000,
  "3d:true": 300000,
  "3d:false": 320000,
  "longFormat:true": 7000,
  "longFormat:false": 7000,
  "all:true": 340000,
  "all:false": 361000,
};

function estimateCount(opts: GetVideosOptions): number {
  const { vertical = "all", longFormat, requireThumbnail, tags } = opts;
  const thumbKey = requireThumbnail ? "true" : "false";
  // Tag-scoped estimate: long-tail tags (not in precompute) are typically
  // under 2000 videos. Return a safe upper bound so pagination renders as
  // "up to 100 pages" — users clicking past real results get an empty
  // page, but we never stall PG on a 400K-row COUNT scan.
  if (tags && tags.trim()) return 2000;
  if (longFormat) return VERTICAL_ESTIMATE[`longFormat:${thumbKey}`];
  return (
    VERTICAL_ESTIMATE[`${vertical}:${thumbKey}`] ??
    VERTICAL_ESTIMATE[`all:${thumbKey}`]
  );
}

// Key format must match scripts/precompute-video-counts.sql.
function buildCountCacheKey(opts: GetVideosOptions): string {
  const vertical = opts.vertical ?? "all";
  const source = opts.source ?? "all";
  const rt = opts.requireThumbnail ? 1 : 0;
  const lf = opts.longFormat ? 1 : 0;
  const tags = (opts.tags ?? "").trim().toLowerCase();
  return `v=${vertical}|s=${source}|rt=${rt}|lf=${lf}|t=${tags}`;
}

// Read the precomputed count from videos_count_cache. Returns null if missing
// or stale (>2h). Base listing combos always covered; the top 100 tags are
// also cached (with requireThumbnail=1) by the SQL cron, so /tag/<popular>
// pages skip the 362K-row seq scan.
async function readPrecomputedCount(
  opts: GetVideosOptions,
): Promise<number | null> {
  if (opts.source !== "all" && opts.source !== undefined) return null;
  const key = buildCountCacheKey(opts);
  try {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count::text FROM videos_count_cache
        WHERE key = $1 AND computed_at > NOW() - INTERVAL '2 hours'`,
      [key],
    );
    if (rows.length === 0) return null;
    return Number(rows[0].count);
  } catch {
    return null;
  }
}

async function _countVideos(options: GetVideosOptions = {}): Promise<number> {
  // Precomputed cache covers: all base vertical × requireThumbnail × longFormat
  // combos + the top ~100 tags by popularity (see scripts/precompute-video-counts.ts
  // and .sql). A hit here is the fast path — a single indexed PG lookup.
  const precomputed = await readPrecomputedCount(options);
  if (precomputed !== null) return precomputed;

  // Cache miss. Never run the live COUNT(*) — even with a 500ms statement
  // timeout, each failed query burns 500ms × 4 parallel workers of CPU
  // and under a traffic burst across long-tail tag/character/series pages
  // that thundering herd saturates PG and triggers cascading pool timeouts
  // + connection drops ("PG restart every 15min" incident 2026-04-19).
  // Return an estimate so pagination UI still renders; the precompute
  // cron (every 15min) converts frequent misses into hits over time.
  return estimateCount(options);
}

const _countVideosMemo = memoize("videos-count", _countVideos, 60 * 60 * 1000);

export async function countVideos(
  opts: GetVideosOptions = {},
): Promise<number> {
  try {
    return await _countVideosMemo(opts);
  } catch (err) {
    console.error("countVideos fallback:", err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Curated genre tags for the homepage "Browse by Genre" section.
// These are deliberately chosen to be "sexy" / genre-ish, not generic
// descriptors like "1girl" or "solo".
// ---------------------------------------------------------------------------

export const CURATED_GENRES: { name: string; emoji: string }[] = [
  { name: "anal", emoji: "🍑" },
  { name: "uncensored", emoji: "🔥" },
  { name: "vanilla", emoji: "💗" },
  { name: "3d", emoji: "🎮" },
  { name: "monster", emoji: "👹" },
  { name: "fantasy", emoji: "🧚" },
  { name: "schoolgirl", emoji: "🎒" },
  { name: "maid", emoji: "🎀" },
  { name: "futa", emoji: "✨" },
  { name: "milf", emoji: "💋" },
  { name: "elf", emoji: "🧝" },
  { name: "catgirl", emoji: "🐱" },
  { name: "tentacles", emoji: "🐙" },
  { name: "cosplay", emoji: "👗" },
  { name: "bondage", emoji: "⛓️" },
  { name: "group", emoji: "👥" },
  { name: "ahegao", emoji: "😵" },
  { name: "creampie", emoji: "🍦" },
  { name: "oral", emoji: "👄" },
  { name: "threesome", emoji: "3️⃣" },
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
           AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
           AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
       ) t
       WHERE tag = ANY($2::text[])
       GROUP BY tag`,
      [BANNED_TAGS_ARRAY, names],
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
  60 * 60 * 1000, // 1h
);

// ---------------------------------------------------------------------------
// Popular tags / characters / copyrights — PG-backed, used by /tags, /character,
// /series index pages. Previously these called the live Danbooru API via
// src/lib/danbooru.ts which was slow AND fragile (if Danbooru is down, /tags
// renders blank or errors). Now they run a single GROUP BY on unnest(tags)
// against our 346K-row local DB, with memoize on top.
// ---------------------------------------------------------------------------

export interface TagCount {
  name: string;
  count: number;
}

async function _getPopularTagsFromPg(limit: number): Promise<TagCount[]> {
  try {
    const { rows } = await pool.query(
      `SELECT tag, COUNT(*)::int AS count
       FROM (
         SELECT unnest(tags) AS tag FROM videos
         WHERE NOT (tags && $1::text[])
           AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
           AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
       ) t
       WHERE tag <> ''
       GROUP BY tag
       ORDER BY count DESC
       LIMIT $2`,
      [BANNED_TAGS_ARRAY, limit],
    );
    return rows.map((r) => ({
      name: r.tag as string,
      count: r.count as number,
    }));
  } catch (err) {
    console.error("getPopularTagsFromPg error:", err);
    return [];
  }
}

// Memoize with a cache key that includes the limit so different callers
// don't collide. TTL is 1h because tag popularity drifts slowly.
const _popularTagsCache = memoize(
  "popular-tags-pg",
  async (limit: number) => _getPopularTagsFromPg(limit),
  60 * 60 * 1000,
);

export async function getPopularTags(limit: number = 60): Promise<TagCount[]> {
  return _popularTagsCache(limit);
}

async function _getPopularCharactersFromPg(limit: number): Promise<TagCount[]> {
  try {
    const { rows } = await pool.query(
      `SELECT character, COUNT(*)::int AS count
       FROM (
         SELECT unnest(characters) AS character FROM videos
         WHERE NOT (tags && $1::text[])
           AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
           AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
           AND characters IS NOT NULL
           AND array_length(characters, 1) > 0
       ) t
       WHERE character <> ''
       GROUP BY character
       ORDER BY count DESC
       LIMIT $2`,
      [BANNED_TAGS_ARRAY, limit],
    );
    return rows.map((r) => ({
      name: r.character as string,
      count: r.count as number,
    }));
  } catch (err) {
    console.error("getPopularCharactersFromPg error:", err);
    return [];
  }
}

const _popularCharactersCache = memoize(
  "popular-characters-pg",
  async (limit: number) => _getPopularCharactersFromPg(limit),
  60 * 60 * 1000,
);

export async function getPopularCharactersPg(
  limit: number = 40,
): Promise<TagCount[]> {
  return _popularCharactersCache(limit);
}

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
      `SELECT pk, source, source_id, slug, url, page_url, site, title,
              thumbnail, preview, score, favorites,
              tags, characters, copyrights, artists,
              width, height, file_size, duration, created_at
       FROM videos
       WHERE thumbnail IS NOT NULL AND thumbnail <> ''
         AND NOT (tags && $1::text[])
         AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
         AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
       ORDER BY score DESC
       LIMIT 500`,
      [BANNED_TAGS_ARRAY],
    );
    if (rows.length === 0) return null;
    // JS-side filter catches banned title/slug substrings
    const clean = filterBannedContent(rows.map(rowToVideo));
    if (clean.length === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    const idx = hashDayToIndex(today, clean.length);
    return clean[idx];
  } catch (err) {
    console.error("getVideoOfTheDay error:", err);
    return null;
  }
}

// Memoize 1h — the "day" doesn't change that often
export const getVideoOfTheDay = memoize(
  "vod",
  _getVideoOfTheDay,
  60 * 60 * 1000,
);

// ---------------------------------------------------------------------------
// Single-video lookup by id+source (used by watch page to avoid live API calls)
// ---------------------------------------------------------------------------

/**
 * Fetch a Danbooru video from PG first, fall back to the live Danbooru API
 * only if the row isn't in the DB yet (brand-new posts that our scraper
 * hasn't picked up). This kills 200-1500ms of throttled external latency on
 * the overwhelming majority of watch-page renders — see performance.md P1.
 *
 * The `liveFallback` param lets callers opt out of the external call entirely
 * (e.g. metadata generation) to keep cold renders snappy at the cost of
 * serving a generic "Hentai Video" title on unscraped posts.
 */
async function _getDanbooruVideo(
  id: number,
  liveFallback: boolean,
): Promise<Video | null> {
  try {
    const { rows } = await pool.query(
      `SELECT pk, source, source_id, slug, url, page_url, site, title,
              thumbnail, preview, score, favorites,
              tags, characters, copyrights, artists,
              width, height, file_size, duration, created_at
       FROM videos
       WHERE source = 'danbooru' AND source_id = $1
         AND NOT (tags && $2::text[])
         AND NOT (COALESCE(characters, ARRAY[]::text[]) && $2::text[])
         AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $2::text[])
       LIMIT 1`,
      [id, BANNED_TAGS_ARRAY],
    );
    if (rows.length > 0) {
      const video = rowToVideo(rows[0]);
      if (containsBannedContent(video)) return null;
      return video;
    }
  } catch (err) {
    console.error("getDanbooruVideo PG error:", err);
  }

  // Not in PG — optionally fall back to the live Danbooru API for fresh posts.
  if (!liveFallback) return null;
  try {
    const { getPost } = await import("./danbooru");
    const live = await getPost(id);
    if (live && !containsBannedContent(live)) return live;
  } catch {
    // fall through to null
  }
  return null;
}
const _getDanbooruVideoMemo = memoize(
  "danbooru-video",
  _getDanbooruVideo,
  5 * 60 * 1000,
);

export async function getDanbooruVideo(
  id: number,
  opts: { liveFallback?: boolean } = {},
): Promise<Video | null> {
  return _getDanbooruVideoMemo(id, opts.liveFallback ?? false);
}

// ---------------------------------------------------------------------------
// Dead-video lookup — surfaces dead_at to /watch metadata so we can render
// noindex on URLs whose source video has been pulled. Not a 404: the page
// still renders with auto-skip fallback so existing visitors aren't blocked,
// but we tell Google to drop the URL on next crawl.
// ---------------------------------------------------------------------------

async function _isVideoDeadBySlug(slug: string): Promise<boolean> {
  const { rows } = await pool.query<{ dead_at: Date | null }>(
    `SELECT dead_at FROM videos WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return rows.length > 0 && rows[0].dead_at !== null;
}
// Memoize 5min so generateMetadata + page render share one PG hit per slug.
export const isVideoDeadBySlug = memoize(
  "video-dead-by-slug",
  _isVideoDeadBySlug,
  5 * 60 * 1000,
);

// ---------------------------------------------------------------------------
// Keyset pagination for /api/feed — infinite scroll without OFFSET hell
// ---------------------------------------------------------------------------

export interface FeedCursor {
  /** Primary sort value at the last row returned. */
  v: number;
  /** Tiebreaker id at the last row returned. */
  id: number;
  /** Sort column — ensures the cursor stays tied to a stable sort order. */
  order: "score" | "date" | "favcount" | "duration";
}

/** Encode a cursor as a URL-safe base64 string. */
export function encodeCursor(c: FeedCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

/** Decode a cursor, returning null on any parse error. */
export function decodeCursor(
  raw: string | null | undefined,
): FeedCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed?.v === "number" &&
      typeof parsed?.id === "number" &&
      (parsed?.order === "score" ||
        parsed?.order === "date" ||
        parsed?.order === "favcount" ||
        parsed?.order === "duration")
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Pick a random starting cursor for the feed. Used on first page requests
 * to ensure refreshing /feed shows different videos each time.
 *
 * Strategy: query a single row at a random OFFSET inside the top N rows
 * (where N = max, default 5000) using the same sort/filter as the main
 * query. That one row's sort value + id becomes the synthetic cursor that
 * the main query uses as its starting point. Subsequent pagination is
 * deterministic forward progress from there.
 *
 * Cost: one indexed LIMIT 1 OFFSET X query. Postgres skips X rows via the
 * index without reading them — fast even on 351K total rows.
 */
async function pickRandomStartCursor(opts: {
  order: "score" | "date" | "favcount" | "duration";
  source: "all" | "danbooru" | "gelbooru";
  tags: string;
  requireThumbnail: boolean;
  max: number;
}): Promise<FeedCursor | null> {
  const { order, source, tags, requireThumbnail, max } = opts;
  const offset = Math.floor(Math.random() * max);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  const banned = buildBannedSqlCondition("", params, p);
  conditions.push(banned.condition);
  p = banned.nextIdx;

  conditions.push(`dead_at IS NULL`);

  if (requireThumbnail) {
    conditions.push(`thumbnail IS NOT NULL AND thumbnail <> ''`);
  }
  if (source === "danbooru") {
    conditions.push(`source = $${p}`);
    params.push("danbooru");
    p++;
  } else if (source === "gelbooru") {
    conditions.push(`source = $${p}`);
    params.push("gelbooru");
    p++;
  }
  if (tags) {
    const terms = tags.toLowerCase().split(/\s+/).filter(Boolean);
    for (const term of terms) {
      conditions.push(
        `($${p} = ANY(tags) OR $${p} = ANY(characters) OR $${p} = ANY(copyrights))`,
      );
      params.push(term);
      p++;
    }
  }

  const sortCol =
    order === "score"
      ? "score"
      : order === "favcount"
        ? "favorites"
        : order === "duration"
          ? "duration"
          : "created_at";
  const sortExpr =
    order === "date" ? `EXTRACT(EPOCH FROM ${sortCol})::bigint` : sortCol;

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  params.push(offset);
  const query = `
    SELECT ${sortExpr} AS v, source_id AS id
    FROM videos
    ${whereClause}
    ORDER BY ${sortCol} DESC, source_id DESC
    LIMIT 1 OFFSET $${p}
  `;

  try {
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return null;
    return {
      v: Number(rows[0].v),
      id: Number(rows[0].id),
      order,
    };
  } catch (err) {
    console.error("pickRandomStartCursor error:", err);
    return null;
  }
}

/**
 * Keyset-paginated fetch used by the Shorts feed. Avoids OFFSET entirely so
 * deep scrolls stay O(log n) on the sort index instead of O(n).
 *
 * Composite tuple comparison: for DESC order, the next page is rows where
 *   (sort_col, id) < (cursor.v, cursor.id)
 * which resolves ties via `id` and guarantees forward progress even when
 * many rows share the same sort value (common with `favorites=0`).
 */
export async function getFeedKeyset(options: {
  limit?: number;
  order?: "score" | "date" | "favcount" | "duration";
  cursor?: FeedCursor | null;
  tags?: string;
  source?: "all" | "danbooru" | "gelbooru";
  requireThumbnail?: boolean;
  /**
   * When `cursor` is null AND `randomStart` is true, the function picks a
   * random starting offset inside the top N rows (default 5000) and
   * synthesizes an initial cursor from that. Result: refreshing /feed shows
   * a different slice each time, without paying the cost of a full random
   * shuffle. Uses LIMIT 1 OFFSET N on the indexed sort — single index probe,
   * fast even on 351K rows.
   */
  randomStart?: boolean;
  randomStartMax?: number;
}): Promise<{ data: Video[]; nextCursor: FeedCursor | null }> {
  const {
    limit = 60,
    order = "score",
    cursor: inputCursor = null,
    tags = "",
    source = "all",
    requireThumbnail = false,
    randomStart = false,
    randomStartMax = 5000,
  } = options;

  const clampedLimit = Math.min(limit, 200);

  // Resolve the effective cursor: either the user-provided one, or a random
  // synthetic start if requested and the user didn't provide a cursor.
  let cursor: FeedCursor | null = inputCursor;
  if (!cursor && randomStart) {
    cursor = await pickRandomStartCursor({
      order,
      source,
      tags,
      requireThumbnail,
      max: randomStartMax,
    });
    // If the random probe failed (empty table, etc.), fall through with null
    // cursor — the regular query will just return the top rows.
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  // Banned content filter (tags, characters, copyrights).
  const banned = buildBannedSqlCondition("", params, p);
  conditions.push(banned.condition);
  p = banned.nextIdx;

  conditions.push(`dead_at IS NULL`);

  if (requireThumbnail) {
    conditions.push(`thumbnail IS NOT NULL AND thumbnail <> ''`);
  }

  if (source === "danbooru") {
    conditions.push(`source = $${p}`);
    params.push("danbooru");
    p++;
  } else if (source === "gelbooru") {
    conditions.push(`source = $${p}`);
    params.push("gelbooru");
    p++;
  }

  if (tags) {
    const terms = tags.toLowerCase().split(/\s+/).filter(Boolean);
    for (const term of terms) {
      conditions.push(
        `($${p} = ANY(tags) OR $${p} = ANY(characters) OR $${p} = ANY(copyrights))`,
      );
      params.push(term);
      p++;
    }
  }

  // Sort column + composite cursor clause.
  const sortCol =
    order === "score"
      ? "score"
      : order === "favcount"
        ? "favorites"
        : order === "duration"
          ? "duration"
          : "created_at";

  const sortExpr =
    order === "date" ? `EXTRACT(EPOCH FROM ${sortCol})::bigint` : sortCol;

  if (cursor && cursor.order === order) {
    // Composite tuple comparison: rows strictly after the cursor in DESC order.
    conditions.push(`(${sortExpr}, source_id) < ($${p}, $${p + 1})`);
    params.push(cursor.v, cursor.id);
    p += 2;
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  const orderClause = `ORDER BY ${sortCol} DESC, source_id DESC`;

  params.push(clampedLimit + 1);
  const query = `
    SELECT pk, source, source_id, slug, url, page_url, site, title,
           thumbnail, preview, score, favorites,
           tags, characters, copyrights, artists,
           width, height, file_size, duration, created_at,
           ${sortExpr} AS __sort_val
    FROM videos
    ${whereClause}
    ${orderClause}
    LIMIT $${p}
  `;

  try {
    const { rows } = await pool.query(query, params);
    const slice = rows.slice(0, clampedLimit);
    const data = filterBannedContent(slice.map(rowToVideo));

    let nextCursor: FeedCursor | null = null;
    if (rows.length > clampedLimit) {
      const last = slice[slice.length - 1];
      if (last) {
        nextCursor = {
          v: Number(last.__sort_val),
          id: Number(last.source_id),
          order,
        };
      }
    }

    return { data, nextCursor };
  } catch (err) {
    console.error("getFeedKeyset PG error:", err);
    return { data: [], nextCursor: null };
  }
}

// ---------------------------------------------------------------------------
// Related videos — PG-backed, source-agnostic (replaces Danbooru getRelatedPosts)
// ---------------------------------------------------------------------------

/**
 * Fetch videos related to the given video using its character/copyright/tag
 * signals. Unlike the old Danbooru-only getRelatedPosts, this queries PG so it
 * works for all 5 sources (Danbooru, Gelbooru, Rule34, Rule34Video, WP) and
 * respects the banned content filter automatically.
 *
 * Strategy:
 *   1. Try to match on the first character (strongest signal).
 *   2. Fall back to the first copyright (series).
 *   3. Fall back to the first general tag.
 *   4. Fall back to top-scored videos overall.
 * In all cases, exclude the current video from the results.
 */
/**
 * Internal: always fetch max related (12) then the caller slices.
 * Memoized on video.slug so multiple callers on the same page render
 * (player, grid, sidebar) share one PG round-trip instead of 3+.
 */
async function _getRelatedVideosMax(
  slug: string,
  firstCharacter: string | undefined,
  firstCopyright: string | undefined,
  firstTag: string | undefined,
): Promise<Video[]> {
  const MAX = 12;
  const signals: string[] = [];
  if (firstCharacter) signals.push(firstCharacter);
  if (firstCopyright) signals.push(firstCopyright);
  if (firstTag) signals.push(firstTag);

  for (const tag of signals) {
    try {
      const { data } = await getVideos({
        tags: tag,
        limit: MAX + 5,
        order: "score",
        requireThumbnail: true,
      });
      const filtered = data.filter((v) => v.slug !== slug).slice(0, MAX);
      if (filtered.length >= Math.min(4, MAX)) return filtered;
    } catch (err) {
      console.error("getRelatedVideos signal error:", err);
    }
  }

  try {
    const { data } = await getVideos({
      limit: MAX + 5,
      order: "score",
      requireThumbnail: true,
    });
    return data.filter((v) => v.slug !== slug).slice(0, MAX);
  } catch {
    return [];
  }
}

// Memoized 5 min on the slug so the 3 per-page callers share one hit.
const _getRelatedVideosMaxMemo = memoize(
  "related-videos-max",
  _getRelatedVideosMax,
  5 * 60 * 1000,
);

export async function getRelatedVideos(
  video: {
    id: number;
    slug: string;
    source?: string;
    characters?: string[];
    copyrights?: string[];
    tags?: string[];
  },
  limit: number = 12,
): Promise<Video[]> {
  const all = await _getRelatedVideosMaxMemo(
    video.slug,
    video.characters?.[0],
    video.copyrights?.[0],
    video.tags?.[0],
  );
  return all.slice(0, limit);
}

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
export async function getUserFavorites(
  userId: string | number,
): Promise<Video[]> {
  try {
    const { rows } = await pool.query(
      `${USER_VIDEO_SELECT}
       FROM videos v
       JOIN user_favorites f ON v.slug = f.video_slug
       WHERE f.user_id = $1
         AND NOT (v.tags && $2::text[])
         AND NOT (COALESCE(v.characters, ARRAY[]::text[]) && $2::text[])
         AND NOT (COALESCE(v.copyrights, ARRAY[]::text[]) && $2::text[])
       ORDER BY f.created_at DESC
       LIMIT 500`,
      [userId, BANNED_TAGS_ARRAY],
    );
    return filterBannedContent(rows.map(rowToVideo));
  } catch (err) {
    console.error("getUserFavorites error:", err);
    return [];
  }
}

/** Fetch a logged-in user's watch history as full Video objects, newest first. */
export async function getUserHistory(
  userId: string | number,
): Promise<Video[]> {
  try {
    const { rows } = await pool.query(
      `${USER_VIDEO_SELECT}, h.watched_at
       FROM videos v
       JOIN user_history h ON v.slug = h.video_slug
       WHERE h.user_id = $1
         AND NOT (v.tags && $2::text[])
         AND NOT (COALESCE(v.characters, ARRAY[]::text[]) && $2::text[])
         AND NOT (COALESCE(v.copyrights, ARRAY[]::text[]) && $2::text[])
       ORDER BY h.watched_at DESC
       LIMIT 500`,
      [userId, BANNED_TAGS_ARRAY],
    );
    return filterBannedContent(rows.map(rowToVideo));
  } catch (err) {
    console.error("getUserHistory error:", err);
    return [];
  }
}
