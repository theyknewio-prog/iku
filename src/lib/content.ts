/**
 * content.ts — Unified content layer
 *
 * Merges Danbooru and Gelbooru results into a single Video feed.
 * All pages should import from here instead of calling danbooru.ts directly.
 */

import { searchPosts } from "@/lib/danbooru";
import { searchGelbooru } from "@/lib/gelbooru";
import type { Video, PaginatedResult } from "@/types/video";

export interface GetVideosOptions {
  limit?: number;
  page?: number;
  order?: "score" | "date" | "favcount";
  tags?: string;
  source?: "all" | "danbooru" | "gelbooru";
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

/** Remove duplicates — a Danbooru and Gelbooru post can never share a slug
 *  (gel- prefix), but we guard against the same source returning dupes. */
function deduplicate(videos: Video[]): Video[] {
  const seen = new Set<string>();
  return videos.filter((v) => {
    if (seen.has(v.slug)) return false;
    seen.add(v.slug);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Interleave: spread Gelbooru items into the Danbooru list for variety.
// Every 3rd position gets a Gelbooru item (when available).
// ---------------------------------------------------------------------------

function interleave(primary: Video[], secondary: Video[]): Video[] {
  if (secondary.length === 0) return primary;
  if (primary.length === 0) return secondary;

  const result: Video[] = [];
  let si = 0;
  for (let i = 0; i < primary.length; i++) {
    result.push(primary[i]);
    // Insert a Gelbooru item every 3 Danbooru items
    if ((i + 1) % 3 === 0 && si < secondary.length) {
      result.push(secondary[si++]);
    }
  }
  // Append remaining secondary items at the end
  while (si < secondary.length) {
    result.push(secondary[si++]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sort merged results
// ---------------------------------------------------------------------------

function sortVideos(
  videos: Video[],
  order: "score" | "date" | "favcount"
): Video[] {
  return [...videos].sort((a, b) => {
    if (order === "score") return b.score - a.score;
    if (order === "favcount") return b.favorites - a.favorites;
    // date: newest first
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch videos from one or both sources and return a merged, sorted feed.
 *
 * - source="all"       : fetch from both Danbooru + Gelbooru, interleave
 * - source="danbooru"  : Danbooru only
 * - source="gelbooru"  : Gelbooru only
 *
 * Gelbooru failures are silent — the feed degrades to Danbooru-only.
 */
export async function getVideos(
  options: GetVideosOptions = {}
): Promise<PaginatedResult<Video>> {
  const {
    limit = 20,
    page = 1,
    order = "score",
    tags = "",
    source = "all",
  } = options;

  if (source === "danbooru") {
    return searchPosts({ limit, page, order, tags: tags || undefined });
  }

  if (source === "gelbooru") {
    return searchGelbooru({ limit, page, order, tags: tags || undefined });
  }

  // source === "all": fetch both concurrently
  // Give Gelbooru half the slot to keep the page size consistent
  const gelbooruLimit = Math.ceil(limit / 3);
  const danbooruLimit = limit; // Primary — always request full quota

  const [danbooruResult, gelbooruResult] = await Promise.allSettled([
    searchPosts({
      limit: danbooruLimit,
      page,
      order,
      tags: tags || undefined,
    }),
    searchGelbooru({
      limit: gelbooruLimit,
      page,
      order,
      tags: tags || undefined,
    }),
  ]);

  const danbooruVideos =
    danbooruResult.status === "fulfilled"
      ? danbooruResult.value.data
      : [];

  const gelbooruVideos =
    gelbooruResult.status === "fulfilled"
      ? gelbooruResult.value.data
      : [];

  if (gelbooruResult.status === "rejected") {
    console.error("Gelbooru fetch failed (graceful fallback):", gelbooruResult.reason);
  }

  const merged = interleave(danbooruVideos, gelbooruVideos);
  const sorted = sortVideos(merged, order);
  const unique = deduplicate(sorted);

  const hasMore =
    (danbooruResult.status === "fulfilled" && danbooruResult.value.hasMore) ||
    (gelbooruResult.status === "fulfilled" && gelbooruResult.value.hasMore);

  return { data: unique, hasMore };
}
