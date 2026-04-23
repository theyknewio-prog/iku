/**
 * scrape-gelbooru.ts
 *
 * Fetches ALL animated MP4+WebM explicit posts from Gelbooru
 * and upserts them directly into PostgreSQL via scripts/db.ts.
 *
 * Usage: npx tsx scripts/scrape-gelbooru.ts
 *
 * Gelbooru: 1 req/sec rate limit, 100 results max per page, 0-based pid
 */

import { hasBannedTagString } from "./banned-tags";
import { pool, upsertVideos } from "./db";

const BASE_URL = "https://gelbooru.com/index.php";
const API_KEY = process.env.GELBOORU_API_KEY ?? "";
const USER_ID = process.env.GELBOORU_USER_ID ?? "";

if (!API_KEY || !USER_ID) {
  console.error(
    "GELBOORU_API_KEY + GELBOORU_USER_ID must be set in env (GH Actions secrets or .env.local).",
  );
  process.exit(1);
}
const DELAY = 1100; // 1.1s between requests
const LIMIT = 100;

interface GelbooruPost {
  id: number;
  file_url: string;
  preview_url: string;
  sample_url: string;
  tags: string;
  score: number;
  width: number;
  height: number;
  created_at: string;
  file_size?: number;
}

interface VideoEntry {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  score: number;
  tags: string[];
  width: number;
  height: number;
  fileSize: number;
  createdAt: string;
}

function sanitize(raw: string): string {
  if (!raw || !raw.trim()) return "";
  return (
    raw
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/_/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") ?? ""
  );
}

function mapPost(post: GelbooruPost): VideoEntry | null {
  if (!post.file_url) return null;
  if (!post.file_url.endsWith(".mp4") && !post.file_url.endsWith(".webm"))
    return null;

  // Skip banned content
  if (post.tags && hasBannedTagString(post.tags)) return null;

  const firstTag = sanitize(post.tags);
  const slug = firstTag ? `gel-${post.id}-${firstTag}` : `gel-${post.id}`;

  return {
    id: post.id,
    slug,
    url: post.file_url,
    thumbnail: post.preview_url ?? "",
    score: post.score ?? 0,
    tags: post.tags ? post.tags.trim().split(/\s+/).slice(0, 15) : [],
    width: post.width ?? 0,
    height: post.height ?? 0,
    fileSize: post.file_size ?? 0,
    createdAt: post.created_at ?? "",
  };
}

async function fetchPage(pid: number, retries = 2): Promise<GelbooruPost[]> {
  const url = `${BASE_URL}?page=dapi&s=post&q=index&json=1&api_key=${API_KEY}&user_id=${USER_ID}&tags=animated+video+rating:explicit+sort:id:desc&limit=${LIMIT}&pid=${pid}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "IkuScraper/1.0" },
      });

      if (res.status === 429) {
        console.warn(`  429 rate limited on pid ${pid}, waiting 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      if (!res.ok) {
        console.error(`  HTTP ${res.status} on pid ${pid}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        return [];
      }

      const json = await res.json();
      if (!json || !json.post) return [];

      const posts = Array.isArray(json.post) ? json.post : [json.post];
      return posts;
    } catch (err) {
      console.error(`  Network error on pid ${pid}:`, err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      return [];
    }
  }
  return [];
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Gelbooru Full Scraper for iku.gg");
  console.log("═══════════════════════════════════════════");

  const results: VideoEntry[] = [];
  let pid = 0;
  let emptyCount = 0;

  while (true) {
    const posts = await fetchPage(pid);

    if (posts.length === 0) {
      emptyCount++;
      if (emptyCount >= 3) break;
      pid++;
      await new Promise((r) => setTimeout(r, DELAY));
      continue;
    }

    emptyCount = 0;
    let added = 0;
    for (const post of posts) {
      const entry = mapPost(post);
      if (entry) {
        results.push(entry);
        added++;
      }
    }

    process.stdout.write(
      `  Page ${pid}: ${posts.length} posts, ${added} videos (total: ${results.length})\r`,
    );

    if (posts.length < LIMIT) break;
    pid++;
    await new Promise((r) => setTimeout(r, DELAY));
  }

  // Dedupe by ID
  const seen = new Set<number>();
  const unique = results.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  unique.sort((a, b) => b.score - a.score);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Total unique videos: ${unique.length}`);
  console.log(`  Top score: ${unique[0]?.score}`);
  console.log(`═══════════════════════════════════════════`);

  console.log(`\n  Upserting ${unique.length} videos to PostgreSQL...`);
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH).map((v) => ({
      source: "gelbooru",
      source_id: v.id,
      slug: v.slug,
      url: v.url,
      thumbnail: v.thumbnail,
      score: v.score,
      tags: v.tags,
      width: v.width,
      height: v.height,
      file_size: v.fileSize,
      created_at: v.createdAt,
    }));
    upserted += await upsertVideos(batch);
    process.stdout.write(
      `  ${Math.min(i + BATCH, unique.length)}/${unique.length} upserted\r`,
    );
  }
  console.log(`\n  ${upserted} videos upserted`);
  await pool.end();
}

main().catch(console.error);
