#!/usr/bin/env npx tsx
/**
 * scrape-sfmcompile.ts
 *
 * Scrape SFM Compile (sfmcompile.club) — ~37K WordPress-hosted SFM/3D porn
 * animations. Content is self-hosted MP4 on wp-content/uploads, so URLs are
 * stable and CDN-able (unlike rule34video's IP-bound tokens).
 *
 * Strategy:
 *   1. Walk the WP REST API (`/wp-json/wp/v2/posts`) for id/slug/tags/date/title.
 *      ~371 pages of 100 posts each. X-WP-Total header gives live count.
 *   2. Batch-resolve tag IDs → names via `/wp-json/wp/v2/tags?include=...`.
 *   3. For each post, fetch the detail HTML to extract the direct MP4 URL
 *      and poster from `itemprop="contentUrl"` / `itemprop="thumbnailUrl"`
 *      (schema.org VideoObject — present on every sfmcompile page).
 *   4. Apply BANNED_TAGS + hasBannedTitle filter, upsert in batches of 50.
 *
 * Slug format: `sfm-{wpPostId}-{postSlug}` (WordPress IDs are globally unique,
 * no collision with other sources).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/scrape-sfmcompile.ts                 # 50 pages
 *   DATABASE_URL=... npx tsx scripts/scrape-sfmcompile.ts --pages 400     # everything
 *   DATABASE_URL=... npx tsx scripts/scrape-sfmcompile.ts --start 200 --pages 50
 */

import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://sfmcompile.club";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PER_PAGE = 100;
const CONCURRENCY = 4;
const DELAY_MS = 200;

interface WpPost {
  id: number;
  slug: string;
  link: string;
  date: string;
  title: { rendered: string };
}

interface SfmVideo {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  thumbnail: string;
  mp4Url: string;
  pageUrl: string;
  width: number;
  height: number;
  tags: string[];
  createdAt: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractDetail(html: string): {
  mp4Url: string;
  thumbnail: string;
  width: number;
  height: number;
  tags: string[];
} | null {
  // Two coexisting patterns on sfmcompile:
  //   1. Newer posts (2023+): simple <video ... src="https://.../xxx.mp4">
  //   2. Older posts (Kgvid plugin): <source src="..."> + schema.org itemprop="contentUrl"
  // We try the direct video/source tag first inside the entry-content, then
  // fall back to microdata. The entry-content boundary matters because the
  // page sidebar widget contains its own <video> (Alice-Madness demo loop)
  // that we don't want to pick up by accident.
  let mp4Url: string | null = null;

  const entry = html.match(
    /<div[^>]*class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<(?:footer|div class=["']entry-footer|div class=["']entry-tags|div class=["']g1-sharebar)/,
  );
  const body = entry ? entry[1] : html;

  // Pattern 1: <video ... src="...mp4">
  const videoSrcMatch = body.match(
    /<video[^>]*\bsrc=["'](https?:\/\/[^"']+\.(?:mp4|webm|m4v|mov))(?:\?[^"']*)?["']/i,
  );
  if (videoSrcMatch) mp4Url = videoSrcMatch[1];

  // Pattern 2: <source src="...mp4"> inside <video>
  if (!mp4Url) {
    const sourceMatch = body.match(
      /<source[^>]*\bsrc=["'](https?:\/\/[^"']+\.(?:mp4|webm|m4v|mov))(?:\?[^"']*)?["']/i,
    );
    if (sourceMatch) mp4Url = sourceMatch[1];
  }

  // Pattern 3: itemprop="contentUrl" microdata (Kgvid)
  if (!mp4Url) {
    const contentUrlMatch = html.match(
      /itemprop=["']contentUrl["']\s+content=["']([^"']+)["']/,
    );
    if (contentUrlMatch) mp4Url = contentUrlMatch[1];
  }

  if (!mp4Url) return null;

  // Thumbnail — try microdata first, then og:image (reliable on new posts).
  let thumbnail = "";
  const thumbMatch = html.match(
    /itemprop=["']thumbnailUrl["']\s+content=["']([^"']+)["']/,
  );
  if (thumbMatch) thumbnail = thumbMatch[1];
  if (!thumbnail) {
    const ogMatch = html.match(
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    );
    if (ogMatch) thumbnail = ogMatch[1];
  }
  if (!thumbnail) {
    // Derive from mp4 URL by swapping extension.
    thumbnail = mp4Url.replace(/\.(mp4|webm|m4v|mov)(\?[^"]*)?$/i, ".jpg");
  }

  // Width / height from VideoObject (not always present).
  let width = 1280;
  let height = 720;
  const widthMatch = html.match(
    /itemprop=["']width["']\s+content=["'](\d+)["']/,
  );
  const heightMatch = html.match(
    /itemprop=["']height["']\s+content=["'](\d+)["']/,
  );
  if (widthMatch) width = parseInt(widthMatch[1], 10);
  if (heightMatch) height = parseInt(heightMatch[1], 10);

  // Tags — scrape the <a ... class="entry-tag ...">slug</a> links in the entry
  // footer. Avoids the WP /tags API which Wordfence rate-limits aggressively.
  const tags: string[] = [];
  const tagRe =
    /<a[^>]*href=["']https:\/\/sfmcompile\.club\/tag\/([a-z0-9][a-z0-9-]*)\/?["'][^>]*class=["'][^"']*entry-tag[^"']*["']/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const tag = tm[1];
    if (!tags.includes(tag)) tags.push(tag);
  }

  return { mp4Url, thumbnail, width, height, tags };
}

async function scrapePost(post: WpPost): Promise<SfmVideo | null> {
  try {
    const html = await fetchHtml(post.link);
    const detail = extractDetail(html);
    if (!detail) return null;

    // Title — WP API returns HTML-entities-encoded title. Decode common ones.
    const title = post.title.rendered
      .replace(/&amp;/g, "&")
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8211;/g, "-")
      .replace(/&#038;/g, "&")
      .trim();

    // Description from the <meta name="description"> tag
    let description: string | null = null;
    const descMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    );
    if (descMatch) description = descMatch[1];

    return {
      id: post.id,
      slug: post.slug,
      title,
      description,
      thumbnail: detail.thumbnail,
      mp4Url: detail.mp4Url,
      pageUrl: post.link,
      width: detail.width,
      height: detail.height,
      tags: detail.tags,
      createdAt: post.date,
    };
  } catch (err) {
    console.warn(`[detail] ${post.slug} — ${(err as Error).message}`);
    return null;
  }
}

function isBanned(v: SfmVideo): boolean {
  if (hasBannedTitle(v.title)) return true;
  if (hasBannedTitle(v.slug)) return true;
  for (const tag of v.tags) {
    if (BANNED_TAGS.has(tag.toLowerCase())) return true;
  }
  return false;
}

async function processBatch(posts: WpPost[]): Promise<SfmVideo[]> {
  const out: SfmVideo[] = [];
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    const batch = posts.slice(i, i + CONCURRENCY);
    const parsed = await Promise.all(batch.map((p) => scrapePost(p)));
    for (const v of parsed) if (v) out.push(v);
    await sleep(DELAY_MS);
  }
  return out;
}

function toRow(v: SfmVideo) {
  return {
    source: "sfmcompile",
    source_id: v.id,
    slug: `sfm-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "sfmcompile",
    title: v.title,
    thumbnail: v.thumbnail,
    preview: v.thumbnail,
    score: 0,
    favorites: 0,
    tags: v.tags,
    characters: [] as string[],
    copyrights: [] as string[],
    artists: [] as string[],
    width: v.width,
    height: v.height,
    file_size: 0,
    duration: null,
    created_at: v.createdAt,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const pagesArg = args.indexOf("--pages");
  const startArg = args.indexOf("--start");
  const totalPages = pagesArg >= 0 ? parseInt(args[pagesArg + 1], 10) : 50;
  const startPage = startArg >= 0 ? parseInt(args[startArg + 1], 10) : 1;

  console.log(
    `── scrape-sfmcompile ── starting at page ${startPage}, scraping ${totalPages} pages ──`,
  );

  let totalUpserted = 0;
  let totalBanned = 0;
  let totalMissingVideo = 0;

  for (let page = startPage; page < startPage + totalPages; page++) {
    const t0 = Date.now();

    let posts: WpPost[] = [];
    try {
      posts = await fetchJson<WpPost[]>(
        `${BASE}/wp-json/wp/v2/posts?per_page=${PER_PAGE}&page=${page}&_fields=id,slug,link,date,title`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("400") || msg.includes("404")) {
        console.log(`[page ${page}] no more posts, stopping`);
        break;
      }
      console.warn(`[page ${page}] fetch failed: ${msg}`);
      continue;
    }

    if (posts.length === 0) {
      console.log(`[page ${page}] empty, stopping`);
      break;
    }

    const parsed = await processBatch(posts);
    const missingVideo = posts.length - parsed.length;
    totalMissingVideo += missingVideo;

    const kept: SfmVideo[] = [];
    let pageBanned = 0;
    for (const v of parsed) {
      if (isBanned(v)) {
        pageBanned++;
        continue;
      }
      kept.push(v);
    }

    const rows = kept.map(toRow);
    let upserted = 0;
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 50) {
        upserted += await upsertVideos(rows.slice(i, i + 50));
      }
    }

    totalUpserted += upserted;
    totalBanned += pageBanned;

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `[page ${page}] ${posts.length} posts → ${parsed.length} parsed (${missingVideo} no-video) → ${kept.length} kept (${pageBanned} banned) → ${upserted} upserted · ${elapsed}s`,
    );

    await sleep(DELAY_MS);
  }

  console.log(
    `── done: upserted ${totalUpserted} videos, rejected ${totalBanned} banned, ${totalMissingVideo} posts without video ──`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
