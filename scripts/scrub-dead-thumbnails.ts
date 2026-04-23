/**
 * Nightly thumbnail scrubber.
 *
 * HEAD-checks thumbnail URLs on videos where `thumbnail_checked_at` is null
 * or stale (>30 days). Flags `dead_thumbnail_at = NOW()` on 404/403/timeout
 * so listings (requireThumbnail=true) skip them. Healthy rows just get
 * `thumbnail_checked_at = NOW()` to avoid re-checking too soon.
 *
 * Runs hourly via /etc/cron.d/iku-scrub-thumbs on Hetzner — processes
 * BATCH_SIZE per invocation, drains the 469K backlog over a few weeks.
 *
 * Run manually: `npx tsx scripts/scrub-dead-thumbnails.ts`
 */

import { pool } from "./db";

const BATCH_SIZE = Number(process.env.SCRUB_BATCH_SIZE ?? 500);
const CONCURRENCY = Number(process.env.SCRUB_CONCURRENCY ?? 20);
const TIMEOUT_MS = Number(process.env.SCRUB_TIMEOUT_MS ?? 8_000);
const RECHECK_DAYS = Number(process.env.SCRUB_RECHECK_DAYS ?? 30);

type Row = { pk: number; thumbnail: string };
type Outcome = "alive" | "dead";

async function probe(url: string): Promise<Outcome> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // HEAD first (cheap). Some CDNs 405 on HEAD — fall back to tiny Range GET.
    let res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: { Range: "bytes=0-0" },
      });
    }
    if (res.status === 404 || res.status === 403 || res.status === 410) {
      return "dead";
    }
    // Treat 5xx as transient — mark alive so we recheck later.
    return "alive";
  } catch {
    // Network error, DNS fail, abort — likely dead (hotlink gate, gone domain).
    return "dead";
  } finally {
    clearTimeout(t);
  }
}

async function processBatch(rows: Row[]): Promise<{
  alive: number[];
  dead: number[];
}> {
  const alive: number[] = [];
  const dead: number[] = [];

  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const idx = cursor++;
      const row = rows[idx];
      const outcome = await probe(row.thumbnail);
      if (outcome === "alive") alive.push(row.pk);
      else dead.push(row.pk);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, rows.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return { alive, dead };
}

async function main() {
  console.log(
    `[scrub-thumbs] batch=${BATCH_SIZE} concurrency=${CONCURRENCY} timeout=${TIMEOUT_MS}ms recheck=${RECHECK_DAYS}d`,
  );

  const t0 = Date.now();
  const { rows } = await pool.query<Row>(
    `SELECT pk, thumbnail
       FROM videos
      WHERE thumbnail IS NOT NULL
        AND thumbnail <> ''
        AND dead_thumbnail_at IS NULL
        AND (thumbnail_checked_at IS NULL
             OR thumbnail_checked_at < NOW() - INTERVAL '${RECHECK_DAYS} days')
      ORDER BY thumbnail_checked_at NULLS FIRST
      LIMIT $1`,
    [BATCH_SIZE],
  );

  if (rows.length === 0) {
    console.log("[scrub-thumbs] nothing to check — backlog drained.");
    await pool.end();
    return;
  }

  console.log(`[scrub-thumbs] selected ${rows.length} rows`);

  const { alive, dead } = await processBatch(rows);
  const elapsed = Date.now() - t0;

  if (alive.length > 0) {
    await pool.query(
      `UPDATE videos SET thumbnail_checked_at = NOW() WHERE pk = ANY($1::int[])`,
      [alive],
    );
  }
  if (dead.length > 0) {
    await pool.query(
      `UPDATE videos
          SET dead_thumbnail_at = NOW(),
              thumbnail_checked_at = NOW()
        WHERE pk = ANY($1::int[])`,
      [dead],
    );
  }

  const remaining = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM videos
      WHERE thumbnail IS NOT NULL
        AND thumbnail <> ''
        AND dead_thumbnail_at IS NULL
        AND (thumbnail_checked_at IS NULL
             OR thumbnail_checked_at < NOW() - INTERVAL '${RECHECK_DAYS} days')`,
  );

  console.log(
    `[scrub-thumbs] alive=${alive.length} dead=${dead.length} elapsed=${elapsed}ms remaining=${remaining.rows[0].count}`,
  );

  await pool.end();
}

main().catch((err) => {
  console.error("[scrub-thumbs] fatal:", err);
  process.exit(1);
});
