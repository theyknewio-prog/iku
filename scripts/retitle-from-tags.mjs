#!/usr/bin/env node
/**
 * retitle-from-tags.mjs — rebuild titles for videos whose tags were never typed.
 *
 * rule34.xxx returns one flat, alphabetically-sorted tag list — no character or
 * copyright split, unlike danbooru/gelbooru. So `characters` and `copyrights`
 * land empty, enrich-titles.mjs falls through to its tag branch, and that branch
 * walks the tag array in stored (= alphabetical) order. Result:
 *   "10 Seconds Animal Genitalia Animal Penis Hentai #901539"
 *
 * Gelbooru rows, whose tags ARE typed, get "Belle (Zenless Zone Zero) Hentai —
 * Zenless Zone Zero" instead — and those are the pages ranking 1-4 in GSC.
 *
 * So: reuse the characters/copyrights that danbooru+gelbooru already resolved as
 * a dictionary, find those names inside the untyped tag lists, backfill the
 * columns, and let the good title branch do the rest.
 *
 * Titles only — slugs are `r34-{id}-{firstTag}`, derived from the id and the tag
 * array, never from the title. Nothing here changes a URL.
 *
 *   node scripts/retitle-from-tags.mjs --dry-run          # preview, no writes
 *   node scripts/retitle-from-tags.mjs --source=rule34    # apply
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE = (
  process.argv.find((a) => a.startsWith("--source=")) || "--source=rule34"
).split("=")[1];
const BATCH = Number(process.env.BATCH_SIZE || 2000);

if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

// Tags that are true of half the catalog and so identify nothing.
const GENERIC = new Set([
  "1boy",
  "1boys",
  "1girl",
  "1girls",
  "2girls",
  "2boys",
  "3girls",
  "3boys",
  "4girls",
  "4boys",
  "5girls",
  "6girls",
  "7boys",
  "10boys",
  "1futa",
  "2futas",
  "multiple_girls",
  "multiple_boys",
  "2d",
  "3d",
  "2d_animation",
  "3d_animation",
  "2d_(artwork)",
  "3d_(artwork)",
  "animated",
  "animation",
  "animated_gif",
  "video",
  "audio",
  "sound",
  "no_sound",
  "with_sound",
  "audible_speech",
  "music",
  "loop",
  "looping",
  "long_video",
  "short_video",
  "60fps",
  "30fps",
  "1920x1080",
  "720p",
  "1080p",
  "4k",
  "hd",
  "highres",
  "absurdres",
  "webm",
  "mp4",
  "gif",
  "hentai",
  "porn",
  "rule34",
  "rule_34",
  "r34",
  "tagme",
  "edited",
  "female",
  "male",
  "uncensored",
  "censored",
  "alternate_version_available",
]);

const isNoise = (t) =>
  GENERIC.has(t) ||
  /^(19|20)\d{2}$/.test(t) || // years
  /^\d+_?(seconds?|minutes?|fps)$/.test(t) || // "10_seconds", "60fps"
  /^\d+x\d+$/.test(t) || // resolutions
  /^\d+$/.test(t);

const titleCase = (s) =>
  s
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

function buildTitle({ characters, copyrights, tags, sourceId }) {
  if (characters?.[0]) {
    const char = titleCase(characters[0]);
    return copyrights?.[0]
      ? `${char} Hentai — ${titleCase(copyrights[0])}`.slice(0, 90)
      : `${char} Hentai`.slice(0, 90);
  }
  if (copyrights?.[0]) return `${titleCase(copyrights[0])} Hentai`.slice(0, 90);

  // No name to anchor on: at least lead with tags that describe the act, not
  // whatever happens to sort first alphabetically.
  const distinctive = (tags || []).filter((t) => !isNoise(t)).slice(0, 3);
  const suffix = String(sourceId).slice(-6);
  return distinctive.length
    ? `${distinctive.map(titleCase).join(" ")} Hentai #${suffix}`.slice(0, 90)
    : `Animated Hentai Clip #${suffix}`;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  pool.on("error", (e) => console.log(`  pool error (ignored): ${e.message}`));

  try {
    await pool.query("SET statement_timeout = 120000");

    console.log("Loading character/copyright dictionary from typed sources…");
    const { rows: dict } = await pool.query(`
      SELECT DISTINCT unnest(characters) AS name, 'char' AS kind
        FROM videos WHERE source IN ('danbooru','gelbooru') AND characters IS NOT NULL
      UNION
      SELECT DISTINCT unnest(copyrights) AS name, 'copy' AS kind
        FROM videos WHERE source IN ('danbooru','gelbooru') AND copyrights IS NOT NULL
    `);
    const chars = new Set(
      dict.filter((r) => r.kind === "char").map((r) => r.name),
    );
    const copys = new Set(
      dict.filter((r) => r.kind === "copy").map((r) => r.name),
    );
    console.log(`  ${chars.size} characters, ${copys.size} series`);

    const { rows: todo } = await pool.query(
      `SELECT pk, source_id, title, tags FROM videos
        WHERE source = $1 AND dead_at IS NULL
        ORDER BY score DESC NULLS LAST`,
      [SOURCE],
    );
    console.log(`  ${todo.length} ${SOURCE} rows to examine\n`);

    let matchedChar = 0,
      matchedCopy = 0,
      updated = 0;
    const preview = [];
    const batch = [];

    for (const row of todo) {
      const tags = row.tags || [];
      const foundChars = tags.filter((t) => chars.has(t));
      const foundCopys = tags.filter((t) => copys.has(t));
      if (foundChars.length) matchedChar++;
      if (foundCopys.length) matchedCopy++;

      const title = buildTitle({
        characters: foundChars,
        copyrights: foundCopys,
        tags,
        sourceId: row.source_id,
      });
      if (title === row.title) continue;

      if (preview.length < 12) preview.push({ from: row.title, to: title });
      batch.push({ pk: row.pk, title, chars: foundChars, copys: foundCopys });

      if (!DRY_RUN && batch.length >= BATCH) {
        await flush(pool, batch);
        updated += batch.length;
        batch.length = 0;
        process.stdout.write(`\r  updated ${updated}…`);
      }
    }
    if (!DRY_RUN && batch.length) {
      await flush(pool, batch);
      updated += batch.length;
    }

    console.log(`\n── Sample rewrites ─────────────────────────`);
    preview.forEach((p) => console.log(`  ${p.from}\n   → ${p.to}\n`));
    const pct = (n) => ((100 * n) / todo.length).toFixed(1);
    console.log(`── Coverage ────────────────────────────────`);
    console.log(
      `  character found in tags : ${matchedChar} (${pct(matchedChar)}%)`,
    );
    console.log(
      `  series found in tags    : ${matchedCopy} (${pct(matchedCopy)}%)`,
    );
    console.log(
      DRY_RUN
        ? `\n  DRY RUN — nothing written. ${batch.length} rows would change.`
        : `\n  Done. ${updated} titles rewritten.`,
    );
  } finally {
    await pool.end();
  }
}

async function flush(pool, batch) {
  await pool.query(
    `UPDATE videos AS v SET
       title = d.title,
       characters = CASE WHEN array_length(d.chars,1) > 0 THEN d.chars ELSE v.characters END,
       copyrights = CASE WHEN array_length(d.copys,1) > 0 THEN d.copys ELSE v.copyrights END
     FROM (SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[][], $4::text[][]))
          AS d(pk, title, chars, copys)
     WHERE v.pk = d.pk`,
    [
      batch.map((b) => b.pk),
      batch.map((b) => b.title),
      batch.map((b) => b.chars),
      batch.map((b) => b.copys),
    ],
  );
}

main().catch((e) => {
  console.error("retitle failed:", e);
  process.exit(1);
});
