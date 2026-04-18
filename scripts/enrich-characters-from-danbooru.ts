#!/usr/bin/env npx tsx
/**
 * enrich-characters-from-danbooru.ts
 *
 * Backfill characters + copyrights on videos from sources that don't
 * expose character metadata directly (rule34video, rule34, gelbooru, wp,
 * hentaicity, hentaigasm).
 *
 * Strategy: Danbooru gives us a master list of ~15K characters and ~3K
 * copyrights that are already populated on our 17K Danbooru rows. Every
 * other source has empty `characters` + `copyrights`. For each non-Danbooru
 * video we:
 *   1. Tokenize its title + tags into a lowercase set
 *   2. For each known character/copyright, check if its normalized form
 *      appears as a substring or token match in the title/tags
 *   3. Write the matches back to the row
 *
 * Normalization: Danbooru uses underscores ("hatsune_miku") while scraped
 * titles use spaces ("Hatsune Miku"). Normalize both sides to
 * space-delimited lowercase before comparison.
 *
 * Why this matters: Sab's complaint 2026-04-11 "la page character browse
 * hentai est meme pas enrichi avec le nouveau contenu d'hier" — the
 * /character/[slug] pages only return Danbooru rows (the only source with
 * non-empty `characters`). This enriches the other 336K rows so character
 * browse finally covers the full catalog.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/enrich-characters-from-danbooru.ts
 *
 * Flags:
 *   --dry       Don't write, just report what would change
 *   --source X  Only process rows where source = X (e.g. hentaicity)
 *   --limit N   Only process N rows (debugging)
 */

import { pool } from "./db";
import { BANNED_TAGS } from "./banned-tags";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry");
const SOURCE_FILTER = (() => {
  const i = args.indexOf("--source");
  return i >= 0 ? args[i + 1] : null;
})();
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1], 10) : null;
})();

// ── Load master lists of characters + copyrights from existing Danbooru rows ──

interface MasterEntry {
  raw: string; // original form (e.g. "hatsune_miku")
  normalized: string; // space-delimited lowercase (e.g. "hatsune miku")
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common English words and generic terms that collide with anime/character
// names in Danbooru. These got through when we freq >= 2 because Danbooru
// has a few rows tagged with each, but matching them as copyrights/characters
// on scraped hentai titles produces mostly false positives.
const STOPLIST = new Set([
  "another",
  "together",
  "inside",
  "outside",
  "between",
  "before",
  "after",
  "sister",
  "mother",
  "father",
  "brother",
  "husband",
  "wife",
  "girl",
  "boy",
  "woman",
  "man",
  "boys",
  "girls",
  "women",
  "men",
  "hentai",
  "anime",
  "manga",
  "video",
  "episode",
  "scene",
  "series",
  "original",
  "remix",
  "remake",
  "english",
  "japanese",
  "subbed",
  "raw",
  "school",
  "teacher",
  "student",
  "office",
  "swimsuit",
  "uniform",
  "animated",
  "animation",
  "motion",
  "comic",
  "story",
  "novel",
  "bakery",
  "cafe",
  "restaurant",
  "gym",
  "beach",
  "pool",
  "witch",
  "angel",
  "demon",
  "vampire",
  "zombie",
  "dream",
  "memory",
  "secret",
  "wish",
  "promise",
  "miracle",
  "black",
  "white",
  "red",
  "blue",
  "green",
  "pink",
  "yellow",
  "dark",
  "light",
  "silver",
  "gold",
  "one",
  "two",
  "three",
  "first",
  "second",
  "third",
  "last",
  "house",
  "home",
  "city",
  "town",
  "village",
  "world",
  "earth",
  "love",
  "lust",
  "heart",
  "soul",
  "mind",
  "night",
  "morning",
  "evening",
  "summer",
  "winter",
  "spring",
  "autumn",
]);

async function loadMasterList(
  column: "characters" | "copyrights",
): Promise<MasterEntry[]> {
  const { rows } = await pool.query<{ name: string; freq: number }>(
    `SELECT name, COUNT(*)::int AS freq
     FROM (
       SELECT unnest(${column}) AS name
       FROM videos
       WHERE source = 'danbooru'
         AND ${column} IS NOT NULL
     ) t
     WHERE name <> ''
     GROUP BY name
     HAVING COUNT(*) >= 2
     ORDER BY freq DESC`,
  );

  const seen = new Set<string>();
  const out: MasterEntry[] = [];
  for (const r of rows) {
    const rawLower = r.name.toLowerCase();
    if (BANNED_TAGS.has(rawLower)) continue;

    const n = normalize(r.name);
    if (n.length < 3) continue;

    // Reject anything in the English stoplist
    if (STOPLIST.has(n)) continue;

    // Single-word entries are risky (collide with English words). Require:
    //   - length >= 8 chars
    //   - frequency >= 10 on Danbooru (less popular = too risky)
    // Multi-word entries are much safer because they rarely collide.
    if (!n.includes(" ")) {
      if (n.length < 8) continue;
      if (r.freq < 10) continue;
    }

    if (seen.has(n)) continue;
    seen.add(n);
    out.push({ raw: r.name, normalized: n });
  }
  return out;
}

// ── Build a fast scan function ──

/**
 * For each master entry, check if its normalized form appears in the haystack.
 * "Appears" means: it's a whole-word substring match (word boundaries).
 * e.g. "rem" should match "rem re zero" but NOT "remember".
 */
function findMatches(haystack: string, masters: MasterEntry[]): string[] {
  const matches: string[] = [];
  for (const m of masters) {
    // Escape regex metacharacters in the normalized form
    const pat = m.normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Require word boundaries so "rem" only matches "rem", not "remember"
    const re = new RegExp(`(^|\\W)${pat}(\\W|$)`);
    if (re.test(haystack)) {
      matches.push(m.raw);
    }
  }
  return matches;
}

// ── Main pipeline ──

async function main() {
  console.log("── enrich-characters-from-danbooru ──");
  console.log(`dry run: ${DRY_RUN}`);
  console.log(`source filter: ${SOURCE_FILTER ?? "all non-danbooru"}`);

  console.log("\nLoading master character list from Danbooru rows…");
  const characterMaster = await loadMasterList("characters");
  console.log(`  ${characterMaster.length} unique characters (freq >= 2)`);

  console.log("Loading master copyright list from Danbooru rows…");
  const copyrightMaster = await loadMasterList("copyrights");
  console.log(`  ${copyrightMaster.length} unique copyrights (freq >= 2)`);

  // Fetch target rows: videos that currently have empty characters AND aren't Danbooru
  const whereClauses = [
    "(characters IS NULL OR array_length(characters, 1) IS NULL OR array_length(characters, 1) = 0)",
    "source <> 'danbooru'",
  ];
  const params: unknown[] = [];
  if (SOURCE_FILTER) {
    whereClauses.push(`source = $${params.length + 1}`);
    params.push(SOURCE_FILTER);
  }
  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : "";

  const query = `
    SELECT source, slug, title, tags
    FROM videos
    WHERE ${whereClauses.join(" AND ")}
    ${limitClause}
  `;
  console.log(`\nFetching target rows…`);
  const { rows } = await pool.query<{
    source: string;
    slug: string;
    title: string;
    tags: string[] | null;
  }>(query, params);
  console.log(`  ${rows.length.toLocaleString()} rows to process`);

  let updated = 0;
  let totalCharAssignments = 0;
  let totalCopyAssignments = 0;
  let processed = 0;
  const bySource: Record<string, { total: number; enriched: number }> = {};

  const BATCH_SIZE = 500;

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);

    if (!DRY_RUN) {
      // Begin a transaction for this batch
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        for (const row of batch) {
          const src = row.source;
          bySource[src] ??= { total: 0, enriched: 0 };
          bySource[src].total += 1;

          // Build haystack from title + tags (title may be null on some legacy rows)
          const title = row.title ?? "";
          const tagBlob = (row.tags ?? []).join(" ");
          const haystack = normalize(`${title} ${tagBlob}`);

          const chars = findMatches(haystack, characterMaster);
          const copys = findMatches(haystack, copyrightMaster);

          if (chars.length === 0 && copys.length === 0) continue;

          await client.query(
            `UPDATE videos
             SET characters = $1::text[],
                 copyrights = $2::text[]
             WHERE source = $3 AND slug = $4`,
            [chars, copys, src, row.slug],
          );
          updated += 1;
          totalCharAssignments += chars.length;
          totalCopyAssignments += copys.length;
          bySource[src].enriched += 1;
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Dry run — just count
      for (const row of batch) {
        const src = row.source;
        bySource[src] ??= { total: 0, enriched: 0 };
        bySource[src].total += 1;

        const title = row.title ?? "";
        const tagBlob = (row.tags ?? []).join(" ");
        const haystack = normalize(`${title} ${tagBlob}`);

        const chars = findMatches(haystack, characterMaster);
        const copys = findMatches(haystack, copyrightMaster);

        if (chars.length > 0 || copys.length > 0) {
          updated += 1;
          totalCharAssignments += chars.length;
          totalCopyAssignments += copys.length;
          bySource[src].enriched += 1;

          if (updated <= 5) {
            console.log(`\n[sample] ${src} ${row.slug}`);
            console.log(`  title: ${title.slice(0, 80)}`);
            if (chars.length)
              console.log(`  chars: ${chars.slice(0, 5).join(", ")}`);
            if (copys.length)
              console.log(`  copys: ${copys.slice(0, 5).join(", ")}`);
          }
        }
      }
    }

    processed += batch.length;
    if (processed % (BATCH_SIZE * 4) === 0) {
      console.log(
        `  processed ${processed.toLocaleString()} / ${rows.length.toLocaleString()} — ${updated.toLocaleString()} enriched`,
      );
    }
  }

  console.log("\n── Done ──");
  console.log(`Total rows processed: ${processed.toLocaleString()}`);
  console.log(
    `Rows with at least one match: ${updated.toLocaleString()} (${((updated / processed) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Character assignments: ${totalCharAssignments.toLocaleString()}`,
  );
  console.log(
    `Copyright assignments: ${totalCopyAssignments.toLocaleString()}`,
  );
  console.log("\nPer source:");
  for (const [src, stats] of Object.entries(bySource)) {
    const pct = stats.total
      ? ((stats.enriched / stats.total) * 100).toFixed(1)
      : "0.0";
    console.log(
      `  ${src.padEnd(14)} ${stats.enriched.toLocaleString().padStart(8)} / ${stats.total.toLocaleString().padStart(8)}  (${pct}%)`,
    );
  }

  if (DRY_RUN) {
    console.log("\n(dry run — no changes committed)");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
