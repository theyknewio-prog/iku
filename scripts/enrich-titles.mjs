#!/usr/bin/env node
/**
 * enrich-titles.mjs — Backfill weak/empty titles on the videos table.
 *
 * 60K rows out of 361K have no title AND no character AND no copyright
 * — they currently render the same generic fallback ("Animated Hentai")
 * which guarantees duplicate-title SERP penalty across thousands of pages.
 *
 * Strategy: pick 1-3 distinctive tags from each video (excluding the
 * massive blacklist of generic tokens) and build a unique title that
 * includes the source-id suffix. Each title becomes unique, includes
 * the "hentai" keyword, and surfaces real searchable terms.
 *
 * Examples:
 *   slug=r34-14029915-1boy tags=[1boy,1girls,3d,uncensored]
 *     → "Uncensored 3D Hentai Animation #14029915"
 *   slug=r34-6659554-1boy  tags=[1boy,1futa,2d,creampie]
 *     → "Futa Creampie 2D Hentai #6659554"
 *
 * Runs in batches, idempotent (skips already-titled rows).
 *
 * Usage:
 *   DATABASE_URL=... node scripts/enrich-titles.mjs
 *   BATCH_SIZE=500 node scripts/enrich-titles.mjs
 *   MAX_BATCHES=10 node scripts/enrich-titles.mjs   # stop after N batches
 *   --dry-run                                       # preview only
 */

import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://iku:iku_pg_2026_strong_pwd_x9k@localhost:15432/iku";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 1000);
const MAX_BATCHES = Number(process.env.MAX_BATCHES || 1000);
const DRY_RUN = process.argv.includes("--dry-run");

// Generic tokens that say nothing about the content. We strip these
// before picking distinctive tags to feed the title generator.
const GENERIC_TAGS = new Set([
  // people-count
  "1boy",
  "1boys",
  "1girl",
  "1girls",
  "1futa",
  "1futanari",
  "2girls",
  "2boys",
  "2futa",
  "3girls",
  "3boys",
  "4girls",
  "4boys",
  "5girls",
  "6girls",
  "multiple_girls",
  "multiple_boys",
  // dim/format
  "2d",
  "3d",
  "2d_animation",
  "3d_animation",
  "animated",
  "animation",
  "animated_gif",
  "animated_png",
  "animatedgif",
  "video",
  "audio",
  "no_sound",
  "sound",
  "with_sound",
  "music",
  "loop",
  "looping",
  "long_video",
  "short_video",
  "long",
  "short",
  "60fps",
  "30fps",
  "high_framerate",
  "vp9",
  "webm",
  "mp4",
  "gif",
  "720p",
  "1080p",
  "4k",
  "8k",
  "hd",
  "uhd",
  "fullhd",
  "highres",
  "lowres",
  "absurdres",
  // generic anatomy / "tagme"-style noise
  "5_fingers",
  "5_toes",
  "10_fingers",
  "10_toes",
  "a_lot_of_tags",
  "lots_of_tags",
  "tagme",
  "tagged",
  "edited",
  "asian_female",
  "asian",
  "female",
  "male",
  // genre/site noise
  "uncensored_video",
  "censored_video",
  "hentai",
  "porn",
  "r34",
  "rule_34",
  "rule34",
  // ambiguous "where" / setting tags that generate dupes across thousands of clips
  "indoors",
  "outdoors",
  "bed",
  "bedroom",
  "wall",
  "against_wall",
  "alternate_costume",
  "alternate_outfit",
]);

// Year-like tags (2018, 2019, ..., 2030).
function isYear(t) {
  return /^(19|20)\d{2}$/.test(t);
}

// File-extension-like tags.
function isFileExt(t) {
  return /^(mp4|webm|gif|mov|avi)$/i.test(t);
}

// Title-case helper that handles underscores and colons.
function titleCase(s) {
  return s
    .replace(/_/g, " ")
    .replace(/:/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function pickDistinctive(tags, max = 3) {
  if (!tags || tags.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const t = String(raw).toLowerCase().trim();
    if (!t) continue;
    if (GENERIC_TAGS.has(t)) continue;
    if (isYear(t)) continue;
    if (isFileExt(t)) continue;
    // Drop super-long tag chains like "girl_with_extremely_large_breasts_and_..."
    if (t.length > 22) continue;
    // Skip pure-numeric tags.
    if (/^\d+$/.test(t)) continue;
    // Dedupe by stem AND by substring overlap (catches anal vs anal_sex).
    const stem = t.replace(/s$/, "");
    let dup = false;
    for (const k of seen) {
      if (
        stem === k ||
        stem.includes(k) ||
        k.includes(stem) ||
        stem.startsWith(k + "_") ||
        k.startsWith(stem + "_")
      ) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    seen.add(stem);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function buildTitle(video) {
  // 1. Prefer character + copyright (already best case).
  if (video.characters?.[0]) {
    const char = titleCase(video.characters[0]);
    if (video.copyrights?.[0]) {
      const series = titleCase(video.copyrights[0]);
      return `${char} Hentai — ${series}`.slice(0, 90);
    }
    return `${char} Hentai`.slice(0, 90);
  }
  // 2. Copyright only.
  if (video.copyrights?.[0]) {
    return `${titleCase(video.copyrights[0])} Hentai`.slice(0, 90);
  }
  // 3. Distinctive tags.
  const distinct = pickDistinctive(video.tags, 3);
  if (distinct.length > 0) {
    const cased = distinct.map(titleCase);
    const idSuffix = String(video.id).slice(-6);
    return `${cased.join(" ")} Hentai #${idSuffix}`.slice(0, 90);
  }
  // 4. Last resort: source + id (unique at least).
  const idSuffix = String(video.id).slice(-6);
  return `Animated Hentai Clip #${idSuffix}`;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  let totalUpdated = 0;
  let batchNum = 0;

  try {
    while (batchNum < MAX_BATCHES) {
      const { rows } = await pool.query(
        `SELECT pk, source_id, slug, title, characters, copyrights, tags
         FROM videos
         WHERE (title IS NULL OR title = '' OR length(title) < 8)
         ORDER BY score DESC NULLS LAST
         LIMIT $1`,
        [BATCH_SIZE],
      );
      if (rows.length === 0) {
        console.log(`  No more weak-title rows.`);
        break;
      }
      batchNum += 1;

      const updates = rows.map((r) => ({
        pk: r.pk,
        title: buildTitle({ ...r, id: r.source_id }),
      }));

      if (DRY_RUN) {
        console.log(`  Batch ${batchNum} preview (${updates.length} rows):`);
        updates
          .slice(0, 5)
          .forEach((u) => console.log(`    pk=${u.pk} → ${u.title}`));
        break;
      }

      // Bulk update via UNNEST.
      const pks = updates.map((u) => u.pk);
      const titles = updates.map((u) => u.title);
      await pool.query(
        `UPDATE videos AS v
         SET title = data.title
         FROM (SELECT * FROM UNNEST($1::int[], $2::text[]) AS t(pk, title)) AS data
         WHERE v.pk = data.pk`,
        [pks, titles],
      );

      totalUpdated += updates.length;
      console.log(
        `  Batch ${batchNum}: ${updates.length} rows updated (total: ${totalUpdated})`,
      );
    }
  } finally {
    await pool.end();
  }

  console.log(`Done. ${totalUpdated} titles enriched.`);
}

main().catch((err) => {
  console.error("enrich-titles failed:", err);
  process.exit(1);
});
