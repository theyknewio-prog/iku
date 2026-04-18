/**
 * enrich-wp-thumbnails.ts (PostgreSQL version)
 *
 * Fetches thumbnail URLs for WP entries that don't have one yet,
 * by scraping og:image from their page URLs.
 */

import { pool } from "./db";

const DELAY = 500;
const BATCH = 50;
const USER_AGENT = "Mozilla/5.0 (compatible; IkuBot/1.0)";

async function fetchThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    const ogMatch =
      html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i) ||
      html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
    if (ogMatch) return ogMatch[1];

    const posterMatch = html.match(/poster="([^"]+)"/i);
    if (posterMatch) return posterMatch[1];

    const imgMatch = html.match(
      /<img[^>]+src="(https?:\/\/[^"]+(?:poster|thumb|cover|featured)[^"]*)"/i,
    );
    if (imgMatch) return imgMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function main() {
  const { rows } = await pool.query(
    "SELECT pk, source_id, page_url FROM videos WHERE source = 'wp' AND (thumbnail = '' OR thumbnail IS NULL)",
  );

  console.log(`Need thumbnails: ${rows.length}`);

  let processed = 0;
  let found = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    await Promise.allSettled(
      batch.map(async (entry) => {
        const thumb = await fetchThumbnail(entry.page_url);
        if (thumb) {
          await pool.query("UPDATE videos SET thumbnail = $1 WHERE pk = $2", [
            thumb,
            entry.pk,
          ]);
          found++;
        }
        processed++;
      }),
    );

    process.stdout.write(
      `  ${processed}/${rows.length} processed, ${found} thumbnails found\r`,
    );
    await new Promise((r) => setTimeout(r, DELAY));
  }

  console.log(`\n\nDone: ${found}/${rows.length} thumbnails found and saved`);
  await pool.end();
}

main().catch(console.error);
