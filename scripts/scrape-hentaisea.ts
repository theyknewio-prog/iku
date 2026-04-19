#!/usr/bin/env npx tsx
/**
 * scrape-hentaisea.ts
 *
 * hentaisea.com — Dooplay WP theme. ~3.6K "movies" + ~5K "tvshows" landing
 * pages. Movies are watch-in-place. TV shows list episodes at
 * /episodes/<slug>-episode-N/ — we fan out per episode.
 *
 *   Movies:   /videos/<slug>/       type=movie      data-post in HTML
 *   Tvshows:  /watch/<slug>/        (no player — just lists /episodes/ links)
 *   Episodes: /episodes/<slug>-ep-N/  type=tv       data-post in HTML
 *
 * Player is lazy-loaded via admin-ajax.php. POST body:
 *   action=doo_player_ajax&post=<id>&nume=1&type=<movie|tv>
 * Response is a <iframe src="https://hentaisea.com/jwplayer/?source=<URL-ENCODED MP4>&...">.
 * We decode the `source` param → direct MP4. MP4s live on hentaisea.com/mp4/
 * or external CDNs (seen: freakpornos.com). Range-capable (206 on seek).
 *
 * Slug: `hs-{hashId}-{slug}`. CSP: hentaisea.com + freakpornos.com must be
 * whitelisted in middleware.ts img-src + media-src.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://hentaisea.com";
const AJAX_URL = `${BASE}/wp-admin/admin-ajax.php`;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile";
const CONCURRENCY = 4;
const DELAY_MS = 150;

const MOVIES_SITEMAPS = [1, 2, 3, 4].map(
  (i) => `${BASE}/movies-sitemap${i}.xml`,
);
const TVSHOWS_SITEMAPS = [1, 2, 3, 4, 5, 6].map(
  (i) => `${BASE}/tvshows-sitemap${i}.xml`,
);

interface HsVideo {
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
    if (loc.endsWith("/videos/") || loc.endsWith("/tvshows/") || loc === BASE)
      continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    out.push({ loc, lastmod: lastmodMatch ? lastmodMatch[1].trim() : null });
  }
  return out;
}

function extractEpisodeLinks(html: string): string[] {
  const out = new Set<string>();
  const re = /href=['"](https:\/\/hentaisea\.com\/episodes\/[^'"]+?)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let u = m[1];
    if (!u.endsWith("/")) u += "/";
    out.add(u);
  }
  return [...out];
}

function extractPostInfo(
  html: string,
): { postId: number; type: string } | null {
  const m = html.match(
    /dooplay_player_option'?\s+data-type=['"]([^'"]+)['"]\s+data-post=['"]([0-9]+)['"]/,
  );
  if (!m) return null;
  return { type: m[1], postId: parseInt(m[2], 10) };
}

async function fetchMp4(postId: number, type: string): Promise<string | null> {
  const res = await fetch(AJAX_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    body: `action=doo_player_ajax&post=${postId}&nume=1&type=${type}`,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const txt = await res.text();
  const srcMatch = txt.match(/src=['"]([^'"]+\/jwplayer\/\?[^'"]+)['"]/i);
  if (!srcMatch) return null;
  const urlMatch = srcMatch[1].match(/[?&]source=([^&]+)/);
  if (!urlMatch) return null;
  try {
    const decoded = decodeURIComponent(urlMatch[1]);
    if (!/^https?:\/\/.+\.mp4/i.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function extractMeta(
  html: string,
  pageUrl: string,
): { slug: string; title: string; thumbnail: string; tags: string[] } | null {
  const slugMatch = pageUrl.match(/\/([a-z0-9][a-z0-9-]+)\/?$/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  let title = "";
  const h1Match = html.match(/<h1[^>]*class=['"]hmovie['"][^>]*>([^<]+)<\/h1>/);
  if (h1Match) title = h1Match[1].trim();
  if (!title) {
    const t = html.match(/<title>([^<]+)<\/title>/);
    if (t) title = t[1].replace(/\s*\|\s*Hentaisea.*$/i, "").trim();
  }
  if (!title) return null;

  let thumbnail = "";
  const og = html.match(
    /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (og) thumbnail = og[1];
  if (!thumbnail) {
    const tub = html.match(
      /(https:\/\/hentaisea\.com\/wp-content\/uploads\/tube-thumbs\/[^"'\s]+\.(?:jpg|jpeg|webp|png))/i,
    );
    if (tub) thumbnail = tub[1];
  }

  const tags: string[] = [];
  const tagRe = /videos-genres\/([a-z0-9][a-z0-9-]+)\//g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const t = tm[1];
    if (t.length < 40 && !tags.includes(t)) tags.push(t);
  }

  return { slug, title, thumbnail, tags: tags.slice(0, 15) };
}

async function scrapeVideo(pageUrl: string): Promise<HsVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    const info = extractPostInfo(html);
    if (!info) return null;
    const meta = extractMeta(html, pageUrl);
    if (!meta) return null;
    const mp4 = await fetchMp4(info.postId, info.type);
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
  } catch (err) {
    return null;
  }
}

async function scrapeTvShowEpisodes(pageUrl: string): Promise<string[]> {
  try {
    const html = await fetchText(pageUrl);
    return extractEpisodeLinks(html);
  } catch {
    return [];
  }
}

function isBanned(v: HsVideo): boolean {
  if (hasBannedTitle(v.title) || hasBannedTitle(v.slug)) return true;
  for (const t of v.tags) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  return false;
}

function toRow(v: HsVideo, lastmod: string | null) {
  return {
    source: "hentaisea",
    source_id: v.id,
    slug: `hs-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaisea",
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
  console.log("── scrape-hentaisea ── starting ──");

  // 1) Movies sitemaps → /videos/ URLs (direct watch pages)
  const movieUrls: { loc: string; lastmod: string | null }[] = [];
  for (const sm of MOVIES_SITEMAPS) {
    try {
      const entries = await fetchSitemapUrls(sm);
      console.log(`[movies-sm] ${sm} → ${entries.length}`);
      movieUrls.push(...entries);
      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`[movies-sm] ${sm} — ${(err as Error).message}`);
    }
  }

  // 2) Tvshows sitemaps → /watch/ landing → expand to /episodes/ URLs
  const tvshowUrls: string[] = [];
  for (const sm of TVSHOWS_SITEMAPS) {
    try {
      const entries = await fetchSitemapUrls(sm);
      console.log(`[tv-sm] ${sm} → ${entries.length}`);
      tvshowUrls.push(...entries.map((e) => e.loc));
      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`[tv-sm] ${sm} — ${(err as Error).message}`);
    }
  }

  // Expand tvshows → episodes (CONCURRENCY parallel)
  console.log(`[expand] expanding ${tvshowUrls.length} tvshows → episodes…`);
  const episodeUrls = new Set<string>();
  for (let i = 0; i < tvshowUrls.length; i += CONCURRENCY) {
    const batch = tvshowUrls.slice(i, i + CONCURRENCY);
    const lists = await Promise.all(batch.map(scrapeTvShowEpisodes));
    for (const l of lists) for (const u of l) episodeUrls.add(u);
    if (i % 200 === 0)
      console.log(
        `  [expand] ${i + batch.length}/${tvshowUrls.length} → ${episodeUrls.size} episodes`,
      );
    await sleep(DELAY_MS);
  }
  console.log(`[expand] ${episodeUrls.size} episodes discovered`);

  // Unified URL queue
  const queue: { loc: string; lastmod: string | null }[] = [
    ...movieUrls,
    ...[...episodeUrls].map((loc) => ({ loc, lastmod: null })),
  ];
  console.log(
    `[queue] ${queue.length} total URLs (${movieUrls.length} movies + ${episodeUrls.size} episodes)`,
  );

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
    if (rows.length > 0) {
      upserted = await upsertVideos(rows);
    }

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
