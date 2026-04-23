/**
 * scrape-rule34.ts
 *
 * Fetches animated video posts from Rule34.xxx
 * and upserts them directly into PostgreSQL via scripts/db.ts.
 *
 * Usage: npx tsx scripts/scrape-rule34.ts
 *
 * Rule34 API: 100 results per page, 0-based pid, needs api_key + user_id
 * Limit: ~20K results per search (like Gelbooru). We split by score ranges to get more.
 */

import { hasBannedTagString } from "./banned-tags";
import { pool, upsertVideos } from "./db";

const API_KEY = process.env.RULE34_API_KEY ?? "";
const USER_ID = process.env.RULE34_USER_ID ?? "";

if (!API_KEY || !USER_ID) {
  console.error(
    "RULE34_API_KEY + RULE34_USER_ID must be set in env (GH Actions secrets or .env.local).",
  );
  process.exit(1);
}
const BASE_URL = "https://api.rule34.xxx/index.php";
const DELAY = 500; // 500ms between requests
const LIMIT = 100;

interface R34Post {
  id: number;
  file_url: string;
  preview_url: string;
  sample_url: string;
  tags: string;
  score: number;
  width: number;
  height: number;
  created_at: string;
  owner: string;
}

interface VideoEntry {
  id: number;
  slug: string;
  url: string;
  thumbnail: string;
  preview: string;
  score: number;
  tags: string[];
  width: number;
  height: number;
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

function mapPost(post: R34Post): VideoEntry | null {
  if (!post.file_url) return null;
  if (!post.file_url.endsWith(".mp4") && !post.file_url.endsWith(".webm"))
    return null;

  // Skip banned content
  if (post.tags && hasBannedTagString(post.tags)) return null;

  const firstTag = sanitize(post.tags);
  const slug = firstTag ? `r34-${post.id}-${firstTag}` : `r34-${post.id}`;

  return {
    id: post.id,
    slug,
    url: post.file_url,
    thumbnail: post.preview_url ?? "",
    preview: post.sample_url || post.preview_url || "",
    score: post.score ?? 0,
    tags: post.tags ? post.tags.trim().split(/\s+/).slice(0, 15) : [],
    width: post.width ?? 0,
    height: post.height ?? 0,
    createdAt: post.created_at ?? "",
  };
}

async function fetchPage(
  tags: string,
  pid: number,
  retries = 2,
): Promise<R34Post[]> {
  const url = `${BASE_URL}?page=dapi&s=post&q=index&json=1&api_key=${API_KEY}&user_id=${USER_ID}&tags=${encodeURIComponent(tags)}&limit=${LIMIT}&pid=${pid}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "IkuScraper/1.0" },
      });

      if (res.status === 429) {
        console.warn(`  429 on pid ${pid}, waiting 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      if (!res.ok) {
        console.error(`  HTTP ${res.status} on pid ${pid}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return [];
      }

      const text = await res.text();
      if (!text || text.startsWith("<?xml") || text.startsWith("<")) return [];

      const json = JSON.parse(text);
      if (!json || !Array.isArray(json)) return [];
      return json;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return [];
    }
  }
  return [];
}

async function scrapeQuery(tags: string, label: string): Promise<VideoEntry[]> {
  const results: VideoEntry[] = [];
  let pid = 0;
  let emptyCount = 0;

  console.log(`\n  Scraping: ${label}`);

  while (true) {
    const posts = await fetchPage(tags, pid);

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
      `    pid ${pid}: ${posts.length} posts, ${added} videos (total: ${results.length})\r`,
    );

    if (posts.length < LIMIT) break;
    pid++;
    await new Promise((r) => setTimeout(r, DELAY));
  }

  console.log(`\n    Done: ${results.length} videos`);
  return results;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Rule34.xxx Full Scraper for iku.gg");
  console.log("  424K+ animated videos available");
  console.log("═══════════════════════════════════════════");

  // Rule34 limits to ~20K per search like Gelbooru.
  // Split by score ranges to get more coverage.
  const allResults: VideoEntry[] = [];

  const queries = [
    { tags: "animated video sort:score:desc", label: "Top scored" },
    { tags: "animated video sort:id:desc", label: "Newest" },
  ];

  for (const q of queries) {
    const results = await scrapeQuery(q.tags, q.label);
    allResults.push(...results);
  }

  // Dedupe by ID
  const seen = new Set<number>();
  const unique = allResults.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  unique.sort((a, b) => b.score - a.score);

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Total unique videos: ${unique.length}`);
  console.log(`  Top score: ${unique[0]?.score}`);
  console.log(`  Lowest score: ${unique[unique.length - 1]?.score}`);
  console.log(`═══════════════════════════════════════════`);

  console.log(`\n  Upserting ${unique.length} videos to PostgreSQL...`);
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH).map((v) => ({
      source: "rule34",
      source_id: v.id,
      slug: v.slug,
      url: v.url,
      thumbnail: v.thumbnail,
      preview: v.preview,
      score: v.score,
      tags: v.tags,
      width: v.width,
      height: v.height,
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
