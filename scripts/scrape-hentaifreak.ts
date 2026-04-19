#!/usr/bin/env npx tsx
/**
 * scrape-hentaifreak.ts
 *
 * hentaifreak.org — ~2.4K episode pages, 12 post-sitemaps. Last post
 * 2024-06-14 so the site is stale: one-shot scrape, no incremental.
 *
 * URL pattern:
 *   https://hentaifreak.org/<slug>-hentai-video/
 *
 * Extraction — trivially simple: inline `<source src="...mp4">` inside the
 * page's `<video>` element. No AJAX, no iframe, no base64, no JWPlayer
 * packed JS. One regex gets the URL.
 *
 * CDN: `media.hentaifreak.org` (S3 behind Cloudflare, Range 206,
 * `access-control-allow-origin: *`, no tokens, no Referer required,
 * permanent). Filenames contain spaces + brackets — encode with encodeURI
 * (not encodeURIComponent; we need the `/` intact).
 *
 * Because files are old and the site is stale, some 404 — HEAD-probe
 * before upsert to keep the DB clean.
 *
 * Slug: `hfk-{hashId}-{slug}`. CSP: media.hentaifreak.org must be in
 * middleware.ts img-src + media-src.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://hentaifreak.org";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CONCURRENCY = 3;
const DELAY_MS = 150;
const PROBE_MP4 = true;

const SITEMAPS = Array.from(
  { length: 12 },
  (_, i) => `${BASE}/post-sitemap${i + 1}.xml`,
);

interface HfVideo {
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

async function fetchSitemapUrls(
  sitemapUrl: string,
): Promise<{ loc: string; lastmod: string | null; thumb: string | null }[]> {
  const xml = await fetchText(sitemapUrl);
  const out: { loc: string; lastmod: string | null; thumb: string | null }[] =
    [];
  const urlBlocks = xml.split(/<url>/).slice(1);
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();
    if (!/-hentai-video\/?$/.test(loc)) continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    const imgMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/);
    out.push({
      loc,
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
      thumb: imgMatch ? imgMatch[1].trim() : null,
    });
  }
  return out;
}

function encodeMp4Url(raw: string): string {
  // Filenames contain spaces, brackets, CRC hex in [XXXXXXXX]. encodeURI
  // keeps scheme/host/slashes intact and encodes unsafe chars.
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

function extractMp4(html: string): string | null {
  // Primary: <source src="...mp4"> inside the <video>.
  const m = html.match(/<source[^>]+src=["']([^"']+\.mp4[^"']*)["']/i);
  if (m) return encodeMp4Url(m[1]);
  // Fallback: og:video meta (some posts expose it).
  const og = html.match(
    /property=["']og:video["'][^>]*content=["']([^"']+\.mp4[^"']*)["']/i,
  );
  if (og) return encodeMp4Url(og[1]);
  return null;
}

function extractMeta(
  html: string,
  pageUrl: string,
): { slug: string; title: string; thumbnail: string; tags: string[] } | null {
  const slugMatch = pageUrl.match(
    /\/([a-z0-9][a-z0-9-]+?)(?:-hentai-video)?\/?$/,
  );
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
        .replace(/\s*-\s*Hentai Stream and Download.*$/i, "")
        .replace(/\s*-\s*HentaiFreak.*$/i, "")
        .trim();
  }
  if (!title) return null;

  let thumbnail = "";
  const ogi = html.match(
    /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (ogi) thumbnail = ogi[1];

  const tags: string[] = [];
  const tagRe =
    /href=["']https:\/\/hentaifreak\.org\/tags\/([a-z0-9][a-z0-9-]+)\/?["']/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const t = tm[1];
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }

  return { slug, title, thumbnail, tags: tags.slice(0, 15) };
}

async function probeMp4(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT, Range: "bytes=0-1" },
      signal: AbortSignal.timeout(10_000),
    });
    return res.status === 200 || res.status === 206;
  } catch {
    return false;
  }
}

async function scrapeVideo(
  pageUrl: string,
  sitemapThumb: string | null,
): Promise<HfVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    const mp4 = extractMp4(html);
    if (!mp4) return null;
    const meta = extractMeta(html, pageUrl);
    if (!meta) return null;
    if (PROBE_MP4) {
      const ok = await probeMp4(mp4);
      if (!ok) return null;
    }
    return {
      id: slugHash(meta.slug),
      slug: meta.slug,
      title: meta.title,
      thumbnail: meta.thumbnail || sitemapThumb || "",
      mp4Url: mp4,
      pageUrl,
      tags: meta.tags,
    };
  } catch {
    return null;
  }
}

function isBanned(v: HfVideo): boolean {
  if (hasBannedTitle(v.title) || hasBannedTitle(v.slug)) return true;
  for (const t of v.tags) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  return false;
}

function toRow(v: HfVideo, lastmod: string | null) {
  return {
    source: "hentaifreak",
    source_id: v.id,
    slug: `hfk-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaifreak",
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
  console.log("── scrape-hentaifreak ── starting ──");

  const queue: {
    loc: string;
    lastmod: string | null;
    thumb: string | null;
  }[] = [];
  for (const sm of SITEMAPS) {
    try {
      const entries = await fetchSitemapUrls(sm);
      console.log(`[sitemap] ${sm} → ${entries.length}`);
      queue.push(...entries);
      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`[sitemap] ${sm} — ${(err as Error).message}`);
    }
  }
  console.log(`[queue] total: ${queue.length}`);

  let totalUpserted = 0;
  let totalBanned = 0;
  let totalFail = 0;

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const t0 = Date.now();
    const parsed = await Promise.all(
      batch.map((e) => scrapeVideo(e.loc, e.thumb)),
    );

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
