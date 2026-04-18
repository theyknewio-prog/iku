#!/usr/bin/env npx tsx
/**
 * scrape-hentaicity.ts
 *
 * Scrape long-form animated hentai episodes from hentaicity.com and
 * upsert them into the unified `videos` PG table with source = "hentaicity".
 *
 * Why: iku.gg currently has only short clips from Danbooru/Gelbooru/Rule34
 * and animated loops from Rule34Video/WP. To rank for the generic "hentai"
 * SEO keyword, we need full episodes (what hentaicity + hentaihaven host).
 *
 * Extraction strategy (confirmed by manual scrape on 2026-04-10):
 *   Listing:  https://www.hentaicity.com/videos/straight/all-recent-{N}.html
 *   Detail:   https://www.hentaicity.com/video/{title-slug}-{id}.html
 *   MP4:      <video preload="auto" src="https://www.hentaicity.com/flv/{dir}/{fid}/mobile.mp4">
 *   Thumb:    https://cdn1.images.hentaicity.com/videos/{dir}/{fid}/1080p.jpg
 *   Duration: <meta ... "duration" content="1073">
 *   Title:    <title> or <h1>
 *   Tags:     <a href="/videos/straight/{tag}-popular.html">Name</a>
 *
 * The MP4 URL is stable (no token, no expiry) and served directly from
 * www.hentaicity.com. We store that as `url` and the slug-id page URL as
 * `page_url`. Watch page proxies through /api/video-stream for CORS safety.
 *
 * Filters: runs every title + tag list through the shared banned-tags list
 * (same as every other scraper). Any loli/shota/etc. kills the row before
 * it hits upsertVideos — which also has its own safety net.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/scrape-hentaicity.ts               # default: 50 pages (~2500 videos)
 *   DATABASE_URL=... npx tsx scripts/scrape-hentaicity.ts --pages 200   # 200 pages (~10000 videos)
 *   DATABASE_URL=... npx tsx scripts/scrape-hentaicity.ts --start 51    # resume from page 51
 */

import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://www.hentaicity.com";
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Knobs
const CONCURRENCY = 6; // parallel detail fetches
const DELAY_BETWEEN_LISTINGS_MS = 250; // politeness
const DELAY_BETWEEN_DETAILS_MS = 100;

interface ParsedVideo {
  internalId: number;
  slugId: string; // e.g. "1kjKV8WkWIf" (alnum hash)
  title: string;
  titleSlug: string;
  description: string | null;
  thumbnail: string;
  mp4Url: string;
  pageUrl: string;
  duration: number | null;
  tags: string[];
  uploadDate: string | null;
}

// ── Fetch helpers ──────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Listing page: extract video detail URLs ────────────────────────────

function extractDetailUrls(listingHtml: string): string[] {
  const urls = new Set<string>();
  // class="video-title pop-execute" href="https://www.hentaicity.com/click/1-N/video/{slug-id}.html"
  const re =
    /class="video-title[^"]*"\s+href="https:\/\/www\.hentaicity\.com\/click\/\d+-\d+\/video\/([^"]+\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(listingHtml))) {
    urls.add(`${BASE}/video/${m[1]}`);
  }
  return [...urls];
}

// ── Detail page: extract video metadata ────────────────────────────────

function extractDetail(
  detailHtml: string,
  pageUrl: string,
): ParsedVideo | null {
  // MP4 URL: prefer the mobile.mp4 <video src=...>, fall back to HLS master
  let mp4 = "";
  const mp4Match = detailHtml.match(
    /<video[^>]*preload="auto"[^>]*src="(https:\/\/www\.hentaicity\.com\/flv\/[^"]+mobile\.mp4)"/,
  );
  if (mp4Match) mp4 = mp4Match[1];
  if (!mp4) return null;

  // Internal ID from the MP4 path: /flv/0297/37809/mobile.mp4 → 37809
  const idMatch = mp4.match(/\/flv\/(\d+)\/(\d+)\/mobile\.mp4/);
  if (!idMatch) return null;
  const internalId = parseInt(idMatch[2], 10);

  // Slug ID from the page URL: title-slug-1kjKV8WkWIf.html → 1kjKV8WkWIf
  const slugIdMatch = pageUrl.match(/-([a-zA-Z0-9]{10,12})\.html$/);
  const slugId = slugIdMatch ? slugIdMatch[1] : String(internalId);

  // Thumbnail: cdn1.images.hentaicity.com/videos/0297/37809/1080p.jpg
  let thumbnail = "";
  const thumbMatch = detailHtml.match(
    /poster="(https:\/\/cdn\d?\.images\.hentaicity\.com\/videos\/[^"]+)"/,
  );
  if (thumbMatch) thumbnail = thumbMatch[1];

  // Title
  let title = "";
  const titleMatch = detailHtml.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    title = titleMatch[1].replace(/\s*-\s*Hentai City\s*$/i, "").trim();
  }
  if (!title) return null;

  // Build URL slug from title (lowercase, dash-separated)
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  // Description
  let description: string | null = null;
  const descMatch = detailHtml.match(
    /<meta\s+name="description"\s+content="([^"]+)"/i,
  );
  if (descMatch) description = descMatch[1];

  // Duration (seconds) from schema.org meta
  let duration: number | null = null;
  const durMatch = detailHtml.match(/"duration"\s+content="(\d+)"/);
  if (durMatch) duration = parseInt(durMatch[1], 10);

  // Tags: <a href="/videos/straight/{tag}-popular.html">Name</a>
  const tags: string[] = [];
  const tagRe =
    /<a\s+href="[^"]*\/videos\/straight\/([a-z0-9-]+)-popular\.html"[^>]*>([^<]+)</g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(detailHtml))) {
    const tagRaw = tm[1];
    if (!tags.includes(tagRaw)) tags.push(tagRaw);
  }

  // Upload date (optional — schema.org)
  let uploadDate: string | null = null;
  const dateMatch = detailHtml.match(
    /"uploadDate"\s+content="([^"]+)"|"datePublished"\s+content="([^"]+)"/,
  );
  if (dateMatch) uploadDate = dateMatch[1] || dateMatch[2];

  return {
    internalId,
    slugId,
    title,
    titleSlug,
    description,
    thumbnail,
    mp4Url: mp4,
    pageUrl,
    duration,
    tags,
    uploadDate,
  };
}

// ── Banned content check (local fast-path, upsertVideos also checks) ───

function isBanned(v: ParsedVideo): boolean {
  if (hasBannedTitle(v.title)) return true;
  if (hasBannedTitle(v.titleSlug)) return true;
  for (const tag of v.tags) {
    if (BANNED_TAGS.has(tag.toLowerCase())) return true;
  }
  return false;
}

// ── Main pipeline ──────────────────────────────────────────────────────

async function scrapeListingPage(page: number): Promise<string[]> {
  const url =
    page === 1
      ? `${BASE}/videos/straight/all-recent.html`
      : `${BASE}/videos/straight/all-recent-${page}.html`;
  try {
    const html = await fetchHtml(url);
    return extractDetailUrls(html);
  } catch (err) {
    console.warn(`[listing ${page}] ${(err as Error).message}`);
    return [];
  }
}

async function scrapeDetail(url: string): Promise<ParsedVideo | null> {
  try {
    const html = await fetchHtml(url);
    return extractDetail(html, url);
  } catch (err) {
    console.warn(`[detail] ${url} — ${(err as Error).message}`);
    return null;
  }
}

async function processBatch(urls: string[]): Promise<ParsedVideo[]> {
  const results: ParsedVideo[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const parsed = await Promise.all(batch.map((u) => scrapeDetail(u)));
    for (const v of parsed) if (v) results.push(v);
    await sleep(DELAY_BETWEEN_DETAILS_MS);
  }
  return results;
}

function toRow(v: ParsedVideo) {
  return {
    source: "hentaicity",
    source_id: v.internalId,
    slug: `hc-${v.internalId}-${v.titleSlug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaicity",
    title: v.title,
    thumbnail: v.thumbnail,
    preview: v.thumbnail,
    score: 0,
    favorites: 0,
    tags: v.tags,
    characters: [] as string[],
    copyrights: [] as string[],
    artists: [] as string[],
    width: 1280,
    height: 720,
    file_size: 0,
    duration: v.duration,
    created_at: v.uploadDate ?? new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const pagesArg = args.indexOf("--pages");
  const startArg = args.indexOf("--start");
  const totalPages = pagesArg >= 0 ? parseInt(args[pagesArg + 1], 10) : 50;
  const startPage = startArg >= 0 ? parseInt(args[startArg + 1], 10) : 1;

  console.log(
    `── scrape-hentaicity ── starting at page ${startPage}, scraping ${totalPages} pages (est. ~${totalPages * 48} videos) ──`,
  );

  let totalUpserted = 0;
  let totalBanned = 0;
  let totalScraped = 0;

  for (let page = startPage; page < startPage + totalPages; page++) {
    const listingStart = Date.now();
    const detailUrls = await scrapeListingPage(page);
    if (detailUrls.length === 0) {
      console.log(`[page ${page}] empty — probably end of catalog, stopping`);
      break;
    }

    const parsed = await processBatch(detailUrls);
    const kept: ParsedVideo[] = [];
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
      // Batch in groups of 50 to keep pg param count under 2000
      for (let i = 0; i < rows.length; i += 50) {
        upserted += await upsertVideos(rows.slice(i, i + 50));
      }
    }

    totalUpserted += upserted;
    totalBanned += pageBanned;
    totalScraped += parsed.length;

    const elapsed = ((Date.now() - listingStart) / 1000).toFixed(1);
    console.log(
      `[page ${page}] ${detailUrls.length} urls → ${parsed.length} parsed → ${kept.length} kept (${pageBanned} banned) → ${upserted} upserted · ${elapsed}s`,
    );

    await sleep(DELAY_BETWEEN_LISTINGS_MS);
  }

  console.log(
    `── done: scraped ${totalScraped} videos, rejected ${totalBanned} for banned content, upserted ${totalUpserted} ──`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
