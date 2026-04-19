#!/usr/bin/env node
/**
 * sample-dead-wp.mjs
 *
 * HEAD the PAGE URL for top 500 WP videos per prefix to estimate dead %.
 * For WP-backed sources, a 404 on the page means the post was taken down
 * and the video won't play either — strong proxy for dead/alive verdict.
 *
 * Prefixes scanned: hmm-, aid-, wh-, htv-, hw-, hg-
 * (All live in source='wp' per scripts/scrape-wp-sites.ts.)
 *
 * Usage:
 *   DATABASE_URL=... node scripts/sample-dead-wp.mjs
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const SAMPLE_SIZE = 500;
const CONCURRENCY = 15;
const THROTTLE_MS = 80;
const PREFIXES = ["hmm", "aid", "wh", "htv", "hw", "hg"];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function headOnce(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10_000);
  try {
    // Some WP hosts reject HEAD — fall back to GET with a tiny range
    let res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      signal: controller.signal,
      redirect: "follow",
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": UA, Range: "bytes=0-0" },
        signal: controller.signal,
        redirect: "follow",
      });
    }
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { status: 0, ok: false, err: err.code || err.name };
  } finally {
    clearTimeout(t);
  }
}

async function samplePrefix(prefix) {
  const { rows } = await pool.query(
    `SELECT slug, page_url FROM videos
      WHERE source = 'wp'
        AND dead_at IS NULL
        AND slug LIKE $1
        AND page_url IS NOT NULL AND page_url <> ''
      ORDER BY score DESC NULLS LAST
      LIMIT $2`,
    [`${prefix}-%`, SAMPLE_SIZE],
  );

  if (rows.length === 0) {
    console.log(`[${prefix}] no rows with page_url`);
    return;
  }

  let alive = 0;
  let dead4xx = 0;
  let neterr = 0;
  const statusHist = {};

  const queue = [...rows];
  async function worker() {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) break;
      const r = await headOnce(row.page_url);
      statusHist[r.status] = (statusHist[r.status] ?? 0) + 1;
      if (r.status >= 400 && r.status < 500) dead4xx++;
      else if (r.status === 0 || r.status >= 500) neterr++;
      else alive++;
      await sleep(THROTTLE_MS);
    }
  }
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const total = rows.length;
  const deadPct = ((dead4xx / total) * 100).toFixed(1);
  const aliveP = ((alive / total) * 100).toFixed(1);
  const errP = ((neterr / total) * 100).toFixed(1);
  const verdict =
    dead4xx / total > 0.5
      ? "SEVERE rot"
      : dead4xx / total > 0.2
        ? "notable rot"
        : dead4xx / total > 0.05
          ? "minor rot"
          : "healthy";
  console.log(
    `[${prefix}-*] n=${total}  alive=${alive}(${aliveP}%)  dead4xx=${dead4xx}(${deadPct}%)  neterr=${neterr}(${errP}%)  status=${JSON.stringify(statusHist)}  → ${verdict}`,
  );
}

async function main() {
  console.log(
    `── sampling WP dead videos · top ${SAMPLE_SIZE}/prefix · ${CONCURRENCY} workers ──`,
  );
  for (const p of PREFIXES) {
    await samplePrefix(p);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
