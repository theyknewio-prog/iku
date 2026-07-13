#!/usr/bin/env node
/**
 * retitle-from-tags.mjs — rebuild rule34 titles from properly typed tags.
 *
 * rule34's post API returns one flat, alphabetically-sorted tag list with no type
 * information, so `characters` and `copyrights` were never populated and titles
 * fell back to "first three tags", i.e. whatever sorts first:
 *   "10 Seconds Animal Genitalia Animal Penis Hentai #901539"
 *
 * fetch-rule34-tag-types.mjs resolves the type of every tag from rule34's *tag*
 * API into rule34_tag_types (4=character, 3=series, 1=artist, 0=general, with a
 * post_count). This script reads that table and rebuilds the titles:
 *
 *   character + series  →  "Tifa Lockhart Hentai — Final Fantasy VII"
 *   character only      →  "Tifa Lockhart Hentai"
 *   series only         →  "Final Fantasy VII Hentai"
 *   neither             →  the RAREST general tags, never the alphabetical ones.
 *                          post_count is the whole point: a tag on 200 posts says
 *                          something, a tag on 165,000 (ahegao) says nothing.
 *
 * Titles only. Slugs are `r34-{id}-{firstTag}`, derived from the id and the tag
 * array, never from the title — so nothing here changes a URL, 404s anything, or
 * needs a redirect. Sitemap <video:title> updates on the next crawl.
 *
 *   node scripts/retitle-from-tags.mjs --dry-run   # preview, no writes
 *   node scripts/retitle-from-tags.mjs             # apply
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = Number(process.env.BATCH_SIZE || 2000);

if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

// A general tag on more posts than this is wallpaper — true of everything,
// descriptive of nothing. Tuned against the catalog: ahegao is on 165K posts.
const TOO_COMMON = 40000;

// Tags that survive the count filter but still describe the file, not the scene.
const FORMAT_NOISE =
  /^(\d+(boys?|girls?|futas?)|\d+d|\d+d_\(artwork\)|\d+d_animation|\d+x\d+|\d+fps|\d+p|\d+k|\d+_?(seconds?|minutes?)|\d+s|(19|20)\d{2}|\d+:\d+(_aspect_ratio)?|\d+)$/;

const isUsableGeneral = (name) =>
  !FORMAT_NOISE.test(name) &&
  !/^(animated|animation|video|audio|sound|no_sound|with_sound|audible_speech|music|loop|looping|hd|highres|absurdres|webm|mp4|gif|hentai|porn|rule_?34|r34|tagme|edited|female|male|aspect_ratio|alternate_version_available|longer_version_available|source_request)$/.test(
    name,
  ) &&
  !name.includes("aspect_ratio") &&
  /^[a-z0-9][a-z0-9_'().-]*$/.test(name) && // drop ">=", ":>=" and friends
  name.length >= 3 &&
  name.length <= 24;

const titleCase = (s) =>
  s
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

function buildTitle({ chars, series, generals, sourceId }) {
  if (chars.length) {
    const c = titleCase(chars[0]);
    return series.length
      ? `${c} Hentai — ${titleCase(series[0])}`.slice(0, 90)
      : `${c} Hentai`.slice(0, 90);
  }
  if (series.length) return `${titleCase(series[0])} Hentai`.slice(0, 90);

  // No name to anchor on. A tag-salad title is no better than the tag-salad
  // title already there, and the rarity sort can strip a row down to nothing
  // ("Animated Hentai Clip #076045") — strictly worse than what it replaces.
  // Leave those rows alone; only rewrite what we can genuinely improve.
  return null;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  pool.on("error", (e) => console.log(`  pool error (ignored): ${e.message}`));

  try {
    await pool.query("SET statement_timeout = 180000");

    const { rows: types } = await pool.query(
      `SELECT name, type, post_count FROM rule34_tag_types`,
    );
    if (types.length === 0) {
      console.error(
        "rule34_tag_types is empty — run fetch-rule34-tag-types first.",
      );
      process.exit(1);
    }
    const T = new Map(types.map((t) => [t.name, t]));
    console.log(`Dictionary: ${T.size} typed tags\n`);

    const { rows } = await pool.query(
      `SELECT pk, source_id, title, tags FROM videos
        WHERE source = 'rule34' AND dead_at IS NULL
        ORDER BY score DESC NULLS LAST`,
    );
    console.log(`${rows.length} rule34 rows\n`);

    let named = 0,
      updated = 0;
    const preview = [];
    let batch = [];

    // Pass 1 — resolve the tags and build the base title for every row.
    const planned = [];
    for (const row of rows) {
      const tags = row.tags || [];
      const chars = [];
      const series = [];
      const generals = [];

      for (const t of tags) {
        const info = T.get(t);
        if (!info) continue;
        if (info.type === 4) chars.push(t);
        else if (info.type === 3) series.push(t);
        else if (
          info.type === 0 &&
          info.post_count > 0 &&
          info.post_count < TOO_COMMON &&
          isUsableGeneral(t)
        ) {
          generals.push(t);
        }
      }
      // Rarest first — the whole reason the old titles were interchangeable.
      generals.sort((a, b) => T.get(a).post_count - T.get(b).post_count);

      if (chars.length || series.length) named++;

      const base = buildTitle({ chars, series, generals });
      if (!base) continue;
      planned.push({
        pk: row.pk,
        sourceId: row.source_id,
        base,
        chars,
        series,
        old: row.title,
      });
    }

    // Pass 2 — a name alone is not unique: 200 Ahri clips would all become
    // "Ahri Hentai", recreating the duplicate-title problem this is meant to
    // kill. Keep the readable name in front and disambiguate only on collision.
    const seen = new Map();
    for (const p of planned) seen.set(p.base, (seen.get(p.base) || 0) + 1);

    for (const p of planned) {
      const title =
        seen.get(p.base) > 1
          ? `${p.base} #${String(p.sourceId).slice(-6)}`.slice(0, 90)
          : p.base;
      if (title === p.old) continue;

      if (preview.length < 14) preview.push({ from: p.old, to: title });
      batch.push({ pk: p.pk, title, chars: p.chars, series: p.series });

      if (!DRY_RUN && batch.length >= BATCH) {
        await flush(pool, batch);
        updated += batch.length;
        batch = [];
        process.stdout.write(`\r  updated ${updated}…`);
      }
    }
    if (!DRY_RUN && batch.length) {
      await flush(pool, batch);
      updated += batch.length;
    }

    console.log(`\n── Sample rewrites ──────────────────────────────`);
    preview.forEach((p) => console.log(`  ${p.from}\n   → ${p.to}\n`));
    const pct = ((100 * named) / rows.length).toFixed(1);
    console.log(`── Result ───────────────────────────────────────`);
    console.log(`  rows with a real character/series name: ${named} (${pct}%)`);
    console.log(
      DRY_RUN
        ? `  DRY RUN — nothing written.`
        : `  Done. ${updated} titles rewritten.`,
    );
  } finally {
    await pool.end();
  }
}

async function flush(pool, batch) {
  await pool.query(
    `UPDATE videos AS v SET
       title = d.title,
       characters = CASE WHEN cardinality(d.chars)  > 0 THEN d.chars  ELSE v.characters END,
       copyrights = CASE WHEN cardinality(d.series) > 0 THEN d.series ELSE v.copyrights END
     FROM (
       SELECT UNNEST($1::int[]) AS pk, UNNEST($2::text[]) AS title,
              UNNEST($3::text[]) AS chars_csv, UNNEST($4::text[]) AS series_csv
     ) raw,
     LATERAL (SELECT
       CASE WHEN raw.chars_csv  = '' THEN '{}'::text[] ELSE string_to_array(raw.chars_csv, '|')  END AS chars,
       CASE WHEN raw.series_csv = '' THEN '{}'::text[] ELSE string_to_array(raw.series_csv, '|') END AS series
     ) d2,
     LATERAL (SELECT raw.pk AS pk, raw.title AS title, d2.chars AS chars, d2.series AS series) d
     WHERE v.pk = d.pk`,
    [
      batch.map((b) => b.pk),
      batch.map((b) => b.title),
      batch.map((b) => b.chars.join("|")),
      batch.map((b) => b.series.join("|")),
    ],
  );
}

main().catch((e) => {
  console.error("retitle failed:", e);
  process.exit(1);
});
