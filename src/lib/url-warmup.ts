/**
 * url-warmup.ts — Background warmup of the resolved_urls PG cache.
 *
 * Runs inside the Next.js server process, NOT via an external cron.
 * Rationale: Rule34Video access tokens may be IP-bound, so URLs must be
 * resolved from the same IP that end users connect to (our Hetzner server).
 *
 * Schedule:
 *   - Initial warmup 30s after server start (let the app settle first)
 *   - Then every 30 minutes
 *
 * Budget:
 *   - 500 top Rule34Video videos per run
 *   - 6 concurrent fetches, 200ms throttle between batches
 *   - Entire run completes in ~2-3 minutes
 *
 * Safety:
 *   - Singleton: only one warmup loop per process (via module state)
 *   - Only runs in production (skip in dev to avoid noise)
 *   - Silent failure — warmup is best-effort, never blocks the app
 */

import pool from "@/lib/db";

const WARMUP_LIMIT = 500;
const CONCURRENCY = 6;
const BATCH_DELAY_MS = 200;
const INITIAL_DELAY_MS = 30 * 1000; // 30 seconds after startup
const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let warmupStarted = false;
let warmupRunning = false;

interface WarmupRow {
  page_url: string;
}

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
      /video_alt_url3:\s*'([^']+)'/,
      /video_alt_url2:\s*'([^']+)'/,
      /video_alt_url:\s*'([^']+)'/,
      /video_url:\s*'([^']+)'/,
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWarmup(): Promise<void> {
  if (warmupRunning) return;
  warmupRunning = true;
  const start = Date.now();
  let ok = 0;
  let fail = 0;

  try {
    // Top Rule34Video videos that don't already have a fresh cache entry
    const { rows } = await pool.query<WarmupRow>(
      `SELECT v.page_url
       FROM videos v
       LEFT JOIN resolved_urls r
         ON r.page_url = v.page_url AND r.expires_at > NOW() + INTERVAL '15 minutes'
       WHERE v.source = 'rule34video'
         AND v.page_url IS NOT NULL AND v.page_url != ''
         AND r.page_url IS NULL
       ORDER BY v.score DESC
       LIMIT $1`,
      [WARMUP_LIMIT],
    );

    if (rows.length === 0) {
      console.log("[warmup] cache already fresh, skipping");
      return;
    }

    console.log(`[warmup] resolving ${rows.length} rule34video URLs`);

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (row) => {
          const videoUrl = await resolveRule34Video(row.page_url);
          if (videoUrl) {
            try {
              await pool.query(
                `INSERT INTO resolved_urls (page_url, video_url, expires_at)
                 VALUES ($1, $2, NOW() + INTERVAL '1 hour')
                 ON CONFLICT (page_url) DO UPDATE
                 SET video_url = EXCLUDED.video_url,
                     expires_at = EXCLUDED.expires_at,
                     created_at = NOW()`,
                [row.page_url, videoUrl],
              );
              ok++;
            } catch {
              fail++;
            }
          } else {
            fail++;
          }
        }),
      );
      await sleep(BATCH_DELAY_MS);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[warmup] done in ${elapsed}s — ok=${ok} fail=${fail}`);
  } catch (err) {
    console.error("[warmup] error:", err);
  } finally {
    warmupRunning = false;
  }
}

/**
 * Start the warmup loop. Safe to call multiple times — only starts once
 * per process. Called from /api/resolve-video route module on first import.
 */
export function startWarmup(): void {
  if (warmupStarted) return;
  if (process.env.NODE_ENV !== "production") return;
  warmupStarted = true;

  setTimeout(() => {
    runWarmup();
    setInterval(runWarmup, INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
