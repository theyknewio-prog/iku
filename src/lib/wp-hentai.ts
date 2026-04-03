/**
 * wp-hentai.ts — Data layer for WordPress-based hentai sites
 *
 * Sources: hentaimama.io, hentai.tv, animeidhentai.com,
 * watchhentai.net, hentaiworld.tv, hentaigasm.com
 *
 * Like rule34video, these have no direct video URLs —
 * they're resolved on-demand via /api/resolve-video with yt-dlp.
 */

import type { Video, PaginatedResult } from "@/types/video";

// Lazy-loaded to avoid crashing if file doesn't exist yet
let _data: WPEntry[] | null = null;
function getData(): WPEntry[] {
  if (_data) return _data;
  try {
    _data = require("@/data/wp-hentai-videos.json") as WPEntry[];
  } catch {
    _data = [];
  }
  return _data;
}

interface WPEntry {
  id: number;
  slug: string;
  title: string;
  pageUrl: string;
  site: string;
  date: string;
}

/** Known slug prefixes for each WP site */
const WP_PREFIXES = ["hmm", "htv", "aid", "wh", "hw", "hg"] as const;

export function isWPHentaiSlug(slug: string): boolean {
  return WP_PREFIXES.some((p) => slug.startsWith(p + "-"));
}

function toVideo(entry: WPEntry): Video {
  const titleWords = entry.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return {
    id: entry.id,
    slug: entry.slug,
    url: "",
    thumbnail: "",
    preview: "",
    score: 0,
    favorites: 0,
    tags: titleWords.slice(0, 15),
    characters: [],
    copyrights: [],
    artists: [],
    width: 1280,
    height: 720,
    fileSize: 0,
    duration: null,
    createdAt: entry.date ? new Date(entry.date) : new Date(0),
    source: "rule34video", // grouped under same source type for simplicity
  };
}

export function getWPHentaiPost(id: number): Video | null {
  const entry = getData().find((v) => v.id === id);
  if (!entry) return null;
  return toVideo(entry);
}

export function getWPHentaiPageUrl(id: number): string | null {
  const entry = getData().find((v) => v.id === id);
  return entry?.pageUrl ?? null;
}

export interface WPHentaiSearchOptions {
  tags?: string;
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export function searchWPHentai(
  options: WPHentaiSearchOptions = {}
): PaginatedResult<Video> {
  const { tags = "", page = 1, limit = 20, order = "date" } = options;
  const data = getData();

  let filtered = data;

  if (tags) {
    const searchTerms = tags.toLowerCase().split(/\s+/);
    filtered = filtered.filter((v) => {
      const titleLower = v.title.toLowerCase();
      return searchTerms.every((term) => titleLower.includes(term));
    });
  }

  if (order === "date") {
    filtered = [...filtered].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  const start = (page - 1) * limit;
  const slice = filtered.slice(start, start + limit);

  return {
    data: slice.map(toVideo),
    hasMore: start + limit < filtered.length,
  };
}
