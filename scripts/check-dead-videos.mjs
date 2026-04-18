#!/usr/bin/env node
/**
 * check-dead-videos.mjs
 *
 * Walks all Rule34Video URLs in the `videos` table, HEAD-checks each,
 * and sets dead_at=NOW() for any URL that returns 404.
 *
 * Rate limiting: 5 concurrent workers, 200ms throttle each = 25 req/sec.
 * 277K URLs / 25 = ~3h total. Gentle enough to not get IP-banned by
 * DDoS-Guard.
 *
 * Idempotent: already-dead rows are skipped via WHERE dead_at IS NULL.
 * Safe to rerun.
 *
 * Usage: node scripts/check-dead-videos.mjs [--source=rule34video]
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const SOURCE =
  process.argv.find((a) => a.startsWith("--source="))?.split("=")[1] ??
  "rule34video";
const CONCURRENCY = 5;
const THROTTLE_MS = 200;
const BATCH_SIZE = 500;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });

let processed = 0;
let dead = 0;
let alive = 0;
let errors = 0;
const startedAt = Date.now();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkUrl(pageUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(pageUrl, {
      method: "HEAD",
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    return res.status;
  } catch {
    clearTimeout(timeoutId);
    return 0; // network error — treat as inconclusive
  }
}

async function markDead(slug) {
  await pool.query(
    "UPDATE videos SET dead_at = NOW() WHERE slug = $1 AND dead_at IS NULL",
    [slug],
  );
}

async function worker(queue) {
  while (queue.length > 0) {
    const row = queue.shift();
    if (!row) break;
    const status = await checkUrl(row.page_url);
    processed++;
    if (status === 404 || status === 410) {
      await markDead(row.slug);
      dead++;
    } else if (status >= 200 && status < 400) {
      alive++;
    } else {
      errors++;
    }
    if (processed % 500 === 0) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const rate = processed / elapsed;
      const remaining = Math.round(
        (queue.length + (WORKERS * queue.length) / CONCURRENCY) / rate,
      );
      console.log(
        `[${elapsed}s] processed=${processed} dead=${dead} alive=${alive} err=${errors} rate=${rate.toFixed(1)}/s eta=${remaining}s`,
      );
    }
    await sleep(THROTTLE_MS);
  }
}

let WORKERS = CONCURRENCY;

async function main() {
  console.log(`[check-dead] scanning source=${SOURCE}`);

  const { rows: total } = await pool.query(
    "SELECT COUNT(*)::int AS c FROM videos WHERE source = $1 AND dead_at IS NULL AND page_url IS NOT NULL",
    [SOURCE],
  );
  console.log(`[check-dead] ${total[0].c} rows to check`);

  let offset = 0;
  while (true) {
    const { rows } = await pool.query(
      `SELECT slug, page_url FROM videos
       WHERE source = $1 AND dead_at IS NULL AND page_url IS NOT NULL
       ORDER BY pk
       LIMIT $2 OFFSET $3`,
      [SOURCE, BATCH_SIZE, offset],
    );
    if (rows.length === 0) break;

    const queue = [...rows];
    await Promise.all(Array.from({ length: WORKERS }, () => worker(queue)));
    offset += BATCH_SIZE;
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[check-dead] DONE in ${elapsed}s. processed=${processed} dead=${dead} alive=${alive} err=${errors}`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
