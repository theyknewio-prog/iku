/**
 * rule34video.ts — Data layer for rule34video.com videos
 *
 * Videos are loaded from the static JSON scraped from sitemaps.
 * Video stream URLs are resolved on-demand via yt-dlp (see /api/resolve-video).
 */

import type { Video, PaginatedResult } from "@/types/video";
import data from "@/data/rule34video-videos.json";

interface R34VEntry {
  id: number;
  slug: string;
  title: string;
  pageUrl: string;
  thumbnail: string;
  duration: number;
  date: string;
}

const videos = data as R34VEntry[];

function toVideo(entry: R34VEntry): Video {
  // Extract tags from the slug/title
  const titleWords = entry.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return {
    id: entry.id,
    slug: entry.slug,
    // No direct video URL — resolved at play time via /api/resolve-video
    url: "",
    thumbnail: entry.thumbnail,
    preview: entry.thumbnail,
    score: 0,
    favorites: 0,
    tags: titleWords.slice(0, 15),
    characters: [],
    copyrights: [],
    artists: [],
    width: 1280,
    height: 720,
    fileSize: 0,
    duration: entry.duration || null,
    createdAt: entry.date ? new Date(entry.date) : new Date(0),
    source: "rule34video",
  };
}

export function getRule34VideoPost(id: number): Video | null {
  const entry = videos.find((v) => v.id === id);
  if (!entry) return null;
  return toVideo(entry);
}

export function getRule34VideoPageUrl(id: number): string | null {
  const entry = videos.find((v) => v.id === id);
  return entry?.pageUrl ?? null;
}

export interface Rule34VideoSearchOptions {
  tags?: string;
  page?: number;
  limit?: number;
  order?: "score" | "date" | "favcount";
}

export function searchRule34Video(
  options: Rule34VideoSearchOptions = {}
): PaginatedResult<Video> {
  const { tags = "", page = 1, limit = 20, order = "date" } = options;

  let filtered = videos;

  // Filter by tags (search in title)
  if (tags) {
    const searchTerms = tags.toLowerCase().split(/\s+/);
    filtered = filtered.filter((v) => {
      const titleLower = v.title.toLowerCase();
      return searchTerms.every((term) => titleLower.includes(term));
    });
  }

  // Sort
  if (order === "date") {
    filtered = [...filtered].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
  // score/favcount: no data, keep as-is

  const start = (page - 1) * limit;
  const slice = filtered.slice(start, start + limit);
  const hasMore = start + limit < filtered.length;

  return {
    data: slice.map(toVideo),
    hasMore,
  };
}
