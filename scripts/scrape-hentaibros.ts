#!/usr/bin/env npx tsx
/**
 * scrape-hentaibros.ts
 *
 * hentaibros.net — generic WP + FV Flowplayer plugin, ~3.1K episode posts
 * mixed with blog posts across 4 post-sitemaps.
 *
 * URL pattern (flat, no /video/ or /episodes/ prefix):
 *   https://hentaibros.net/<series-slug>-episode-<N>/
 *
 * Player: inline `<div class="flowplayer" data-item="<JSON-escaped>">` with
 * HTML-entity-encoded JSON, shape:
 *   {"sources":[{"src":"https://povblowjob.net/<Title> <Ep> Sub.mp4","type":"video/mp4"}], ...}
 * MP4 URLs contain literal spaces → URL-encode on ingest. Range-capable (206).
 * No IP tokens, permanent links, no Referer required. Can be handed direct
 * to the browser (no /api/video-stream proxy needed).
 *
 * Slug: `hbro-{hashId}-{slug}`. CSP: povblowjob.net + hentaibros.net wp-uploads
 * must be whitelisted in middleware.ts img-src + media-src.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://hentaibros.net";
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile";
const CONCURRENCY = 4;
const DELAY_MS = 150;

const SITEMAPS = [
  `${BASE}/post-sitemap.xml`,
  `${BASE}/post-sitemap2.xml`,
  `${BASE}/post-sitemap3.xml`,
  `${BASE}/post-sitemap4.xml`,
];

interface HbVideo {
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
): Promise<{ loc: string; lastmod: string | null }[]> {
  const xml = await fetchText(sitemapUrl);
  const out: { loc: string; lastmod: string | null }[] = [];
  const urlBlocks = xml.split(/<url>/).slice(1);
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();
    if (
      loc === BASE ||
      loc === `${BASE}/` ||
      loc.endsWith("/blog/") ||
      loc.includes("/category/") ||
      loc.includes("/genres/") ||
      loc.includes("/anime/")
    )
      continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    out.push({ loc, lastmod: lastmodMatch ? lastmodMatch[1].trim() : null });
  }
  return out;
}

function htmlDecode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function encodeMp4Url(raw: string): string {
  // FV Flowplayer leaves raw spaces in the src. encodeURI keeps the scheme
  // and slashes intact but encodes spaces and other unsafe chars.
  try {
    const u = new URL(raw);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    return u.toString();
  } catch {
    return raw.replace(/ /g, "%20");
  }
}

function extractMp4(html: string): string | null {
  const m = html.match(/data-item=["']([^"']+)["']/);
  if (!m) return null;
  let json: unknown;
  try {
    json = JSON.parse(htmlDecode(m[1]));
  } catch {
    return null;
  }
  if (
    typeof json !== "object" ||
    json === null ||
    !("sources" in json) ||
    !Array.isArray((json as { sources: unknown[] }).sources)
  )
    return null;
  for (const s of (json as { sources: { src?: string; type?: string }[] })
    .sources) {
    if (s && typeof s.src === "string" && /\.mp4/i.test(s.src)) {
      return encodeMp4Url(s.src);
    }
  }
  return null;
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
  if (og) title = htmlDecode(og[1]).trim();
  if (!title) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1) title = htmlDecode(h1[1]).trim();
  }
  if (!title) return null;

  let thumbnail = "";
  const ogi = html.match(
    /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (ogi) thumbnail = ogi[1];
  if (!thumbnail) {
    const up = html.match(
      /(https:\/\/hentaibros\.net\/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|webp|png))/i,
    );
    if (up) thumbnail = up[1];
  }

  const tags: string[] = [];
  const tagRe = /\/genres\/([a-z0-9][a-z0-9-]+)\//g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const t = tm[1];
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }

  return { slug, title, thumbnail, tags: tags.slice(0, 15) };
}

async function scrapeVideo(pageUrl: string): Promise<HbVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    const mp4 = extractMp4(html);
    if (!mp4) return null;
    const meta = extractMeta(html, pageUrl);
    if (!meta) return null;
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

function isBanned(v: HbVideo): boolean {
  if (hasBannedTitle(v.title) || hasBannedTitle(v.slug)) return true;
  for (const t of v.tags) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  return false;
}

function toRow(v: HbVideo, lastmod: string | null) {
  return {
    source: "hentaibros",
    source_id: v.id,
    slug: `hbro-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaibros",
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
  console.log("── scrape-hentaibros ── starting ──");

  const queue: { loc: string; lastmod: string | null }[] = [];
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
  let totalNoMp4 = 0;

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const t0 = Date.now();
    const parsed = await Promise.all(batch.map((e) => scrapeVideo(e.loc)));

    const rows: ReturnType<typeof toRow>[] = [];
    for (let j = 0; j < parsed.length; j++) {
      const v = parsed[j];
      if (!v) {
        totalNoMp4++;
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
      `[${i + batch.length}/${queue.length}] +${upserted} (total ${totalUpserted}, banned ${totalBanned}, no-mp4 ${totalNoMp4}) · ${elapsed}s`,
    );
    await sleep(DELAY_MS);
  }

  console.log(
    `── done: upserted ${totalUpserted}, banned ${totalBanned}, no-mp4 ${totalNoMp4} ──`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
