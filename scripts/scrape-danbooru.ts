/**
 * scrape-danbooru.ts
 *
 * Fetches ALL animated MP4+WebM explicit posts from Danbooru
 * and writes them to src/data/videos.json as a local cache.
 *
 * Usage: npx tsx scripts/scrape-danbooru.ts
 *
 * Danbooru free tier: 2 tags per search, 200 results per page, 10 req/sec
 * We use: "animated filetype:mp4 rating:e order:id_desc" (order is free meta-tag)
 * Then a second pass for webm.
 */

import fs from "fs";
import path from "path";
import { hasBannedTagString } from "./banned-tags";

const BASE_URL = "https://danbooru.donmai.us";
const USER_AGENT = "IkuScraper/1.0 (bulk index)";
const LIMIT = 200; // max per page
const DELAY = 250; // 250ms between requests = 4/sec (safe)
const OUTPUT = path.resolve(__dirname, "../src/data/videos.json");

interface DanbooruPost {
  id: number;
  file_url: string | null;
  large_file_url: string | null;
  preview_file_url: string | null;
  tag_string_general: string;
  tag_string_character: string;
  tag_string_copyright: string;
  tag_string_artist: string;
  score: number;
  fav_count: number;
  image_width: number;
  image_height: number;
  file_size: number;
  media_asset?: { duration?: number };
  created_at: string;
}

interface VideoEntry {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  score: number;
  favorites: number;
  characters: string[];
  copyrights: string[];
  artists: string[];
  tags: string[];
  width: number;
  height: number;
  fileSize: number;
  duration: number | null;
  createdAt: string;
}

function sanitize(raw: string): string {
  if (!raw || !raw.trim()) return "";
  const firstTag = raw.trim().split(/\s+/)[0];
  return firstTag
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateSlug(id: number, character: string, copyright: string): string {
  const parts = [String(id)];
  const cleanChar = sanitize(character);
  if (cleanChar) parts.push(cleanChar);
  const cleanCopy = sanitize(copyright);
  if (cleanCopy) parts.push(cleanCopy);
  return parts.join("-");
}

function splitTags(tagString: string): string[] {
  if (!tagString || !tagString.trim()) return [];
  return tagString.trim().split(/\s+/);
}

function mapPost(post: DanbooruPost): VideoEntry | null {
  const url = post.file_url ?? post.large_file_url ?? "";
  if (!url) return null;

  // Skip banned content (loli, shota, underage, etc.)
  const allTags = [post.tag_string_general, post.tag_string_character, post.tag_string_copyright].join(" ");
  if (hasBannedTagString(allTags)) return null;

  const thumbnail = post.preview_file_url ?? "";
  return {
    id: post.id,
    slug: generateSlug(post.id, post.tag_string_character, post.tag_string_copyright),
    url,
    thumbnail,
    score: post.score,
    favorites: post.fav_count,
    characters: splitTags(post.tag_string_character),
    copyrights: splitTags(post.tag_string_copyright),
    artists: splitTags(post.tag_string_artist),
    tags: splitTags(post.tag_string_general).slice(0, 15),
    width: post.image_width,
    height: post.image_height,
    fileSize: post.file_size,
    duration: post.media_asset?.duration ?? null,
    createdAt: post.created_at,
  };
}

async function fetchPage(tags: string, page: number, retries = 2): Promise<DanbooruPost[]> {
  const url = `${BASE_URL}/posts.json?tags=${encodeURIComponent(tags)}&limit=${LIMIT}&page=${page}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

      if (res.status === 429) {
        console.warn(`  429 rate limited on page ${page}, waiting 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      if (!res.ok) {
        console.error(`  HTTP ${res.status} on page ${page}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return [];
      }

      return (await res.json()) as DanbooruPost[];
    } catch (err) {
      console.error(`  Network error on page ${page}:`, err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return [];
    }
  }
  return [];
}

async function scrapeAll(tags: string, label: string): Promise<VideoEntry[]> {
  const results: VideoEntry[] = [];
  let page = 1;
  let empty = 0;

  console.log(`\n🔍 Scraping: ${label} (${tags})`);

  while (true) {
    const posts = await fetchPage(tags, page);

    if (posts.length === 0) {
      empty++;
      if (empty >= 2) break; // 2 consecutive empty pages = done
      page++;
      await new Promise((r) => setTimeout(r, DELAY));
      continue;
    }

    empty = 0;
    let added = 0;
    for (const post of posts) {
      const entry = mapPost(post);
      if (entry) {
        results.push(entry);
        added++;
      }
    }

    process.stdout.write(`  Page ${page}: ${posts.length} posts, ${added} valid videos (total: ${results.length})\r`);

    if (posts.length < LIMIT) break; // last page

    page++;
    await new Promise((r) => setTimeout(r, DELAY));
  }

  console.log(`\n  ✅ ${label}: ${results.length} videos scraped`);
  return results;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Danbooru Full Scraper for iku.gg");
  console.log("═══════════════════════════════════════════");

  // Scrape MP4 first (bulk), then WebM
  const mp4 = await scrapeAll("animated filetype:mp4 rating:e order:id_desc", "MP4");
  const webm = await scrapeAll("animated filetype:webm rating:e order:id_desc", "WebM");

  // Merge and dedupe
  const seen = new Set<number>();
  const all: VideoEntry[] = [];
  for (const v of [...mp4, ...webm]) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      all.push(v);
    }
  }

  // Sort by score descending
  all.sort((a, b) => b.score - a.score);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Total unique videos: ${all.length}`);
  console.log(`  Top score: ${all[0]?.score}`);
  console.log(`  Lowest score: ${all[all.length - 1]?.score}`);
  console.log(`  Newest: ${all.reduce((a, b) => a.id > b.id ? a : b).createdAt?.slice(0, 10)}`);
  console.log(`═══════════════════════════════════════════`);

  // Write to file
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(all, null, 0));

  const sizeMB = (fs.statSync(OUTPUT).size / 1_000_000).toFixed(1);
  console.log(`\n💾 Written to ${OUTPUT} (${sizeMB} MB)`);
}

main().catch(console.error);
