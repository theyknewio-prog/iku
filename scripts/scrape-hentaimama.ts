#!/usr/bin/env npx tsx
/**
 * scrape-hentaimama.ts
 *
 * hentaimama.io — Dooplay theme (official), ~3.3K episodes.
 *
 * URL pattern:
 *   /episodes/<slug>/   — single episode, type=episodes, data-id=<post_id>
 *
 * Player flow (different from hentaisea fork):
 *   POST /wp-admin/admin-ajax.php
 *     action=get_player_contents&a=<post_id>
 *   → JSON array of iframe HTML strings, e.g.
 *     ["<iframe src=\"https://hentaimama.io/new2.php?p=<base64>\" …>",
 *      "<iframe src=\"https://hentaimama.io/newjav.php?p=<base64>\" …>"]
 *   Each iframe page contains a JWPlayer setup block:
 *     file: "https://gdvid.info/<path>.mp4"
 *   which is the direct Range-capable MP4. We pick the first mirror.
 *
 * Slug: `hmam-{hashId}-{slug}`. CSP: gdvid.info + hentaimama.io CDN hosts
 * must be whitelisted in middleware.ts img-src + media-src.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://hentaimama.io";
const AJAX_URL = `${BASE}/wp-admin/admin-ajax.php`;
// Desktop UA required — iPhone UA gets 403 on episodes-sitemap1.xml.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CONCURRENCY = 3;
const DELAY_MS = 200;

const SITEMAPS = [1, 2].map((i) => `${BASE}/episodes-sitemap${i}.xml`);

interface HmVideo {
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
    if (loc.endsWith("/episodes/") || loc === BASE) continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    out.push({ loc, lastmod: lastmodMatch ? lastmodMatch[1].trim() : null });
  }
  return out;
}

function extractPostId(html: string): number | null {
  // Primary anchor: first starstruck data-id inside the rating block.
  const m = html.match(
    /class=['"]starstruck\s+starstruck-main[^'"]*['"]\s+data-id=['"]([0-9]+)['"]/,
  );
  if (m) return parseInt(m[1], 10);
  // Fallback: body class postid-<N>.
  const body = html.match(/<body[^>]*class=['"][^'"]*postid-([0-9]+)/);
  if (body) return parseInt(body[1], 10);
  return null;
}

async function fetchMp4(postId: number): Promise<string | null> {
  const res = await fetch(AJAX_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json,text/html",
    },
    body: `action=get_player_contents&a=${postId}`,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const txt = await res.text();
  let arr: string[];
  try {
    arr = JSON.parse(txt);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;

  for (const iframeHtml of arr) {
    const srcMatch = iframeHtml.match(/src=['"]([^'"]+)['"]/i);
    if (!srcMatch) continue;
    let iframeUrl = srcMatch[1].replace(/\\\//g, "/");
    if (!iframeUrl.startsWith("http")) continue;

    // Fast path: base64-encoded path in `p` query param decodes to MP4 path.
    const pMatch = iframeUrl.match(/[?&]p=([A-Za-z0-9+/=_-]+)/);
    if (pMatch) {
      try {
        const decoded = Buffer.from(pMatch[1], "base64").toString("utf8");
        if (/\.mp4$/i.test(decoded)) {
          // Try known CDN prefixes — one of these will actually serve it.
          // We'll fall back to fetching the iframe if none work.
          const cdnCandidate = `https://gdvid.info/${decoded.replace(/^\/+/, "")}`;
          const probe = await fetch(cdnCandidate, {
            method: "HEAD",
            headers: { "User-Agent": USER_AGENT, Range: "bytes=0-1" },
            signal: AbortSignal.timeout(10_000),
          }).catch(() => null);
          if (probe && (probe.status === 200 || probe.status === 206))
            return cdnCandidate;
        }
      } catch {
        // fall through to HTML scrape
      }
    }

    // Slow path: fetch iframe page, parse JWPlayer setup for file:.
    try {
      const iframeBody = await fetchText(iframeUrl);
      const fileMatch = iframeBody.match(
        /file:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i,
      );
      if (fileMatch) return fileMatch[1];
      const sourceMatch = iframeBody.match(
        /source:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i,
      );
      if (sourceMatch) return sourceMatch[1];
    } catch {
      // try next mirror
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
  const h1 = html.match(/<h1[^>]*class=['"]epih1['"][^>]*>([^<]+)<\/h1>/);
  if (h1) title = h1[1].trim();
  if (!title) {
    const t = html.match(/<title>([^<]+)<\/title>/);
    if (t) title = t[1].replace(/\s*-\s*HentaiMama.*$/i, "").trim();
  }
  if (!title) return null;

  let thumbnail = "";
  const og = html.match(
    /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (og) thumbnail = og[1];
  if (!thumbnail) {
    const up = html.match(
      /(https:\/\/hentaimama\.io\/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|webp|png))/i,
    );
    if (up) thumbnail = up[1];
  }

  const tags: string[] = [];
  // Dooplay uses /genre/<slug>/ on hentaimama (not /videos-genres/).
  const tagRe = /(?:\/genre\/|data-genre-slug=['"])([a-z0-9][a-z0-9-]+)/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const t = tm[1];
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }

  return { slug, title, thumbnail, tags: tags.slice(0, 15) };
}

async function scrapeVideo(pageUrl: string): Promise<HmVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    const postId = extractPostId(html);
    if (!postId) return null;
    const meta = extractMeta(html, pageUrl);
    if (!meta) return null;
    const mp4 = await fetchMp4(postId);
    if (!mp4) return null;
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

function isBanned(v: HmVideo): boolean {
  if (hasBannedTitle(v.title) || hasBannedTitle(v.slug)) return true;
  for (const t of v.tags) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  return false;
}

function toRow(v: HmVideo, lastmod: string | null) {
  return {
    source: "hentaimama",
    source_id: v.id,
    slug: `hmam-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaimama",
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
  console.log("── scrape-hentaimama ── starting ──");

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
