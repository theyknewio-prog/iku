#!/usr/bin/env npx tsx
/**
 * scrape-hentaigasm.ts
 *
 * Scrape long-form animated hentai episodes from hentaigasm.com.
 *
 * Unlike hentaicity, hentaigasm is WordPress-based with clean slug URLs:
 *   /seishidouin-no-shigoto-1-subbed/  ← video detail page
 *
 * The video player exposes a direct MP4 URL on hgasm3.com CDN:
 *   https://hgasm3.com/.Seishidouin No Shigoto 1 Subbed.mp4
 *
 * There's no numeric ID in the site structure, so we derive one from
 * a stable hash of the slug. Source ID = first 8 chars of sha256(slug)
 * interpreted as a 32-bit unsigned int.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/scrape-hentaigasm.ts               # default: 50 pages
 *   DATABASE_URL=... npx tsx scripts/scrape-hentaigasm.ts --pages 200
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://hentaigasm.com";
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile";

const CONCURRENCY = 4;
const DELAY_MS = 200;

interface HgVideo {
  id: number;           // stable hash of slug
  slug: string;         // the hentaigasm URL slug
  title: string;
  description: string | null;
  thumbnail: string;
  mp4Url: string;
  pageUrl: string;
  duration: number | null;
  tags: string[];
}

function slugHash(slug: string): number {
  const h = createHash("sha256").update(slug).digest("hex");
  // Mask to 31 bits so it fits in PG int32 range (positive only).
  return parseInt(h.slice(0, 8), 16) & 0x7fffffff;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractVideoUrls(listingHtml: string): string[] {
  // hentaigasm listing shows video cards linked via:
  //   <a href="https://hentaigasm.com/{slug}/">
  const urls = new Set<string>();
  const re = /href="https:\/\/hentaigasm\.com\/([a-z0-9][a-z0-9-]+)\/"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(listingHtml))) {
    const slug = m[1];
    // Filter out non-video URLs (feed, category, tag, etc.)
    if (
      slug === "feed" ||
      slug === "comments" ||
      slug.startsWith("category/") ||
      slug.startsWith("tag/") ||
      slug.startsWith("page/") ||
      slug.startsWith("wp-") ||
      slug.length < 8
    ) continue;
    urls.add(`${BASE}/${slug}/`);
  }
  return [...urls];
}

function extractDetail(html: string, pageUrl: string): HgVideo | null {
  // MP4 URL — the fluidplayer source
  const mp4Match = html.match(
    /src="(https:\/\/hgasm\d+\.com\/[^"]+\.mp4)"/
  );
  if (!mp4Match) return null;
  const mp4Url = mp4Match[1];

  // Slug from the page URL (last path segment)
  const slugMatch = pageUrl.match(/\/([a-z0-9][a-z0-9-]+)\/?$/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  // Title — either <title> or <h1>
  let title = "";
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    title = titleMatch[1].replace(/\s*-\s*Hentaigasm.*$/i, "").trim();
  }
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) title = h1Match[1].trim();
  }
  if (!title) return null;

  // Thumbnail — usually a preview image on same domain or logo.png
  let thumbnail = "";
  const thumbMatch = html.match(
    /src="(https:\/\/hgasm\d+\.com\/preview\/[^"]+\.(?:jpg|webp|png))"/
  );
  if (thumbMatch) thumbnail = thumbMatch[1];
  // Fallback: use the video poster if set
  if (!thumbnail) {
    const posterMatch = html.match(/poster="([^"]+)"/);
    if (posterMatch) thumbnail = posterMatch[1];
  }

  // Description
  let description: string | null = null;
  const descMatch = html.match(
    /<meta\s+name="description"\s+content="([^"]+)"/i
  );
  if (descMatch) description = descMatch[1];

  // Tags (hentaigasm tags are in categories/genres links)
  const tags: string[] = [];
  const tagRe =
    /href="https:\/\/hentaigasm\.com\/category\/([a-z0-9-]+)\/?"/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const tag = tm[1];
    if (!tags.includes(tag)) tags.push(tag);
  }

  return {
    id: slugHash(slug),
    slug,
    title,
    description,
    thumbnail,
    mp4Url,
    pageUrl,
    duration: null,
    tags,
  };
}

function isBanned(v: HgVideo): boolean {
  if (hasBannedTitle(v.title)) return true;
  if (hasBannedTitle(v.slug)) return true;
  for (const tag of v.tags) {
    if (BANNED_TAGS.has(tag.toLowerCase())) return true;
  }
  return false;
}

async function scrapeListingPage(page: number): Promise<string[]> {
  const url = page === 1 ? `${BASE}/` : `${BASE}/page/${page}/`;
  try {
    const html = await fetchHtml(url);
    return extractVideoUrls(html);
  } catch (err) {
    console.warn(`[listing ${page}] ${(err as Error).message}`);
    return [];
  }
}

async function scrapeDetail(url: string): Promise<HgVideo | null> {
  try {
    const html = await fetchHtml(url);
    return extractDetail(html, url);
  } catch (err) {
    console.warn(`[detail] ${url} — ${(err as Error).message}`);
    return null;
  }
}

async function processBatch(urls: string[]): Promise<HgVideo[]> {
  const out: HgVideo[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const parsed = await Promise.all(batch.map((u) => scrapeDetail(u)));
    for (const v of parsed) if (v) out.push(v);
    await sleep(DELAY_MS);
  }
  return out;
}

function toRow(v: HgVideo) {
  return {
    source: "hentaigasm",
    source_id: v.id,
    slug: `hg-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaigasm",
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
    created_at: new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const pagesArg = args.indexOf("--pages");
  const startArg = args.indexOf("--start");
  const totalPages = pagesArg >= 0 ? parseInt(args[pagesArg + 1], 10) : 100;
  const startPage = startArg >= 0 ? parseInt(args[startArg + 1], 10) : 1;

  console.log(
    `── scrape-hentaigasm ── starting at page ${startPage}, scraping ${totalPages} pages ──`
  );

  let totalUpserted = 0;
  let totalBanned = 0;
  const seen = new Set<string>();

  for (let page = startPage; page < startPage + totalPages; page++) {
    const t0 = Date.now();
    const detailUrls = await scrapeListingPage(page);
    const fresh = detailUrls.filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });

    if (fresh.length === 0 && detailUrls.length === 0) {
      console.log(`[page ${page}] empty — probably end of catalog, stopping`);
      break;
    }

    const parsed = await processBatch(fresh);
    const kept: HgVideo[] = [];
    let pageBanned = 0;
    for (const v of parsed) {
      if (isBanned(v)) { pageBanned++; continue; }
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
      `[page ${page}] ${detailUrls.length} urls (${fresh.length} new) → ${parsed.length} parsed → ${kept.length} kept (${pageBanned} banned) → ${upserted} upserted · ${elapsed}s`
    );

    await sleep(DELAY_MS);
  }

  console.log(
    `── done: upserted ${totalUpserted} videos, rejected ${totalBanned} banned ──`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
