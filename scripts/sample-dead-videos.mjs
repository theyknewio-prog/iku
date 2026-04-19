#!/usr/bin/env node
/**
 * sample-dead-videos.mjs
 *
 * Quick sampling: HEAD the top 500 MP4s per source to estimate dead %.
 * Skips rule34video (already scanned by v2) and wp (url is empty, needs
 * the resolver — too slow for a first-pass sample).
 *
 * Read-only: does not mark anything dead. Reports a verdict per source
 * so we can decide whether to launch a full scan.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/sample-dead-videos.mjs
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const SAMPLE_SIZE = 500;
const CONCURRENCY = 20;
const THROTTLE_MS = 50;
const SOURCES = [
  "danbooru",
  "gelbooru",
  "rule34",
  "sfmcompile",
  "hentaicity",
  "hentaigasm",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function headOnce(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8_000);
  try {
    // hentaigasm URLs have spaces — encode path segments
    const encoded = url.replace(/ /g, "%20").replace(/'/g, "%27");
    const res = await fetch(encoded, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      signal: controller.signal,
      redirect: "follow",
    });
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { status: 0, ok: false, err: err.code || err.name };
  } finally {
    clearTimeout(t);
  }
}

async function sampleSource(source) {
  const { rows } = await pool.query(
    `SELECT slug, url FROM videos
      WHERE source = $1 AND dead_at IS NULL AND url IS NOT NULL AND url <> ''
      ORDER BY score DESC NULLS LAST
      LIMIT $2`,
    [source, SAMPLE_SIZE],
  );

  if (rows.length === 0) {
    console.log(`[${source}] no rows with url`);
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
      const r = await headOnce(row.url);
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
      ? "SEVERE DMCA/purge"
      : dead4xx / total > 0.2
        ? "notable rot"
        : dead4xx / total > 0.05
          ? "minor rot"
          : "healthy";
  console.log(
    `[${source}] n=${total}  alive=${alive}(${aliveP}%)  dead4xx=${dead4xx}(${deadPct}%)  neterr=${neterr}(${errP}%)  status=${JSON.stringify(statusHist)}  → ${verdict}`,
  );
}

async function main() {
  console.log(
    `── sampling dead videos · top ${SAMPLE_SIZE}/source · ${CONCURRENCY} workers ──`,
  );
  for (const src of SOURCES) {
    await sampleSource(src);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
