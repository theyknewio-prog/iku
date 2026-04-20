#!/usr/bin/env npx tsx
/**
 * scrape-hanime1.ts
 *
 * hanime1.me — Taiwan-based hentai streaming, ~17.8K videos (not 50-100K
 * as originally projected). Pure SSR, no JSON API, no sitemap.
 *
 * Enumeration:
 *   GET /search?page=1..302 (59 IDs/page). Scrape /watch?v=<id> links,
 *   dedup. Real tail is ~302 (empty after). Homepage /?page=N caps at
 *   ~800 with duplicate fallback — don't use it.
 *
 * Extraction (per watch page):
 *   <source src="https://vdownload.hembed.com/<id>-<q>p.mp4?secure=..."
 *           type="video/mp4" size="<bytes>">
 *   All qualities (360/480/720/1080p) are inline. Pick highest.
 *
 *   og:title, og:image (thumbnail/<id>h.jpg), og:video:duration.
 *   Tags: href="/search?tags%5B%5D=<tag>"  (URL-decoded CN string)
 *
 * CDN: vdownload.hembed.com — CORS *, no Referer required. BUT the token
 * in ?secure=... expires in ~7 days. Scraper must run weekly to refresh.
 *
 * Watch pages require full headers (UA + Accept-Language + Referer). A
 * bare Mozilla UA gets 403. Listing pages are lenient.
 *
 * Banned content: hanime uses CN/JP terms (幼女, ロリ, 小学生…). Added
 * to banned-tags.ts 2026-04-19. hasBannedTitle + tag check applied.
 *
 * Slug: `hn1-{id}`. CSP: add vdownload.hembed.com to img-src + media-src.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const execFileAsync = promisify(execFile);

const BASE = "https://hanime1.me";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const LISTING_CONCURRENCY = 1; // CF 403s bursts above ~72 pages consecutively
const WATCH_CONCURRENCY = 2;
const DELAY_MS = 700;
const WATCH_DELAY_MS = 450;
const MAX_PAGES = 320; // safety bound — real tail ~302
const IDS_CACHE = "data/hanime1-ids.json";

// CF fingerprints Node's undici differently than curl and returns 403.
// The scraper runs locally (Paris) where listing + watch work via curl.
// Noise like "1080p" comes from video-quality labels inside /search?tags
// links — strip these before storing.
const QUALITY_TOKENS = new Set([
  "1080p",
  "720p",
  "480p",
  "360p",
  "240p",
  "hd",
  "fhd",
  "uhd",
]);

interface Hn1Video {
  id: number;
  title: string;
  thumbnail: string;
  mp4Url: string;
  pageUrl: string;
  tags: string[];
  duration: number | null;
  width: number;
  height: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(
  url: string,
  opts: { referer?: string; maxAttempts?: number } = {},
): Promise<string> {
  const max = opts.maxAttempts ?? 3;
  const args = [
    "-sSL",
    "--compressed",
    "--max-time",
    "25",
    "--fail",
    "-H",
    `User-Agent: ${UA}`,
    "-H",
    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "-H",
    "Accept-Language: zh-TW,zh;q=0.9,en;q=0.8",
  ];
  if (opts.referer) args.push("-H", `Referer: ${opts.referer}`);
  args.push(url);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const { stdout } = await execFileAsync("curl", args, {
        maxBuffer: 20 * 1024 * 1024,
      });
      return stdout;
    } catch (e) {
      lastErr = e;
      const err = e as { stderr?: string };
      const is403 = err.stderr?.includes("error: 403");
      if (attempt < max && is403) {
        // CF cooldown is short (~30s for bursty traffic). Back off.
        const wait = 15_000 * attempt;
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function fetchListingIds(page: number): Promise<number[]> {
  const url = `${BASE}/search?page=${page}`;
  const html = await fetchHtml(url, { referer: BASE });
  const ids = new Set<number>();
  const re = /\/watch\?v=(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) ids.add(parseInt(m[1], 10));
  return Array.from(ids);
}

function saveIds(ids: number[]): void {
  const dir = dirname(IDS_CACHE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(IDS_CACHE, JSON.stringify(ids));
}

function loadIds(): number[] | null {
  if (!existsSync(IDS_CACHE)) return null;
  try {
    const raw = readFileSync(IDS_CACHE, "utf8");
    const ids = JSON.parse(raw) as number[];
    return Array.isArray(ids) && ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

async function enumerateAllIds(): Promise<number[]> {
  const cached = loadIds();
  if (cached) {
    console.log(`[enum] loaded ${cached.length} IDs from ${IDS_CACHE}`);
    return cached;
  }
  const all = new Set<number>();
  let emptyStreak = 0;
  for (let start = 1; start <= MAX_PAGES; start += LISTING_CONCURRENCY) {
    const batch: number[] = [];
    for (let p = start; p < start + LISTING_CONCURRENCY && p <= MAX_PAGES; p++)
      batch.push(p);
    const results = await Promise.all(
      batch.map((p) =>
        fetchListingIds(p).catch((err) => {
          console.warn(`[listing p${p}] ${(err as Error).message}`);
          return [] as number[];
        }),
      ),
    );
    let gotAny = false;
    for (const ids of results) {
      if (ids.length === 0) emptyStreak++;
      else {
        gotAny = true;
        emptyStreak = 0;
        for (const id of ids) all.add(id);
      }
    }
    const last = batch[batch.length - 1];
    if (start % 10 === 1 || !gotAny) {
      console.log(
        `[listing] pages ${batch[0]}-${last} → total unique IDs: ${all.size}`,
      );
    }
    // Snapshot to disk every 20 pages so crashes don't lose progress.
    if (start % 20 === 1 && all.size > 0) {
      saveIds(Array.from(all).sort((a, b) => b - a));
    }
    if (!gotAny && emptyStreak >= 10) {
      console.log(`[listing] end reached (${emptyStreak} empty pages)`);
      break;
    }
    await sleep(DELAY_MS);
  }
  const final = Array.from(all).sort((a, b) => b - a);
  saveIds(final);
  return final;
}

function extractBestMp4(
  html: string,
): { url: string; height: number; size: number } | null {
  // <source src="https://vdownload[-N].hembed.com/<id>-<q>p.mp4?(secure|token)=..."
  //         type="video/mp4" size="<bytes>">
  // 2026-04: hanime1 migrated some videos from vdownload.hembed.com (secure=)
  // to vdownload-{1..N}.hembed.com (token=&expires=). Accept both.
  const re =
    /<source[^>]+src=["'](https:\/\/vdownload(?:-\d+)?\.hembed\.com\/[^"']+\.mp4[^"']*)["'][^>]+type=["']video\/mp4["'][^>]*(?:size=["'](\d+)["'])?/gi;
  const sources: { url: string; height: number; size: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = m[1];
    const size = m[2] ? parseInt(m[2], 10) : 0;
    const qm = url.match(/-(\d+)p\.mp4/);
    const height = qm ? parseInt(qm[1], 10) : 0;
    sources.push({ url, height, size });
  }
  if (sources.length === 0) return null;
  sources.sort((a, b) => b.height - a.height || b.size - a.size);
  return sources[0];
}

function extractMeta(
  html: string,
  id: number,
): {
  title: string;
  thumbnail: string;
  tags: string[];
  duration: number | null;
} | null {
  let title = "";
  const og = html.match(
    /property=['"]og:title['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (og) title = og[1].trim();
  if (!title) {
    const t = html.match(/<title>([^<]+)<\/title>/);
    if (t) title = t[1].trim();
  }
  // Both og:title and <title> contain the " - Hanime1.me" suffix on most
  // pages. Always strip — users see this text in cards and it looks messy.
  title = title.replace(/\s*[-|]\s*Hanime1\.me.*$/i, "").trim();
  if (!title) return null;

  let thumbnail = "";
  const ogi = html.match(
    /property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/,
  );
  if (ogi) thumbnail = ogi[1];

  let duration: number | null = null;
  const dur = html.match(
    /property=['"]og:video:duration['"][^>]*content=['"](\d+)['"]/,
  );
  if (dur) duration = parseInt(dur[1], 10);

  // /search?tags%5B%5D=<cn-tag>  (URL-encoded brackets)
  const tags: string[] = [];
  const tagRe = /href=["'][^"']*\/search\?tags%5B%5D=([^"'&]+)["']/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    try {
      const t = decodeURIComponent(tm[1]).trim();
      if (!t || t.length >= 40) continue;
      if (QUALITY_TOKENS.has(t.toLowerCase())) continue;
      if (!tags.includes(t)) tags.push(t);
    } catch {
      // bad encoding, skip
    }
  }

  return { title, thumbnail, tags: tags.slice(0, 15), duration };
}

async function scrapeVideo(
  id: number,
): Promise<{ video: Hn1Video | null; err?: string }> {
  const pageUrl = `${BASE}/watch?v=${id}`;
  try {
    const html = await fetchHtml(pageUrl, { referer: `${BASE}/` });
    const best = extractBestMp4(html);
    if (!best) return { video: null, err: "no-mp4" };
    const meta = extractMeta(html, id);
    if (!meta) return { video: null, err: "no-meta" };
    const height = best.height || 720;
    const width = Math.round((height * 16) / 9);
    return {
      video: {
        id,
        title: meta.title,
        thumbnail: meta.thumbnail,
        mp4Url: best.url,
        pageUrl,
        tags: meta.tags,
        duration: meta.duration,
        width,
        height,
      },
    };
  } catch (e: unknown) {
    const err = e as { code?: string; stderr?: string };
    const msg = err.code
      ? `${err.code}${err.stderr ? ` ${err.stderr.slice(0, 80)}` : ""}`
      : String(e).slice(0, 120);
    return { video: null, err: msg };
  }
}

function isBanned(v: Hn1Video): boolean {
  if (hasBannedTitle(v.title)) return true;
  for (const t of v.tags) {
    if (BANNED_TAGS.has(t.toLowerCase()) || BANNED_TAGS.has(t)) return true;
  }
  return false;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function toRow(v: Hn1Video) {
  const asciiSlug = slugify(v.title);
  const slug = asciiSlug ? `hn1-${v.id}-${asciiSlug}` : `hn1-${v.id}`;
  return {
    source: "hanime1",
    source_id: v.id,
    slug: slug.slice(0, 200),
    url: v.mp4Url,
    page_url: v.pageUrl,
    site: "hanime1",
    title: v.title,
    thumbnail: v.thumbnail,
    preview: v.thumbnail,
    score: 0,
    favorites: 0,
    tags: v.tags,
    characters: [] as string[],
    copyrights: [] as string[],
    artists: [] as string[],
    width: v.width,
    height: v.height,
    file_size: 0,
    duration: v.duration,
    created_at: new Date().toISOString(),
  };
}

async function main() {
  console.log("── scrape-hanime1 ── starting ──");

  const ids = await enumerateAllIds();
  console.log(`[enum] total unique IDs: ${ids.length}`);

  let totalUpserted = 0;
  let totalBanned = 0;
  let totalFail = 0;

  for (let i = 0; i < ids.length; i += WATCH_CONCURRENCY) {
    const batch = ids.slice(i, i + WATCH_CONCURRENCY);
    const t0 = Date.now();
    const parsed = await Promise.all(batch.map((id) => scrapeVideo(id)));

    const rows: ReturnType<typeof toRow>[] = [];
    const errs: string[] = [];
    for (const res of parsed) {
      const v = res.video;
      if (!v) {
        totalFail++;
        if (res.err) errs.push(res.err);
        continue;
      }
      if (isBanned(v)) {
        totalBanned++;
        continue;
      }
      rows.push(toRow(v));
    }
    if (errs.length > 0 && i < 15) {
      console.log(`  errs: ${errs.slice(0, 3).join(" | ")}`);
    }

    let upserted = 0;
    if (rows.length > 0) upserted = await upsertVideos(rows);
    totalUpserted += upserted;

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (i % 30 === 0 || upserted > 0) {
      console.log(
        `[${i + batch.length}/${ids.length}] +${upserted} (total ${totalUpserted}, banned ${totalBanned}, fail ${totalFail}) · ${elapsed}s`,
      );
    }
    await sleep(WATCH_DELAY_MS);
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
