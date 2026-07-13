#!/usr/bin/env node
/**
 * fetch-rule34-tag-types.mjs — resolve what each rule34 tag actually IS.
 *
 * rule34.xxx's post API hands back one flat alphabetical tag list with no type
 * information, so `characters` and `copyrights` land empty and titles degrade to
 * "10 Seconds Animal Genitalia Animal Penis Hentai #901539". Its *tag* API does
 * know the type, one tag at a time:
 *
 *   type=4 character   type=3 copyright   type=1 artist   type=0 general
 *   count=N            how many posts carry it — low count = distinctive
 *
 * ~8.5K distinct tags across the catalog, throttled at 2 req/s per the house
 * rate limit, so a full pass is ~70min. Idempotent: only fetches tags missing
 * from rule34_tag_types, so a re-run after a scrape costs only the new ones.
 *
 *   DATABASE_URL=... node scripts/fetch-rule34-tag-types.mjs
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = process.env.RULE34_API_KEY;
const USER_ID = process.env.RULE34_USER_ID;
const THROTTLE_MS = 500; // 2 req/s — house limit for rule34

if (!DATABASE_URL || !API_KEY || !USER_ID) {
  console.error("DATABASE_URL, RULE34_API_KEY, RULE34_USER_ID required");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTagType(name) {
  const url =
    `https://api.rule34.xxx/index.php?page=dapi&s=tag&q=index` +
    `&name=${encodeURIComponent(name)}&api_key=${API_KEY}&user_id=${USER_ID}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        await sleep(3000);
        continue;
      }
      const xml = await res.text();
      // The API answers a `name=` query with fuzzy matches too, so pin the exact one.
      const re = new RegExp(
        `<tag type="(\\d+)" count="(\\d+)" name="${name.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        )}"`,
      );
      const m = xml.match(re);
      if (!m) return null;
      return { type: Number(m[1]), count: Number(m[2]) };
    } catch {
      await sleep(1500);
    }
  }
  return null;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 });
  pool.on("error", (e) => console.log(`  pool error (ignored): ${e.message}`));

  try {
    await pool.query("SET statement_timeout = 120000");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rule34_tag_types (
        name       TEXT PRIMARY KEY,
        type       SMALLINT NOT NULL,
        post_count INTEGER  NOT NULL DEFAULT 0,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await pool.query(`
      SELECT DISTINCT t AS name
        FROM (SELECT unnest(tags) AS t FROM videos
               WHERE source = 'rule34' AND dead_at IS NULL) x
       WHERE t NOT IN (SELECT name FROM rule34_tag_types)
       ORDER BY 1
    `);
    console.log(
      `${rows.length} tags to resolve (already-known ones skipped)\n`,
    );
    if (rows.length === 0) return;

    const eta = Math.ceil((rows.length * THROTTLE_MS) / 60000);
    console.log(`ETA ~${eta} min at 2 req/s\n`);

    let done = 0,
      chars = 0,
      copys = 0,
      artists = 0,
      misses = 0;
    const buffer = [];

    for (const { name } of rows) {
      const info = await fetchTagType(name);
      done++;
      if (info) {
        if (info.type === 4) chars++;
        else if (info.type === 3) copys++;
        else if (info.type === 1) artists++;
        buffer.push({ name, type: info.type, count: info.count });
      } else {
        misses++;
        buffer.push({ name, type: 0, count: 0 }); // cache the miss, don't refetch
      }

      if (buffer.length >= 100) {
        await flush(pool, buffer);
        buffer.length = 0;
        process.stdout.write(
          `\r  ${done}/${rows.length} — ${chars} chars, ${copys} series, ${artists} artists, ${misses} unknown`,
        );
      }
      await sleep(THROTTLE_MS);
    }
    if (buffer.length) await flush(pool, buffer);

    console.log(
      `\n\nDone. ${done} tags resolved: ${chars} characters, ${copys} series, ${artists} artists, ${misses} unknown.`,
    );
  } finally {
    await pool.end();
  }
}

async function flush(pool, buffer) {
  await pool.query(
    `INSERT INTO rule34_tag_types (name, type, post_count)
     SELECT * FROM UNNEST($1::text[], $2::smallint[], $3::int[])
     ON CONFLICT (name) DO UPDATE
       SET type = EXCLUDED.type, post_count = EXCLUDED.post_count, fetched_at = now()`,
    [
      buffer.map((b) => b.name),
      buffer.map((b) => b.type),
      buffer.map((b) => b.count),
    ],
  );
}

main().catch((e) => {
  console.error("fetch-rule34-tag-types failed:", e);
  process.exit(1);
});
