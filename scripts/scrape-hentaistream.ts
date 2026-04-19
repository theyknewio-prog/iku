#!/usr/bin/env npx tsx
/**
 * scrape-hentaistream.ts
 *
 * tube.hentaistream.com — WP site with Google Sitemap Generator, ~5K
 * episode pages spread across monthly sitemaps from 2011 to present.
 *
 * URL pattern:
 *   https://tube.hentaistream.com/<series-slug>-episode-NN
 *
 * Player flow (2-hop):
 *   1. Episode page → `<iframe src="https://tube.hentaistream.com/frames/s32_*.html">`
 *   2. Frame page (with Referer: episode URL) → `<source src="https://cdnN.streamhentai.org/*.mp4" type="video/mp4">`
 *
 * CDN: cdn1.streamhentai.org / cdn3.streamhentai.org (plain Apache, no CF,
 * no token, no IP binding, Range 206 Partial Content). URL-encoded spaces.
 * Safe to serve direct to browser — no /api/video-stream proxy needed.
 *
 * IMPORTANT — trailer filter: post-2026 uploads are all `*-trailer.mp4`
 * (1–2 min clips, not full episodes). Skip on filename suffix OR tag slug
 * `trailer`. Probably ~50% of recent sitemap entries.
 *
 * Slug: `hst-{hashId}-{slug}`. CSP: cdn*.streamhentai.org,
 * i0.wp.com/i1.wp.com/i2.wp.com (Jetpack Photon for thumbnails),
 * tube.hentaistream.com must be in middleware.ts img-src + media-src.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://tube.hentaistream.com";
const SITEMAP_INDEX = `${BASE}/sitemap.xml`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CONCURRENCY = 3;
const DELAY_MS = 200;

interface HstVideo {
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

async function fetchText(url: string, referer?: string): Promise<string> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xml",
  };
  if (referer) headers.Referer = referer;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchSitemapList(): Promise<string[]> {
  const xml = await fetchText(SITEMAP_INDEX);
  const locs: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const loc = m[1].trim();
    // Only post sitemaps (episode pages). Skip pages/misc/tax/archives.
    if (/\/sitemap-pt-post-\d{4}-\d{2}\.xml$/.test(loc)) locs.push(loc);
  }
  return locs;
}

async function fetchSitemapUrls(
  sitemapUrl: string,
): Promise<{ loc: string; lastmod: string | null }[]> {
  const xml = await fetchText(sitemapUrl);
  const out: { loc: string; lastmod: string | null }[] = [];
  const urlBlocks = xml.split(/<url>/).slice(1);
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();
    // episode pattern: <series>-episode-NN (no trailing slash)
    if (!/-episode-\d+\/?$/i.test(loc)) continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    out.push({ loc, lastmod: lastmodMatch ? lastmodMatch[1].trim() : null });
  }
  return out;
}

function encodeMp4Url(raw: string): string {
  try {
    const u = new URL(raw);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    return u.toString();
  } catch {
    return encodeURI(raw);
  }
}

function extractFrameUrl(html: string): string | null {
  // <iframe src="https://tube.hentaistream.com/frames/s32_*.html">
  const m = html.match(
    /<iframe[^>]+src=["'](https:\/\/tube\.hentaistream\.com\/frames\/[^"']+\.html)["']/i,
  );
  return m ? m[1] : null;
}

function extractMp4FromFrame(html: string): string | null {
  // <source src="https://cdnN.streamhentai.org/*.mp4" type="video/mp4">
  const m = html.match(
    /<source[^>]+src=["'](https?:\/\/[^"']+\.mp4[^"']*)["'][^>]+type=['"]video\/mp4/i,
  );
  if (m) return encodeMp4Url(m[1]);
  // Fallback: any mp4 URL in the frame body.
  const m2 = html.match(/["'](https?:\/\/[^"']+\.mp4)["']/);
  return m2 ? encodeMp4Url(m2[1]) : null;
}

function extractMeta(
  html: string,
  pageUrl: string,
): { slug: string; title: string; thumbnail: string; tags: string[] } | null {
  const slugMatch = pageUrl.match(/\/([a-z0-9][a-z0-9-]+)\/?$/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  let title = "";
  const og = html.match(
    /property=['"]og:title['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (og) title = og[1].trim();
  if (!title) {
    const t = html.match(/<title>([^<]+)<\/title>/);
    if (t)
      title = t[1]
        .replace(/\s*-\s*Hentai Stream.*$/i, "")
        .replace(/\s*\|.*$/i, "")
        .trim();
  }
  if (!title) return null;

  let thumbnail = "";
  const ogi = html.match(
    /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (ogi) thumbnail = ogi[1];

  const tags: string[] = [];
  // post_tag taxonomy: /list/<slug>
  const tagRe = /href=["']\/list\/([a-z0-9][a-z0-9-]+)\/?["']/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const t = tm[1];
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }
  // genres: /genres?genre=<Name>
  const genRe = /href=["'][^"']*\/genres\?genre=([^"'&]+)["']/g;
  while ((tm = genRe.exec(html))) {
    const t = decodeURIComponent(tm[1]).toLowerCase().replace(/\s+/g, "-");
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }

  return { slug, title, thumbnail, tags: tags.slice(0, 15) };
}

async function scrapeVideo(pageUrl: string): Promise<HstVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    const frameUrl = extractFrameUrl(html);
    if (!frameUrl) return null;
    const meta = extractMeta(html, pageUrl);
    if (!meta) return null;
    const frameHtml = await fetchText(frameUrl, pageUrl);
    const mp4 = extractMp4FromFrame(frameHtml);
    if (!mp4) return null;
    // Filter trailers — short 1-2 min clips, not real episodes.
    if (/-trailer\.mp4(\?|$)/i.test(mp4)) return null;
    if (meta.tags.includes("trailer")) return null;
    return {
      id: slugHash(meta.slug),
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

function isBanned(v: HstVideo): boolean {
  if (hasBannedTitle(v.title) || hasBannedTitle(v.slug)) return true;
  for (const t of v.tags) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  return false;
}

function toRow(v: HstVideo, lastmod: string | null) {
  return {
    source: "hentaistream",
    source_id: v.id,
    slug: `hst-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaistream",
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
  console.log("── scrape-hentaistream ── starting ──");

  const sitemaps = await fetchSitemapList();
  console.log(`[index] post sitemaps: ${sitemaps.length}`);

  const queue: { loc: string; lastmod: string | null }[] = [];
  for (const sm of sitemaps) {
    try {
      const entries = await fetchSitemapUrls(sm);
      queue.push(...entries);
    } catch (err) {
      console.warn(`[sitemap] ${sm} — ${(err as Error).message}`);
    }
    await sleep(50);
  }
  console.log(`[queue] total: ${queue.length}`);

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
