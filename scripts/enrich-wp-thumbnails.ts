/**
 * enrich-wp-thumbnails.ts
 *
 * Fetches thumbnail URLs for WP hentai entries by scraping
 * their og:image meta tags from page URLs.
 *
 * Usage: npx tsx scripts/enrich-wp-thumbnails.ts
 */

import fs from "fs";
import path from "path";

const INPUT = path.resolve(process.cwd(), "src/data/wp-hentai-videos.json");
const OUTPUT = INPUT; // overwrite
const DELAY = 500;
const BATCH = 50; // process in batches
const USER_AGENT = "Mozilla/5.0 (compatible; IkuBot/1.0)";

interface WPEntry {
  id: number;
  slug: string;
  title: string;
  pageUrl: string;
  site: string;
  date: string;
  thumbnail?: string;
}

async function fetchThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try og:image first
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
    if (ogMatch) return ogMatch[1];

    // Try poster image
    const posterMatch = html.match(/poster="([^"]+)"/i);
    if (posterMatch) return posterMatch[1];

    // Try first large image
    const imgMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]+(?:poster|thumb|cover|featured)[^"]*)"/i);
    if (imgMatch) return imgMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function main() {
  const data: WPEntry[] = JSON.parse(fs.readFileSync(INPUT, "utf-8"));

  // Only process entries without thumbnails
  const needsThumbnail = data.filter((e) => !e.thumbnail);
  console.log(`Total: ${data.length}, need thumbnails: ${needsThumbnail.length}`);

  let processed = 0;
  let found = 0;

  for (let i = 0; i < needsThumbnail.length; i += BATCH) {
    const batch = needsThumbnail.slice(i, i + BATCH);

    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const thumb = await fetchThumbnail(entry.pageUrl);
        if (thumb) {
          entry.thumbnail = thumb;
          found++;
        }
        processed++;
      })
    );

    process.stdout.write(
      `  ${processed}/${needsThumbnail.length} processed, ${found} thumbnails found\r`
    );

    await new Promise((r) => setTimeout(r, DELAY));
  }

  console.log(`\n\nDone: ${found}/${needsThumbnail.length} thumbnails found`);

  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 0));
  console.log(`Written to ${OUTPUT}`);
}

main().catch(console.error);
