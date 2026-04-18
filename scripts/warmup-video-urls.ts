/**
 * warmup-video-urls.ts — Pre-resolve the URLs of the most popular videos
 * and warm the resolved_urls PG cache.
 *
 * Target: ~500 top Rule34Video videos (by score) + top WP videos.
 * Runs every 30 min via GitHub Actions OR every hour on the container.
 *
 * Strategy:
 *   1. Query PG for top videos by score from sources that need resolution
 *   2. For each, construct the page URL and directly fetch the HTML (r34v)
 *      or fall through to yt-dlp (WP)
 *   3. Upsert into resolved_urls with 1h expiry
 *
 * After the warmup run, a user clicking on any trending/top Rule34Video
 * gets a cached URL in ~50ms instead of the usual 380ms resolve.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/warmup-video-urls.ts
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// How many videos to warm up per run
const WARMUP_LIMIT = Number(process.env.WARMUP_LIMIT ?? 500);
// Concurrency (respect Rule34Video, don't hammer them)
const CONCURRENCY = 6;
// Throttle between requests
const DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse an MP4 URL out of a Rule34Video page HTML.
 * Mirrors the logic in src/app/api/resolve-video/route.ts.
 */
async function resolveRule34Video(pageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const patterns: RegExp[] = [
      /video_alt_url3:\s*'([^']+)'/, // 1080p
      /video_alt_url2:\s*'([^']+)'/, // 720p
      /video_alt_url:\s*'([^']+)'/, // 480p
      /video_url:\s*'([^']+)'/, // 360p
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].includes(".mp4")) return match[1];
    }
    return null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function upsert(pageUrl: string, videoUrl: string): Promise<void> {
  await pool.query(
    `INSERT INTO resolved_urls (page_url, video_url, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')
     ON CONFLICT (page_url) DO UPDATE
     SET video_url = EXCLUDED.video_url, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
    [pageUrl, videoUrl],
  );
}

interface Row {
  page_url: string | null;
  slug: string;
  source: string;
}

async function main() {
  console.log(`🔥 Warming up top ${WARMUP_LIMIT} rule34video URLs...`);

  const start = Date.now();

  // Fetch top rule34video by score that don't already have a fresh cache entry
  const { rows } = await pool.query<Row>(
    `SELECT v.page_url, v.slug, v.source
     FROM videos v
     LEFT JOIN resolved_urls r
       ON r.page_url = v.page_url AND r.expires_at > NOW()
     WHERE v.source = 'rule34video'
       AND v.page_url IS NOT NULL AND v.page_url != ''
       AND r.page_url IS NULL
     ORDER BY v.score DESC
     LIMIT $1`,
    [WARMUP_LIMIT],
  );

  console.log(`→ ${rows.length} videos to warm (others already cached)`);

  let ok = 0;
  let fail = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        if (!row.page_url) return;
        const videoUrl = await resolveRule34Video(row.page_url);
        if (videoUrl) {
          await upsert(row.page_url, videoUrl);
          ok++;
        } else {
          fail++;
        }
      }),
    );
    // Pacing — avoid slamming Rule34Video
    await sleep(DELAY_MS);
    if ((i + CONCURRENCY) % 60 === 0) {
      console.log(
        `  progress: ${i + CONCURRENCY}/${rows.length} (ok=${ok} fail=${fail})`,
      );
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Warmup complete in ${elapsed}s — ok=${ok} fail=${fail}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Warmup failed:", err);
  process.exit(1);
});
