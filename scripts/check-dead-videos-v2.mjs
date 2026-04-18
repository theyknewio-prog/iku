#!/usr/bin/env node
/**
 * check-dead-videos-v2.mjs
 *
 * Real playback test (vs v1 which only HEAD-checked the page URL).
 * For each rule34video row where dead_at IS NULL:
 *   1. GET the page HTML.
 *   2. Extract the MP4 URL via the same regex /api/resolve-video uses
 *      (video_url / video_alt_url / video_alt_url2 / video_alt_url3).
 *   3. HEAD the MP4 URL.
 *   4. Mark dead if: page non-200, no MP4 regex match, or MP4 HEAD 4xx.
 *
 * Why v1 missed most real dead videos: rule34video keeps 200-page stubs
 * for posts whose MP4 has been pulled from their CDN. The page loads
 * fine but the user gets a 403/404 on the .mp4 request.
 *
 * Tuned for 10 concurrent workers × 150ms throttle = ~66 req/sec.
 * Full scan of 280K URLs ≈ 70 min. Resumable (dead_at filter).
 *
 * Usage:
 *   DATABASE_URL=... node scripts/check-dead-videos-v2.mjs
 *   DATABASE_URL=... node scripts/check-dead-videos-v2.mjs --limit=10000
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const LIMIT =
  parseInt(
    process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0",
    10,
  ) || null;
const CONCURRENCY = 10;
const THROTTLE_MS = 150;
const BATCH_SIZE = 2000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MP4_PATTERNS = [
  /video_alt_url3:\s*'([^']+)'/,
  /video_alt_url2:\s*'([^']+)'/,
  /video_alt_url:\s*'([^']+)'/,
  /video_url:\s*'([^']+)'/,
];

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 15 });

let processed = 0;
let dead = 0;
let alive = 0;
let errors = 0;
const reasonCounts = { page: 0, noMp4: 0, mp4: 0 };
const startedAt = Date.now();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function testVideo(pageUrl) {
  // 1. Page GET
  let html;
  try {
    const res = await fetchWithTimeout(
      pageUrl,
      { headers: { "User-Agent": UA, Accept: "text/html" } },
      10_000,
    );
    if (!res.ok) return { dead: true, reason: "page", status: res.status };
    html = await res.text();
  } catch {
    return { dead: false, reason: "net" }; // inconclusive, don't mark
  }

  // 2. Extract MP4
  let mp4 = null;
  for (const re of MP4_PATTERNS) {
    const m = html.match(re);
    if (m && m[1] && m[1].includes(".mp4")) {
      mp4 = m[1];
      break;
    }
  }
  if (!mp4) return { dead: true, reason: "noMp4" };

  // 3. HEAD the MP4
  try {
    const res = await fetchWithTimeout(
      mp4,
      { method: "HEAD", headers: { "User-Agent": UA } },
      10_000,
    );
    if (res.status >= 400 && res.status < 500) {
      return { dead: true, reason: "mp4", status: res.status };
    }
    return { dead: false };
  } catch {
    return { dead: false, reason: "net" };
  }
}

async function retryQuery(fn, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const code = err?.code ?? "";
      // 57P01 = admin shutdown, 08006 = conn failure, 08003 = conn does not exist
      const retriable =
        code === "57P01" ||
        code === "08006" ||
        code === "08003" ||
        err?.message?.includes("Connection terminated");
      if (!retriable || i === attempts - 1) throw err;
      const backoff = 500 * Math.pow(2, i);
      console.warn(`[retry ${i + 1}] PG ${code} — waiting ${backoff}ms`);
      await sleep(backoff);
    }
  }
}

async function markDead(slug, reason) {
  await retryQuery(() =>
    pool.query(
      "UPDATE videos SET dead_at = NOW(), dead_reason = $2, last_checked_at = NOW() WHERE slug = $1 AND dead_at IS NULL",
      [slug, reason],
    ),
  );
}

async function markChecked(slug) {
  await retryQuery(() =>
    pool.query("UPDATE videos SET last_checked_at = NOW() WHERE slug = $1", [
      slug,
    ]),
  );
}

async function worker(queue) {
  while (queue.length > 0) {
    const row = queue.shift();
    if (!row) break;
    const result = await testVideo(row.page_url);
    processed++;
    if (result.dead) {
      await markDead(row.slug, result.reason);
      dead++;
      reasonCounts[result.reason] = (reasonCounts[result.reason] ?? 0) + 1;
    } else if (result.reason === "net") {
      errors++;
      // leave last_checked_at untouched so net errors get retried next run
    } else {
      alive++;
      await markChecked(row.slug);
    }
    await sleep(THROTTLE_MS);
  }
}

async function main() {
  // Ensure tracking columns exist (safe to re-run)
  await pool.query(
    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS dead_reason TEXT",
  );
  await pool.query(
    "ALTER TABLE videos ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ",
  );

  console.log(
    `── check-dead-videos v2 (real MP4 test) · ${CONCURRENCY} workers · ${THROTTLE_MS}ms throttle ──`,
  );

  while (true) {
    const limitClause = LIMIT
      ? ` LIMIT ${Math.min(BATCH_SIZE, LIMIT - processed)}`
      : ` LIMIT ${BATCH_SIZE}`;
    // No OFFSET — every batch grabs the top alive+unchecked rows. Marking
    // rows dead or setting last_checked_at removes them from the pool,
    // so the query naturally converges to empty.
    const result = await retryQuery(() =>
      pool.query(
        `SELECT slug, page_url FROM videos
       WHERE source='rule34video' AND dead_at IS NULL AND page_url IS NOT NULL
         AND last_checked_at IS NULL
       ORDER BY score DESC
       ${limitClause}`,
      ),
    );
    const { rows } = result;
    if (rows.length === 0) break;

    const queue = [...rows];
    const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
    await Promise.all(workers);

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const rate = (processed / elapsed).toFixed(1);
    console.log(
      `[${elapsed}s] processed=${processed} dead=${dead} alive=${alive} err=${errors} rate=${rate}/s reasons=${JSON.stringify(reasonCounts)}`,
    );

    if (LIMIT && processed >= LIMIT) break;
  }

  console.log(`── done: dead=${dead} alive=${alive} err=${errors} ──`);
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
