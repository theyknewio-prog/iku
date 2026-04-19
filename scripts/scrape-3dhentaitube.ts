#!/usr/bin/env npx tsx
/**
 * scrape-3dhentaitube.ts
 *
 * 3D CGI hentai source (~477 videos). Self-hosted MP4 on
 * wp-content/uploads/tubeace-videos/{id}/{id}.mp4 — stable CDN URL,
 * no IP token, plays directly from user browser (verified from FR + DE IPs).
 *
 * Strategy: walk /wp-json/wp/v2/posts, fetch each post HTML, extract the
 * direct <source src="...mp4"> inside the entry-content.
 *
 * Slug format: `3dt-{wpPostId}-{postSlug}`
 */

import { upsertVideos, pool } from "./db";
import { BANNED_TAGS, hasBannedTitle } from "./banned-tags";

const BASE = "https://www.3dhentai.tube";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PER_PAGE = 100;
const CONCURRENCY = 4;
const DELAY_MS = 300;

interface WpPost {
  id: number;
  slug: string;
  link: string;
  date: string;
  title: { rendered: string };
}

interface Parsed {
  mp4Url: string;
  thumbnail: string;
  tags: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractDetail(html: string): Parsed | null {
  let mp4Url: string | null = null;

  // Pattern: <video ... src="https://...mp4"> OR <source src="...mp4">
  const videoSrcMatch = html.match(
    /<(?:video|source)[^>]*\bsrc=["'](https?:\/\/[^"']+\.(?:mp4|webm))(?:\?[^"']*)?["']/i,
  );
  if (videoSrcMatch) mp4Url = videoSrcMatch[1];

  // Fallback: direct wp-content/uploads/tubeace-videos/{id}/{id}.mp4 reference
  if (!mp4Url) {
    const m = html.match(
      /https?:\/\/[^"' <>]+\/wp-content\/uploads\/tubeace-videos\/\d+\/\d+\.mp4/i,
    );
    if (m) mp4Url = m[0];
  }

  if (!mp4Url) return null;

  // og:image for thumbnail
  let thumbnail = "";
  const ogMatch = html.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
  );
  if (ogMatch) thumbnail = ogMatch[1];
  if (!thumbnail) {
    thumbnail = mp4Url.replace(/\.(mp4|webm)$/i, ".jpg");
  }

  // Tags from the post body (links to /tag/<slug>/)
  const tags: string[] = [];
  const tagRe =
    /\/tag\/([a-z0-9][a-z0-9-]*)\/?["'][^>]*(?:rel=["']tag["']|class=["'][^"']*tag)/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(html))) {
    const tag = tm[1];
    if (!tags.includes(tag)) tags.push(tag);
  }

  // Also grab from any /tag/XXX/ link, as pattern above can miss newer themes
  if (tags.length === 0) {
    const looseRe = /href=["'][^"']*\/tag\/([a-z0-9][a-z0-9-]*)\/?["']/gi;
    while ((tm = looseRe.exec(html))) {
      const tag = tm[1];
      if (!tags.includes(tag)) tags.push(tag);
    }
  }

  return { mp4Url, thumbnail, tags };
}

async function scrapePost(post: WpPost) {
  try {
    const html = await fetchHtml(post.link);
    const detail = extractDetail(html);
    if (!detail) return null;

    const title = post.title.rendered
      .replace(/&amp;/g, "&")
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8211;/g, "-")
      .replace(/&#038;/g, "&")
      .trim();

    if (hasBannedTitle(title) || hasBannedTitle(post.slug)) return null;
    for (const tag of detail.tags) {
      if (BANNED_TAGS.has(tag.toLowerCase())) return null;
    }

    // Ensure 3d tag so it shows up in /3d route
    if (!detail.tags.includes("3d")) detail.tags.unshift("3d");

    return {
      source: "3dhentaitube",
      source_id: post.id,
      slug: `3dt-${post.id}-${post.slug}`.slice(0, 200),
      url: detail.mp4Url,
      page_url: post.link,
      site: "3dhentaitube",
      title,
      thumbnail: detail.thumbnail,
      preview: detail.thumbnail,
      score: 0,
      favorites: 0,
      tags: detail.tags,
      characters: [] as string[],
      copyrights: [] as string[],
      artists: [] as string[],
      width: 1280,
      height: 720,
      file_size: 0,
      duration: null,
      created_at: post.date,
    };
  } catch (err) {
    console.warn(`[detail] ${post.slug} — ${(err as Error).message}`);
    return null;
  }
}

async function processBatch(posts: WpPost[]) {
  const rows = [];
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    const batch = posts.slice(i, i + CONCURRENCY);
    const parsed = await Promise.all(batch.map((p) => scrapePost(p)));
    for (const r of parsed) if (r) rows.push(r);
    await sleep(DELAY_MS);
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const pagesArg = args.indexOf("--pages");
  const startArg = args.indexOf("--start");
  const totalPages = pagesArg >= 0 ? parseInt(args[pagesArg + 1], 10) : 20;
  const startPage = startArg >= 0 ? parseInt(args[startArg + 1], 10) : 1;

  console.log(
    `── scrape-3dhentaitube ── page ${startPage}..${startPage + totalPages - 1} ──`,
  );

  let totalUpserted = 0;

  for (let page = startPage; page < startPage + totalPages; page++) {
    let posts: WpPost[] = [];
    try {
      posts = await fetchJson<WpPost[]>(
        `${BASE}/wp-json/wp/v2/posts?per_page=${PER_PAGE}&page=${page}&_fields=id,slug,link,date,title`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("400") || msg.includes("404")) {
        console.log(`[page ${page}] no more posts, stopping`);
        break;
      }
      console.warn(`[page ${page}] ${msg} — skipping`);
      continue;
    }
    if (posts.length === 0) {
      console.log(`[page ${page}] empty, stopping`);
      break;
    }

    const rows = await processBatch(posts);
    if (rows.length === 0) {
      console.log(`[page ${page}] 0 usable`);
      continue;
    }

    const inserted = await upsertVideos(rows);
    totalUpserted += inserted;
    console.log(
      `[page ${page}] ${rows.length} parsed, ${inserted} upserted (total ${totalUpserted})`,
    );
  }

  await pool.end();
  console.log(`── done: ${totalUpserted} upserted ──`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
