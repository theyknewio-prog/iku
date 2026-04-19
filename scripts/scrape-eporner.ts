#!/usr/bin/env npx tsx
/**
 * scrape-eporner.ts
 *
 * eporner.com hentai/animated library (~72K videos). Clean JSON API:
 *   /api/v2/video/search/?query={q}&per_page=100&page={N}
 *
 * Strategy: run the search across multiple queries to maximise recall
 * (hentai + anime + animated + 3d cartoon + cartoon), dedupe by id,
 * upsert into PG. Playback is IP-bound (same pattern as rule34video) so
 * we store the canonical page URL and let /api/video-stream resolve via
 * yt-dlp at view time — no pre-baked MP4 URL is safe to ship.
 *
 * IDs are base62 alphanumeric (e.g. "c1noqpPjzbA"). PG source_id is BIGINT
 * so we hash the string to a 52-bit integer (safe in JS Number).
 *
 * Slug format: `ep-{hashId}-{cleanSlug}`
 */

import { upsertVideos, pool } from "./db";
import { hasBannedTitle } from "./banned-tags";
import { createHash } from "crypto";

const BASE = "https://www.eporner.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PER_PAGE = 100;
const DELAY_MS = 400;
const MAX_PAGES_PER_QUERY = 250;
const QUERIES = [
  "hentai",
  "anime",
  "animated",
  "3d cartoon",
  "cartoon",
  "hentai 3d",
  "ahegao",
  "waifu",
];

interface EpVideo {
  id: string;
  title: string;
  keywords: string;
  views: number;
  rate: string;
  url: string;
  added: string;
  length_sec: number;
  length_min: string;
  embed: string;
  default_thumb: { src: string };
}

interface EpResponse {
  total_count: string;
  total_pages: number;
  videos: EpVideo[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function hashIdTo52Bit(strId: string): number {
  const hex = createHash("sha1").update(strId).digest("hex").slice(0, 13);
  return parseInt(hex, 16);
}

function extractSlug(canonicalUrl: string): string {
  const m = canonicalUrl.match(/\/(?:video-|hd-porn\/)[^\/]+\/([^\/]+)/);
  if (m) return m[1].toLowerCase();
  return "video";
}

function parseTags(keywords: string): string[] {
  return keywords
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length < 40 && !/[<>]/.test(t))
    .slice(0, 20);
}

async function fetchSearch(
  query: string,
  page: number,
): Promise<EpResponse | null> {
  const url =
    `${BASE}/api/v2/video/search/?query=${encodeURIComponent(query)}` +
    `&per_page=${PER_PAGE}&page=${page}&thumbsize=medium` +
    `&order=top-weekly&gay=0&lq=1&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.warn(`[eporner] page ${page} (${query}): HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as EpResponse;
  } catch (err) {
    console.warn(
      `[eporner] page ${page} (${query}): ${(err as Error).message}`,
    );
    return null;
  }
}

function pageUrlFor(id: string, slug: string): string {
  return `${BASE}/video-${id}/${slug}/`;
}

async function main(): Promise<void> {
  const seen = new Set<string>();
  const rows: Parameters<typeof upsertVideos>[0] = [];
  let totalFetched = 0;
  let totalRejected = 0;

  for (const query of QUERIES) {
    console.log(`\n=== query: "${query}" ===`);
    const first = await fetchSearch(query, 1);
    if (!first) continue;
    const totalPages = Math.min(first.total_pages || 1, MAX_PAGES_PER_QUERY);
    console.log(
      `[eporner] ${first.total_count} total videos, walking ${totalPages} pages`,
    );

    for (let page = 1; page <= totalPages; page++) {
      const data = page === 1 ? first : await fetchSearch(query, page);
      if (!data || !data.videos || data.videos.length === 0) {
        console.log(`[eporner] page ${page}: empty, stopping`);
        break;
      }

      for (const v of data.videos) {
        if (!v.id || seen.has(v.id)) continue;
        seen.add(v.id);

        const title = v.title || "";
        if (hasBannedTitle(title)) {
          totalRejected++;
          continue;
        }

        const tags = parseTags(v.keywords);
        if (tags.some((t) => hasBannedTitle(t))) {
          totalRejected++;
          continue;
        }

        const slug = extractSlug(v.url);
        if (hasBannedTitle(slug)) {
          totalRejected++;
          continue;
        }

        const sourceId = hashIdTo52Bit(v.id);
        const canonical = pageUrlFor(v.id, slug);

        rows.push({
          source: "eporner",
          source_id: sourceId,
          slug: `ep-${sourceId}-${slug}`.slice(0, 255),
          url: canonical,
          page_url: canonical,
          title,
          thumbnail: v.default_thumb?.src || "",
          preview: v.default_thumb?.src || "",
          score: Math.floor(parseFloat(v.rate || "0") * 100),
          favorites: v.views || 0,
          tags,
          characters: [],
          copyrights: [],
          artists: [],
          width: 0,
          height: 0,
          file_size: 0,
          duration: v.length_sec || null,
          created_at: v.added || undefined,
        });

        totalFetched++;
      }

      if (rows.length >= 500) {
        const inserted = await upsertVideos(rows);
        console.log(
          `[eporner] flushed ${inserted} rows (total: ${totalFetched}, dedup: ${seen.size}, rejected: ${totalRejected})`,
        );
        rows.length = 0;
      }

      await sleep(DELAY_MS);
    }
  }

  if (rows.length > 0) {
    await upsertVideos(rows);
    console.log(`[eporner] final flush: ${rows.length} rows`);
  }

  console.log(
    `\n=== DONE === fetched=${totalFetched} unique=${seen.size} rejected=${totalRejected}`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("[eporner] fatal:", err);
  process.exit(1);
});
