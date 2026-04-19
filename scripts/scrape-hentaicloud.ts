#!/usr/bin/env npx tsx
/**
 * scrape-hentaicloud.ts
 *
 * hentaicloud.com — small but clean English hentai tube, ~2.5K videos.
 * Plain nginx, no Cloudflare, no rate limit, no bot block.
 *
 * Sitemap: `/sitemap.php` → single XML urlset with ~2462 `<url>` entries.
 *   URL shapes:
 *     /video/<id>/<slug>/episode<N>/english     — episode pages
 *     /gif/<id>/<slug>                           — gif pages (skip)
 *
 * Extraction: trivial. Inline `<source src="/media/videos/hd/<id>.mp4">`
 * (video.js player). Same-origin, no token, no CF, Range 206, CORS default.
 * Thumbnail: `/media/videos/tmb/<id>/default.jpg`.
 *
 * Tags: `<a href="/videos/<tag>">` inside the page's tag list.
 *
 * Slug: `hcld-{hashId}-{slug}`. CSP: hentaicloud.com must be whitelisted in
 * middleware.ts img-src + media-src.
 *
 * Crawl-delay 5s advertised in robots.txt; we run CONCURRENCY=2 to be polite.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://www.hentaicloud.com";
const SITEMAP = `${BASE}/sitemap.php`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CONCURRENCY = 2;
const DELAY_MS = 400; // crawl-delay 5s advertised; we batch 2 so ~2.5s/video

interface HcVideo {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
  mp4Url: string;
  pageUrl: string;
  tags: string[];
}

function slugHash(slug: string): number {
  const h = createHash("sha256").update(slug).digest("hex");
  return parseInt(h.slice(0, 8), 16) & 0x7fffffff;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchSitemapUrls(): Promise<
  { loc: string; lastmod: string | null }[]
> {
  const xml = await fetchText(SITEMAP);
  const out: { loc: string; lastmod: string | null }[] = [];
  const urlBlocks = xml.split(/<url>/).slice(1);
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();
    // Only episode pages. Skip /gif/, /videos/ (tag pages), /siteadmin/, etc.
    if (!/\/video\/\d+\//.test(loc)) continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    out.push({ loc, lastmod: lastmodMatch ? lastmodMatch[1].trim() : null });
  }
  return out;
}

function extractMp4(html: string): string | null {
  // Page serves 3 sources: mobile_src.php redirector (skip), iphone mp4,
  // hd mp4. Prefer hd, fallback to iphone.
  const hd = html.match(
    /<source[^>]+src=["']([^"']*\/media\/videos\/hd\/[^"']+\.mp4[^"']*)["']/i,
  );
  const m =
    hd ||
    html.match(
      /<source[^>]+src=["']([^"']*\/media\/videos\/iphone\/[^"']+\.mp4[^"']*)["']/i,
    );
  if (!m) return null;
  const raw = m[1];
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${BASE}${raw}`;
  return raw;
}

function extractMeta(
  html: string,
  pageUrl: string,
): {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
  tags: string[];
} | null {
  // URL: /video/<id>/<slug>/episode<N>/english
  const m = pageUrl.match(/\/video\/(\d+)\/([a-z0-9][a-z0-9-]+)/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  const slug = m[2];

  let title = "";
  const og = html.match(
    /property=['"]og:title['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (og) title = og[1].trim();
  if (!title) {
    const t = html.match(/<title>([^<]+)<\/title>/);
    if (t) title = t[1].replace(/\s*[-|]\s*Hentai\s*Cloud.*$/i, "").trim();
  }
  if (!title) return null;

  let thumbnail = `${BASE}/media/videos/tmb/${id}/default.jpg`;
  const ogi = html.match(
    /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (ogi) thumbnail = ogi[1].startsWith("//") ? `https:${ogi[1]}` : ogi[1];

  const tags: string[] = [];
  // <a href="/videos/<tag>">
  const tagRe = /href=["']\/videos\/([a-z0-9][a-z0-9-]+)\/?["']/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const t = tm[1];
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }

  return { id, slug, title, thumbnail, tags: tags.slice(0, 15) };
}

async function scrapeVideo(pageUrl: string): Promise<HcVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    const mp4 = extractMp4(html);
    if (!mp4) return null;
    const meta = extractMeta(html, pageUrl);
    if (!meta) return null;
    return {
      id: meta.id || slugHash(meta.slug),
      slug: meta.slug,
      title: meta.title,
      thumbnail: meta.thumbnail,
      mp4Url: mp4,
      pageUrl,
      tags: meta.tags,
    };
  } catch {
    return null;
  }
}

function isBanned(v: HcVideo): boolean {
  if (hasBannedTitle(v.title) || hasBannedTitle(v.slug)) return true;
  for (const t of v.tags) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  return false;
}

function toRow(v: HcVideo, lastmod: string | null) {
  return {
    source: "hentaicloud",
    source_id: v.id,
    slug: `hcld-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaicloud",
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
    duration: null,
    created_at: lastmod || new Date().toISOString(),
  };
}

async function main() {
  console.log("── scrape-hentaicloud ── starting ──");

  const queue = await fetchSitemapUrls();
  console.log(`[sitemap] ${SITEMAP} → ${queue.length} episode URLs`);

  let totalUpserted = 0;
  let totalBanned = 0;
  let totalFail = 0;

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const t0 = Date.now();
    const parsed = await Promise.all(batch.map((e) => scrapeVideo(e.loc)));

    const rows: ReturnType<typeof toRow>[] = [];
    for (let j = 0; j < parsed.length; j++) {
      const v = parsed[j];
      if (!v) {
        totalFail++;
        continue;
      }
      if (isBanned(v)) {
        totalBanned++;
        continue;
      }
      rows.push(toRow(v, batch[j].lastmod));
    }

    let upserted = 0;
    if (rows.length > 0) upserted = await upsertVideos(rows);
    totalUpserted += upserted;

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `[${i + batch.length}/${queue.length}] +${upserted} (total ${totalUpserted}, banned ${totalBanned}, fail ${totalFail}) · ${elapsed}s`,
    );
    await sleep(DELAY_MS);
  }

  console.log(
    `── done: upserted ${totalUpserted}, banned ${totalBanned}, fail ${totalFail} ──`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
