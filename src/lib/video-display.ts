/**
 * video-display.ts — shared helpers for rendering video cards
 *
 * Keep the PosterCard and Top Rated grid in sync on how we pick
 * a display title and a genre tag from a Video row.
 */

import type { Video } from "@/types/video";

const GENERIC_TAGS = new Set([
  "animated", "video", "sound", "tagme", "highres", "absurdres",
  "original", "solo", "1girl", "1boy", "1girls", "2girls", "3girls",
  "multiple_girls", "multiple_boys", "group", "duo",
  "nude", "nipples", "breasts", "pussy", "completely_nude", "large_breasts",
  "looking_at_viewer", "smile", "blush", "open_mouth", "closed_eyes",
  "long_hair", "short_hair", "blonde_hair", "black_hair", "brown_hair",
  "blue_eyes", "green_eyes", "red_eyes", "hair_ornament",
  "simple_background", "white_background", "transparent_background",
  "skirt", "shirt", "dress", "holding", "sitting", "standing",
]);

// Skip tags that are just numbers / resolutions / years
function isNoise(tag: string): boolean {
  return /^\d/.test(tag) || tag.includes("x1080") || tag.includes("x720");
}

/** Pick a meaningful genre tag, skipping generic/noise tags. */
export function pickGenreTag(video: Video): string {
  const candidate = video.tags.find(
    (t) => !GENERIC_TAGS.has(t.toLowerCase()) && !isNoise(t)
  );
  if (candidate) return candidate.replace(/_/g, " ");
  if (video.tags.length > 0) return video.tags[0].replace(/_/g, " ");
  return "Hentai";
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Pick up to N distinct meaningful tags — no duplicates, no prefix collisions. */
function distinctTags(tags: string[], n: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    if (GENERIC_TAGS.has(t.toLowerCase()) || isNoise(t)) continue;
    const clean = t.replace(/_/g, " ").toLowerCase();
    // Skip if we already have this word OR a word that starts with the same 4 chars
    const first4 = clean.slice(0, 4);
    if (seen.has(clean)) continue;
    if (Array.from(seen).some((s) => s.startsWith(first4) || clean.startsWith(s.slice(0, 4)))) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= n) break;
  }
  return out;
}

/** Build a human-friendly title from any Video. */
export function buildTitle(video: Video): string {
  // Prefer scraped title (rule34video, WP)
  if (video.title && video.title.trim()) {
    return titleCase(video.title.replace(/_/g, " "));
  }
  // Then character name (+ copyright if present)
  if (video.characters[0]) {
    const char = titleCase(video.characters[0].replace(/_/g, " "));
    return video.copyrights[0]
      ? `${char} — ${titleCase(video.copyrights[0].replace(/_/g, " "))}`
      : char;
  }
  // Then copyright
  if (video.copyrights[0]) {
    return titleCase(video.copyrights[0].replace(/_/g, " "));
  }
  // Then first meaningful tags (distinct, no prefix duplicates)
  const meaningful = distinctTags(video.tags, 2);
  if (meaningful.length > 0) {
    return meaningful.map(titleCase).join(" & ");
  }
  return "Animated Hentai";
}
