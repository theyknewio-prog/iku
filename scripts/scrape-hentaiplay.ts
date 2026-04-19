#!/usr/bin/env npx tsx
/**
 * scrape-hentaiplay.ts
 *
 * hentaiplay.net — WordPress/Yoast sitemap. ~3.9K EN-subbed 2D hentai episodes.
 * Direct MP4 source on `hentaiplanet.info` (Range-capable, 206 on seek).
 *   <source src="https://hentaiplanet.info/Foo_Episode_1_English_700x400_Subbed.mp4" type="video/mp4">
 * Thumbnail on same host: `https://hentaiplanet.info/tmb/*.jpg` (fallback wp-content/uploads).
 *
 * Slug: `hpl-{hashId}-{slug}`.
 * CSP: hentaiplanet.info must be whitelisted in middleware.ts img-src + media-src.
 */

import { createHash } from "crypto";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://hentaiplay.net";
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile";
const CONCURRENCY = 4;
const DELAY_MS = 200;

const SITEMAPS = [
  `${BASE}/post-sitemap.xml`,
  `${BASE}/post-sitemap2.xml`,
  `${BASE}/post-sitemap3.xml`,
  `${BASE}/post-sitemap4.xml`,
];

interface HpVideo {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
  mp4Url: string;
  pageUrl: string;
  tags: string[];
  createdAt: string | null;
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
): Promise<{ loc: string; lastmod: string | null; image: string | null }[]> {
  const xml = await fetchText(sitemapUrl);
  const out: { loc: string; lastmod: string | null; image: string | null }[] =
    [];
  const urlBlocks = xml.split(/<url>/).slice(1);
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();
    if (
      loc === `${BASE}/` ||
      loc.endsWith("/category/") ||
      loc.includes("/tag/")
    )
      continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    const imageMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/);
    out.push({
      loc,
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
      image: imageMatch ? imageMatch[1].trim() : null,
    });
  }
  return out;
}

function extractDetail(
  html: string,
  pageUrl: string,
  fallbackThumb: string | null,
): HpVideo | null {
  const mp4Match = html.match(
    /<source[^>]*src="(https:\/\/hentaiplanet\.info\/[^"]+\.mp4)"/i,
  );
  if (!mp4Match) return null;
  const mp4Url = mp4Match[1];

  const slugMatch = pageUrl.match(/\/([a-z0-9][a-z0-9-]+)\/?$/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  let title = "";
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    title = titleMatch[1]
      .replace(/\s*[-|]\s*Hentai\s*Play.*$/i, "")
      .replace(/\s*\|.*$/, "")
      .replace(/^\s*Watch\s+/i, "")
      .trim();
  }
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) title = h1Match[1].trim();
  }
  if (!title) return null;

  // Thumb priority: hentaiplanet.info/tmb/* → sitemap image → wp-content/uploads
  let thumbnail = "";
  const tmbMatch = html.match(
    /(https:\/\/hentaiplanet\.info\/tmb\/[^"'\s]+\.(?:jpg|jpeg|webp|png))/i,
  );
  if (tmbMatch) thumbnail = tmbMatch[1];
  if (!thumbnail && fallbackThumb) thumbnail = fallbackThumb;
  if (!thumbnail) {
    const wpMatch = html.match(
      /(https:\/\/hentaiplay\.net\/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|webp|png))/i,
    );
    if (wpMatch) thumbnail = wpMatch[1];
  }

  // Post-specific tags live on the main post wrapper. Multiple divs on the
  // page have `post-<id>` classes (related posts, tag cloud, etc.), so we
  // anchor via `id="post-<ID>"` which only appears on the canonical wrapper.
  // Body class `postid-<N>` tells us which ID to target.
  const tags: string[] = [];
  const bodyMatch = html.match(/<body[^>]*class="([^"]+)"/);
  const postIdMatch = bodyMatch ? bodyMatch[1].match(/\bpostid-(\d+)\b/) : null;
  if (postIdMatch) {
    const pid = postIdMatch[1];
    const wrapperRe = new RegExp(
      `<(?:article|div)[^>]*class="([^"]+)"[^>]*id="post-${pid}"`,
    );
    const wrapperMatch = html.match(wrapperRe);
    if (wrapperMatch) {
      const classRe = /\btag-([a-z0-9][a-z0-9-]*)\b/g;
      let cm: RegExpExecArray | null;
      while ((cm = classRe.exec(wrapperMatch[1]))) {
        const tag = cm[1];
        if (tag && tag.length < 40 && !/^\d+$/.test(tag) && !tags.includes(tag))
          tags.push(tag);
      }
    }
  }

  return {
    id: slugHash(slug),
    slug,
    title,
    thumbnail,
    mp4Url,
    pageUrl,
    tags: tags.slice(0, 15),
    createdAt: null,
  };
}

function isBanned(v: HpVideo): boolean {
  if (hasBannedTitle(v.title)) return true;
  if (hasBannedTitle(v.slug)) return true;
  for (const tag of v.tags) {
    if (BANNED_TAGS.has(tag.toLowerCase())) return true;
  }
  return false;
}

async function scrapeDetail(
  pageUrl: string,
  fallbackThumb: string | null,
): Promise<HpVideo | null> {
  try {
    const html = await fetchText(pageUrl);
    return extractDetail(html, pageUrl, fallbackThumb);
  } catch (err) {
    console.warn(`[detail] ${pageUrl} — ${(err as Error).message}`);
    return null;
  }
}

function toRow(v: HpVideo, lastmod: string | null) {
  return {
    source: "hentaiplay",
    source_id: v.id,
    slug: `hpl-${v.id}-${v.slug}`.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hentaiplay",
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
  console.log("── scrape-hentaiplay ── starting ──");

  const allEntries: {
    loc: string;
    lastmod: string | null;
    image: string | null;
  }[] = [];

  for (const smUrl of SITEMAPS) {
    try {
      const entries = await fetchSitemapUrls(smUrl);
      console.log(`[sitemap] ${smUrl} → ${entries.length} URLs`);
      allEntries.push(...entries);
      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`[sitemap] ${smUrl} → ${(err as Error).message}`);
    }
  }
  console.log(`[sitemap] total candidate URLs: ${allEntries.length}`);

  let totalUpserted = 0;
  let totalBanned = 0;
  let totalNoMp4 = 0;

  for (let i = 0; i < allEntries.length; i += CONCURRENCY) {
    const batch = allEntries.slice(i, i + CONCURRENCY);
    const t0 = Date.now();
    const parsed = await Promise.all(
      batch.map((e) => scrapeDetail(e.loc, e.image)),
    );

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
    if (rows.length > 0) {
      upserted = await upsertVideos(rows);
    }

    totalUpserted += upserted;
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `[${i + batch.length}/${allEntries.length}] +${upserted} (total ${totalUpserted}, banned ${totalBanned}, no-mp4 ${totalNoMp4}) · ${elapsed}s`,
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
