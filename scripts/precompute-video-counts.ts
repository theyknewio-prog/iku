/**
 * precompute-video-counts.ts
 *
 * Cron-computed cache for the expensive `COUNT(*) FROM videos WHERE NOT
 * (tags && $banned) AND ...` query. See audit-speed-2026-04-18/FINDINGS.md.
 *
 * The query does a parallel seq scan on 362K rows. Baseline ~400ms, 3s+
 * under CPU saturation. It's called on every listing page pagination and
 * is memoized in-process for 1h, but after a deploy the in-process memo
 * is cold and unique filter combos each pay the scan cost once.
 *
 * This script computes the count for every (vertical × requireThumbnail
 * × longFormat) combo used by the site's listing pages, and upserts the
 * results into `videos_count_cache`. `countVideos()` in content.ts reads
 * from that table first and falls back to the live query only for user
 * searches (which this script can't enumerate).
 *
 * Run via cron every 15 min — `videos` table changes slowly (scrape cron
 * at 4h UTC, small incremental updates from manual enrichment).
 */

import { Pool } from "pg";
import { BANNED_TAGS } from "./banned-tags";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});

type Combo = {
  vertical: "all" | "hentai" | "3d";
  source: "all";
  requireThumbnail: boolean;
  longFormat: boolean;
};

const COMBOS: Combo[] = [];
for (const vertical of ["all", "hentai", "3d"] as const) {
  for (const requireThumbnail of [false, true]) {
    for (const longFormat of [false, true]) {
      COMBOS.push({ vertical, source: "all", requireThumbnail, longFormat });
    }
  }
}

const VERTICAL_SOURCES: Record<"hentai" | "3d", readonly string[]> = {
  hentai: ["danbooru", "gelbooru", "rule34", "wp", "hentaicity", "hentaigasm"],
  "3d": ["rule34video"],
};

function buildKey(combo: Combo): string {
  return `v=${combo.vertical}|s=${combo.source}|rt=${combo.requireThumbnail ? 1 : 0}|lf=${combo.longFormat ? 1 : 0}|t=`;
}

async function computeOne(combo: Combo): Promise<number> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  conditions.push(
    `NOT (tags && $${i}::text[]) AND NOT (COALESCE(characters, ARRAY[]::text[]) && $${i}::text[]) AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $${i}::text[])`,
  );
  params.push(BANNED_TAGS);
  i++;

  if (combo.requireThumbnail) {
    conditions.push(`thumbnail IS NOT NULL AND thumbnail <> ''`);
  }
  if (combo.longFormat) {
    conditions.push(`source IN ('hentaicity','hentaigasm')`);
  }
  if (combo.vertical !== "all") {
    const group = VERTICAL_SOURCES[combo.vertical];
    conditions.push(`source = ANY($${i}::text[])`);
    params.push(group);
    i++;
  }

  const sql = `SELECT COUNT(*)::bigint AS count FROM videos WHERE ${conditions.join(" AND ")}`;
  const { rows } = await pool.query<{ count: string }>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos_count_cache (
      key TEXT PRIMARY KEY,
      count BIGINT NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function main() {
  const t0 = Date.now();
  await ensureTable();

  for (const combo of COMBOS) {
    const t = Date.now();
    const count = await computeOne(combo);
    const key = buildKey(combo);
    await pool.query(
      `INSERT INTO videos_count_cache (key, count, computed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW()`,
      [key, count],
    );
    console.log(`[precompute] ${key} = ${count} (${Date.now() - t}ms)`);
  }

  console.log(
    `[precompute] done in ${Date.now() - t0}ms for ${COMBOS.length} combos`,
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
