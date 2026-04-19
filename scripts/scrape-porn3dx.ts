#!/usr/bin/env npx tsx
/**
 * scrape-porn3dx.ts
 *
 * porn3dx.com — 62K+ 3D CGI videos hosted on Bunny Stream (HLS m3u8).
 * Two sitemaps: post_1_sitemap.xml (40K) + post_2_sitemap.xml (22K).
 *
 * URL shape: /post/{id}/{slug}
 * Video ref: `vz-c0fe498e-5ab.b-cdn.net/{guid}/thumbnail.jpg` appears inline
 *            in the HTML → extract the GUID, build playlist URL:
 *            https://vz-{lib}.b-cdn.net/{guid}/playlist.m3u8
 * Thumbnail: https://vz-{lib}.b-cdn.net/{guid}/thumbnail.jpg
 * Tags: <a href="https://porn3dx.com/tag/{tag}"> — 15 max
 *
 * CORS: * (open). No token, no IP bind. Master playlist with 5 bitrates.
 *
 * WatchPlayer.tsx handles .m3u8 via HLS.js; CSP + /api/video-stream allow
 * b-cdn.net.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://porn3dx.com";
const SITEMAPS = [
  `${BASE}/sitemaps/post_1_sitemap.xml`,
  `${BASE}/sitemaps/post_2_sitemap.xml`,
];
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CONCURRENCY = 3;
const DELAY_MS = 200;

interface P3dxVideo {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
  m3u8Url: string;
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
  const out: { loc: string; lastmod: string | null }[] = [];
  for (const sm of SITEMAPS) {
    try {
      const xml = await fetchText(sm);
      const urlBlocks = xml.split(/<url>/).slice(1);
      for (const block of urlBlocks) {
        const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
        if (!locMatch) continue;
        const loc = locMatch[1].trim();
        if (!/\/post\/\d+\//.test(loc)) continue;
        const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
        out.push({
          loc,
          lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
        });
      }
      console.log(`[sitemap] ${sm} → ${urlBlocks.length} entries`);
    } catch (e) {
      console.error(`[sitemap fail] ${sm}: ${(e as Error).message}`);
    }
  }
  return out;
}

function extractBunnyRef(html: string): { lib: string; guid: string } | null {
  // Look for any vz-{lib}.b-cdn.net/{guid}/... reference in the HTML.
  const m = html.match(/vz-([a-z0-9-]+)\.b-cdn\.net\/([a-f0-9-]{30,40})\//i);
  if (!m) return null;
  return { lib: m[1], guid: m[2] };
}

function extractMeta(
  html: string,
  pageUrl: string,
): {
  id: number;
  slug: string;
  title: string;
  tags: string[];
} | null {
  const m = pageUrl.match(/\/post\/(\d+)\/([a-z0-9][a-z0-9-]+)/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  const slug = m[2];

  let title = "";
  const og = html.match(
    /property=['"]og:title['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (og) {
    title = og[1]
      .replace(/\s*-\s*[^-]+\s*-\s*Porn3dx\s*$/i, "")
      .replace(/\s*-\s*Porn3dx\s*$/i, "")
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
  }
  if (!title) return null;

  const tags: string[] = [];
  const tagRe = /href=["']https?:\/\/porn3dx\.com\/tag\/([a-z0-9][a-z0-9-]+)/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const t = tm[1];
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }

  return { id, slug, title, tags: tags.slice(0, 15) };
}

async function scrapeVideo(pageUrl: string): Promise<P3dxVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    const bunny = extractBunnyRef(html);
    if (!bunny) return null;
    const meta = extractMeta(html, pageUrl);
    if (!meta) return null;
    return {
      id: meta.id || slugHash(meta.slug),
      slug: meta.slug,
      title: meta.title,
      thumbnail: `https://vz-${bunny.lib}.b-cdn.net/${bunny.guid}/thumbnail.jpg`,
      m3u8Url: `https://vz-${bunny.lib}.b-cdn.net/${bunny.guid}/playlist.m3u8`,
      pageUrl,
      tags: meta.tags,
    };
  } catch {
    return null;
  }
}

function isBanned(v: P3dxVideo): boolean {
  if (hasBannedTitle(v.title) || hasBannedTitle(v.slug)) return true;
  for (const t of v.tags) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  return false;
}

function toRow(v: P3dxVideo, lastmod: string | null) {
  return {
    source: "porn3dx",
    source_id: v.id,
    slug: `p3dx-${v.id}-${v.slug}`.slice(0, 200),
    url: v.m3u8Url,
    page_url: v.pageUrl,
    site: "porn3dx",
    title: v.title,
    thumbnail: v.thumbnail,
    preview: v.thumbnail,
    score: 0,
    favorites: 0,
    tags: v.tags,
    characters: [] as string[],
    copyrights: [] as string[],
    artists: [] as string[],
    width: 1920,
    height: 1080,
    file_size: 0,
    duration: null,
    created_at: lastmod || new Date().toISOString(),
  };
}

async function main() {
  console.log("── scrape-porn3dx ── starting ──");

  const queue = await fetchSitemapUrls();
  console.log(`[total] ${queue.length} post URLs`);

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

    if ((i / CONCURRENCY) % 20 === 0 || i + CONCURRENCY >= queue.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `[${i + batch.length}/${queue.length}] +${upserted} (total ${totalUpserted}, banned ${totalBanned}, fail ${totalFail}) · ${elapsed}s`,
      );
    }
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
