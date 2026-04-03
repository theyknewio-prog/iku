/**
 * scrape-rule34video.ts
 *
 * Scrapes rule34video.com via their XML sitemaps.
 * 557 sitemap pages × 500 videos each = ~278K videos.
 *
 * Stores: title, pageUrl, thumbnail, duration, date.
 * Video stream URLs are NOT stored (they're tokenized/temporary).
 * yt-dlp resolves them on-demand via /api/resolve.
 *
 * Usage: npx tsx scripts/scrape-rule34video.ts
 */

import fs from "fs";
import path from "path";

const OUTPUT = path.resolve(process.cwd(), "src/data/rule34video-videos.json");
const DELAY = 800;
const USER_AGENT = "Mozilla/5.0 (compatible; IkuBot/1.0)";
const MAX_PAGES = 557;

interface R34VEntry {
  id: number;
  slug: string;
  title: string;
  pageUrl: string;
  thumbnail: string;
  duration: number;
  date: string;
}

function sanitizeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractId(url: string): number {
  const match = url.match(/\/video\/(\d+)\//);
  return match ? parseInt(match[1], 10) : 0;
}

function parseSitemapPage(xml: string): R34VEntry[] {
  const entries: R34VEntry[] = [];

  // Split by <url> blocks
  const urlBlocks = xml.split("<url>");

  for (let i = 1; i < urlBlocks.length; i++) {
    const block = urlBlocks[i];
    const endIdx = block.indexOf("</url>");
    const content = block.slice(0, endIdx > 0 ? endIdx : undefined);

    // Extract loc (page URL)
    const locMatch = content.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const pageUrl = locMatch[1].trim();

    // Only video pages
    if (!pageUrl.includes("/video/")) continue;

    const id = extractId(pageUrl);
    if (!id) continue;

    // Extract title from video:title
    let title = "";
    const titleMatch = content.match(/<video:title><!\[CDATA\[([^\]]*)\]\]><\/video:title>/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      const titleMatch2 = content.match(/<video:title>([^<]+)<\/video:title>/);
      if (titleMatch2) title = titleMatch2[1].trim();
    }
    // Fallback: extract from URL
    if (!title) {
      const urlSlug = pageUrl.match(/\/video\/\d+\/([^/]+)/);
      if (urlSlug) title = urlSlug[1].replace(/-/g, " ");
    }

    // Extract thumbnail
    let thumbnail = "";
    const thumbMatch = content.match(/<video:thumbnail_loc>([^<]+)<\/video:thumbnail_loc>/);
    if (thumbMatch) thumbnail = thumbMatch[1].trim();
    if (!thumbnail) {
      const imgMatch = content.match(/<image:loc>([^<]+)<\/image:loc>/);
      if (imgMatch) thumbnail = imgMatch[1].trim();
    }

    // Extract duration (seconds)
    let duration = 0;
    const durMatch = content.match(/<video:duration>(\d+)<\/video:duration>/);
    if (durMatch) duration = parseInt(durMatch[1], 10);

    // Extract date
    let date = "";
    const dateMatch = content.match(/<lastmod>([^<]+)<\/lastmod>/);
    if (dateMatch) date = dateMatch[1].trim();

    const slug = `r34v-${id}-${sanitizeSlug(title)}`;

    entries.push({ id, slug, title, pageUrl, thumbnail, duration, date });
  }

  return entries;
}

async function fetchSitemapPage(pageNum: number, retries = 2): Promise<string | null> {
  const url = `https://rule34video.com/sitemap/?type=videos&from_links_videos=${pageNum}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (res.status === 429) {
        console.warn(`  429 on page ${pageNum}, waiting 10s...`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }

      if (!res.ok) {
        console.error(`  HTTP ${res.status} on page ${pageNum}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        return null;
      }

      return await res.text();
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Rule34Video.com Sitemap Scraper");
  console.log(`  ${MAX_PAGES} sitemap pages × 500 videos`);
  console.log("═══════════════════════════════════════════");

  const allEntries: R34VEntry[] = [];
  const seen = new Set<number>();
  let emptyStreak = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const xml = await fetchSitemapPage(page);

    if (!xml) {
      emptyStreak++;
      if (emptyStreak >= 5) {
        console.log(`\n  5 consecutive failures at page ${page}, stopping`);
        break;
      }
      continue;
    }

    const entries = parseSitemapPage(xml);
    emptyStreak = 0;

    if (entries.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 5) break;
      continue;
    }

    let added = 0;
    for (const entry of entries) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        allEntries.push(entry);
        added++;
      }
    }

    process.stdout.write(
      `  Page ${page}/${MAX_PAGES}: +${added} (total: ${allEntries.length})    \r`
    );

    await new Promise((r) => setTimeout(r, DELAY));
  }

  console.log(`\n\n═══════════════════════════════════════════`);
  console.log(`  Total unique videos: ${allEntries.length}`);
  console.log(`═══════════════════════════════════════════`);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(allEntries, null, 0));

  const sizeMB = (fs.statSync(OUTPUT).size / 1_000_000).toFixed(2);
  console.log(`  Written to ${OUTPUT} (${sizeMB} MB)`);
}

main().catch(console.error);
