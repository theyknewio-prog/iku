#!/usr/bin/env node
/**
 * enrich-entity-seo.mjs — DATA-DRIVEN per-entity SEO body generator (v2).
 *
 * v1 wrote templated prose ("Watch the best X hentai on iku.gg…") — the exact
 * AI-slop fingerprint Google's Helpful Content / Scaled Content Abuse policy
 * suppresses. v2 leads every page with FIRST-PARTY DATA that no source site
 * has: the aggregate view across all 5 sources. Counts, 3D/2D split, top
 * artists, top co-tags, score stats, recent additions. The numbers differ
 * wildly per entity, so no two pages share a skeleton — it reads like a
 * database entry (MyAnimeList-style), not scaled content.
 *
 * For each entity (tag / character / series above a video-count threshold):
 *   - intro: 3 short paragraphs, DATA-led, varied by slug hash
 *   - faq:   3 data-driven Q&A pairs citing real numbers
 *   - meta:  structured stats jsonb (sources, artists, cotags, splits) so the
 *            page can render a factual stats panel later
 *
 * Writes to PG entity_seo. Runtime reads via memoized helper (entity-seo.ts).
 *
 * Usage:
 *   node scripts/enrich-entity-seo.mjs                 # all types, full universe
 *   ENTITY=tag node scripts/enrich-entity-seo.mjs      # one type
 *   MIN_TAG=10 MIN_CHAR=3 MIN_SERIES=3 ...             # thresholds
 *   FORCE=1 ...                                        # ignore freshness, rewrite all
 *   MAX=500 ...                                        # cap rows per type
 *   --dry-run                                          # preview 3, no write
 */

import pg from "pg";
import crypto from "crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://iku:iku_pg_2026_strong_pwd_x9k@localhost:15432/iku";

const ENTITY = process.env.ENTITY || "all";
const MIN_VIDEOS = {
  tag: Number(process.env.MIN_TAG || 10),
  character: Number(process.env.MIN_CHAR || 3),
  series: Number(process.env.MIN_SERIES || 3),
};
const MAX_PER_TYPE = Number(process.env.MAX || 50000);
const STALE_DAYS = Number(process.env.STALE_DAYS || 14);
const FORCE = process.env.FORCE === "1";
const DRY_RUN = process.argv.includes("--dry-run");

// Generic / structural tags that carry no editorial signal — excluded from
// co-tag lists so we surface meaningful kinks/styles, not "1girl".
const NOISE_TAGS = new Set([
  "animated",
  "video",
  "sound",
  "hentai",
  "1girl",
  "1boy",
  "2d",
  "3d",
  "uncensored",
  "censored",
  "solo",
  "duo",
  "hd",
  "mp4",
  "webm",
  "longer_than_30_seconds",
  "longer_than_one_minute",
  "tagme",
  "has_audio",
  "voice_acted",
  "english",
]);

function hashIdx(key, n) {
  const h = crypto.createHash("md5").update(key).digest();
  return h.readUInt32BE(0) % n;
}
function pick(key, variants) {
  return variants[hashIdx(key, variants.length)];
}
function titleCase(s) {
  return (s || "")
    .replace(/_/g, " ")
    .replace(/:/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}
const n = (x) => Number(x || 0).toLocaleString("en-US");
function andList(arr, max = 3) {
  const a = (arr || [])
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean)
    .slice(0, max);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

// OPSEC: never name the upstream sources in indexed copy. Naming them
// (a) breaks the public-copy opsec rule and (b) hands Google a literal
// "this is aggregated from site X" signal — the exact duplicate/scaled-
// content flag we're trying to escape. Public text uses generic,
// count-based phrasing only. Raw source names live in meta jsonb for
// internal stats and must never be rendered into page text.

// ─────────────────────────────────────────────────────────────────
// Per-entity aggregate stats — ONE query, all the first-party data.

async function entityStats(pool, type, slug) {
  const col =
    type === "tag"
      ? "tags"
      : type === "character"
        ? "characters"
        : "copyrights";
  const { rows } = await pool.query(
    `WITH m AS (
       SELECT * FROM videos
       WHERE $1 = ANY(${col}) AND dead_at IS NULL AND thumbnail <> ''
     )
     SELECT
       (SELECT COUNT(*) FROM m)::int AS total,
       (SELECT COUNT(*) FROM m WHERE '3d' = ANY(tags))::int AS three_d,
       (SELECT ROUND(AVG(score)) FROM m)::int AS avg_score,
       (SELECT MAX(score) FROM m)::int AS max_score,
       (SELECT COUNT(*) FROM m WHERE created_at > NOW() - INTERVAL '30 days')::int AS recent,
       (SELECT json_agg(s) FROM (SELECT source, COUNT(*)::int c FROM m GROUP BY source ORDER BY c DESC) s) AS sources,
       (SELECT json_agg(a) FROM (SELECT lower(x) name, COUNT(*)::int c FROM m, unnest(artists) x WHERE x NOT IN ('unknown','') GROUP BY 1 ORDER BY c DESC LIMIT 5) a) AS artists,
       (SELECT json_agg(t) FROM (SELECT lower(x) name, COUNT(*)::int c FROM m, unnest(tags) x WHERE x <> $1 AND length(x) > 2 GROUP BY 1 ORDER BY c DESC LIMIT 14) t) AS cotags,
       (SELECT json_agg(c) FROM (SELECT lower(x) name, COUNT(*)::int c FROM m, unnest(characters) x WHERE x <> $1 GROUP BY 1 ORDER BY c DESC LIMIT 6) c) AS chars,
       (SELECT json_agg(cp) FROM (SELECT lower(x) name, COUNT(*)::int c FROM m, unnest(copyrights) x WHERE x <> $1 GROUP BY 1 ORDER BY c DESC LIMIT 4) cp) AS copyrights`,
    [slug],
  );
  const r = rows[0] || {};
  const total = r.total || 0;
  const threeD = r.three_d || 0;

  // Name-fragment guard: booru tags split an entity name into pieces
  // ("genshin", "impact", "chun", "li", "chunli") which pollute co-tag /
  // co-character lists ("Genshin Impact pairs with Genshin"). Drop any entry
  // that is a word-part or the concatenation of the entity's own slug.
  const parts = new Set(
    slug
      .toLowerCase()
      .split(/[_\-\s]+/)
      .filter(Boolean),
  );
  parts.add(slug.toLowerCase().replace(/[_\-\s]+/g, ""));
  const isFragment = (name) =>
    parts.has(name) || parts.has(name.replace(/[_\-\s]+/g, ""));

  return {
    total,
    threeD,
    twoD: Math.max(0, total - threeD),
    avgScore: r.avg_score || 0,
    maxScore: r.max_score || 0,
    recent: r.recent || 0,
    sources: (r.sources || []).filter((s) => s.source),
    artists: (r.artists || []).map((a) => ({ ...a, label: titleCase(a.name) })),
    cotags: (r.cotags || [])
      .filter((t) => !NOISE_TAGS.has(t.name) && !isFragment(t.name))
      .slice(0, 8),
    chars: (r.chars || [])
      .filter((c) => c.name && !isFragment(c.name))
      .map((c) => ({ ...c, label: titleCase(c.name) })),
    copyrights: (r.copyrights || [])
      .filter((c) => c.name && !isFragment(c.name))
      .map((c) => ({ ...c, label: titleCase(c.name) })),
  };
}

// ─────────────────────────────────────────────────────────────────
// Sentence builders — each interpolates REAL numbers. Variation is by
// slug hash so the same entity is stable but neighbours never match.

function splitPhrase(s) {
  if (s.total === 0) return "";
  if (s.threeD > 0 && s.twoD > 0)
    return `${n(s.threeD)} in 3D and ${n(s.twoD)} in 2D`;
  if (s.threeD > 0) return `all 3D / SFM-style renders`;
  return `mostly 2D hand-drawn animation`;
}
function buildIntro(slug, name, type, s, series) {
  if (s.total === 0) return "";
  const split = splitPhrase(s);
  const artistList = andList(
    s.artists.map((a) => a.label),
    3,
  );
  const cotagList = andList(
    s.cotags.map((t) => titleCase(t.name)),
    3,
  );
  const charList = andList(
    s.chars.map((c) => c.label),
    3,
  );
  const noun =
    type === "tag" ? "tag" : type === "character" ? "character" : "franchise";

  // ── Paragraph 1 — the data snapshot (the unique, un-fakeable core) ──
  const hooks = [
    `iku.gg currently indexes ${n(s.total)} ${name} hentai videos${split ? ` — ${split}` : ""}, refreshed daily.`,
    `There are ${n(s.total)} animated ${name} clips catalogued on iku.gg right now${s.recent ? `, ${n(s.recent)} of them added in the last 30 days` : ""}${split ? ` (${split})` : ""}.`,
    `The ${name} ${noun} on iku.gg holds ${n(s.total)} videos${s.maxScore ? `, with the top-rated piece scoring ${n(s.maxScore)} from the community` : ""}.`,
    `${n(s.total)} ${name} hentai animations are live on iku.gg${split ? `, ${split}` : ""} — one of the deeper ${name} libraries you'll find anywhere.`,
  ];
  // ── Paragraph 2 — creators / co-tags / cast (real attribution) ──
  const bodies = [];
  if (artistList && cotagList) {
    bodies.push(
      `The most prolific creators here are ${artistList}. ${name} most often pairs with ${cotagList} — those tags are the fastest way to narrow the catalogue down to a specific scene.`,
    );
  } else if (cotagList) {
    bodies.push(
      `${name} clips most often pair with ${cotagList} — combine this page with those tags to narrow down a specific scene.`,
    );
  }
  if (type === "character" && series) {
    bodies.push(
      `${name} comes from ${series}${charList ? `, and frequently appears alongside ${charList}` : ""}. Sort by score for the community top picks, by date for the newest uploads.`,
    );
  } else if (type === "series" && charList) {
    bodies.push(
      `The most-animated characters in the ${name} catalogue are ${charList}. Each one has a dedicated page, so you can drill straight into a single cast member.`,
    );
  } else if (type === "tag" && s.avgScore) {
    bodies.push(
      `Average community score across the ${name} catalogue sits around ${n(s.avgScore)}. The score sort surfaces the highest-rated ${name} pieces first; the date sort surfaces the newest.`,
    );
  }
  // ── Paragraph 3 — light, factual CTA (no slop filler) ──
  const ctas = [
    `Everything on this page streams free, no account needed. The catalogue updates every 24 hours as the indexer finds new ${name} uploads.`,
    `All ${n(s.total)} clips stream free — sort, filter, and the URL stays bookmarkable. New ${name} content lands daily.`,
    `Browse the full list below. Sorting and filters update the URL so any ${name} view you build is shareable.`,
  ];

  const paras = [
    pick(slug + ":h", hooks),
    bodies.length ? pick(slug + ":b", bodies) : "",
    pick(slug + ":c", ctas),
  ].filter(Boolean);
  return paras.join("\n\n");
}

function buildFaq(slug, name, type, s) {
  if (s.total === 0) return [];
  const out = [];
  const split = splitPhrase(s);
  const artistList = andList(
    s.artists.map((a) => a.label),
    3,
  );

  out.push({
    q: `How many ${name} hentai videos are on iku.gg?`,
    a: `${n(s.total)} right now${split ? ` — ${split}` : ""}.${s.recent ? ` ${n(s.recent)} were added in the last 30 days, and the catalogue updates every 24 hours.` : " The catalogue updates every 24 hours."}`,
  });

  if (s.threeD > 0 && s.twoD > 0) {
    const pct = Math.round((s.threeD / s.total) * 100);
    out.push({
      q: `Is ${name} hentai mostly 3D or 2D?`,
      a: `It's a mix — about ${pct}% of the ${n(s.total)} ${name} clips on iku.gg are 3D / SFM renders (${n(s.threeD)} videos) and the rest are 2D animation (${n(s.twoD)} videos). Use the score sort to see the best of either style.`,
    });
  }

  if (artistList) {
    out.push({
      q: `Who are the top ${name} hentai creators?`,
      a: `By volume on iku.gg, the most prolific are ${artistList}. Each creator's other work is one click away from any of their clips on this page.`,
    });
  }

  if (s.maxScore) {
    out.push({
      q: `What's the best-rated ${name} hentai video?`,
      a: `The top ${name} clip on iku.gg holds a community score of ${n(s.maxScore)}${s.avgScore ? `, well above the ${name} average of ~${n(s.avgScore)}` : ""}. Sort this page by score to watch the highest-rated pieces first.`,
    });
  }

  out.push({
    q: `Is ${name} hentai free to watch on iku.gg?`,
    a: `Yes — all ${n(s.total)} ${name} videos stream free with no account. Premium (4.99 €/mo) removes ads and unlocks long-form episodes, but the ${name} catalogue itself is free.`,
  });

  // 3-4 deterministic by hash, dedup
  const startIdx = hashIdx(slug + ":faq", out.length);
  const ordered = [...out.slice(startIdx), ...out.slice(0, startIdx)];
  return ordered.slice(0, 4);
}

function buildMeta(s) {
  return {
    total: s.total,
    threeD: s.threeD,
    twoD: s.twoD,
    avgScore: s.avgScore,
    maxScore: s.maxScore,
    recent30d: s.recent,
    sources: s.sources,
    topArtists: s.artists.slice(0, 5),
    topCoTags: s.cotags.slice(0, 8),
    topCharacters: s.chars.slice(0, 6),
    topCopyrights: s.copyrights.slice(0, 4),
  };
}

// ─────────────────────────────────────────────────────────────────

async function enrichType(pool, type) {
  const col =
    type === "tag"
      ? "tags"
      : type === "character"
        ? "characters"
        : "copyrights";
  const minVideos = MIN_VIDEOS[type];

  const { rows } = await pool.query(
    `WITH base AS (SELECT lower(unnest(${col})) AS slug FROM videos WHERE dead_at IS NULL AND thumbnail <> '')
     SELECT slug, COUNT(*)::int AS video_count
     FROM base WHERE slug <> ''
     GROUP BY slug HAVING COUNT(*) >= $1
     ORDER BY video_count DESC LIMIT $2`,
    [minVideos, MAX_PER_TYPE],
  );
  console.log(`  ${type}: ${rows.length} candidates (>=${minVideos} videos)`);

  let todo = rows;
  if (!FORCE) {
    const slugs = rows.map((r) => r.slug);
    const fresh = new Set();
    if (slugs.length) {
      const { rows: existing } = await pool.query(
        `SELECT slug FROM entity_seo
         WHERE entity_type = $1 AND slug = ANY($2::text[])
           AND generated_at > NOW() - INTERVAL '${STALE_DAYS} days'`,
        [type, slugs],
      );
      for (const r of existing) fresh.add(r.slug);
    }
    todo = rows.filter((r) => !fresh.has(r.slug));
    console.log(
      `  ${type}: ${todo.length} need refresh, ${rows.length - todo.length} fresh`,
    );
  }

  if (DRY_RUN) {
    for (const r of todo.slice(0, 3)) {
      const name = titleCase(r.slug);
      const s = await entityStats(pool, type, r.slug);
      let series = null;
      if (type === "character" && s.copyrights[0])
        series = s.copyrights[0].label;
      console.log(`\n  ── ${type}=${r.slug} (${s.total} videos) ──`);
      console.log(buildIntro(r.slug, name, type, s, series));
      console.log(
        "  FAQ:",
        JSON.stringify(buildFaq(r.slug, name, type, s), null, 1).slice(0, 600),
      );
    }
    return 0;
  }

  let written = 0;
  let skipped = 0;
  for (const r of todo) {
    // Per-entity try/catch: one slow aggregate (mega-tags like "1girl" with
    // 100K+ videos can exceed statement_timeout) must NOT kill the whole run.
    // Skip + log, keep going. (v1 lacked this — crashed at 1959/16K.)
    try {
      const name = titleCase(r.slug);
      const s = await entityStats(pool, type, r.slug);
      if (s.total === 0) continue;
      let series = null;
      if (type === "character" && s.copyrights[0])
        series = s.copyrights[0].label;
      const intro = buildIntro(r.slug, name, type, s, series);
      const faq = buildFaq(r.slug, name, type, s);
      const meta = buildMeta(s);

      await pool.query(
        `INSERT INTO entity_seo (entity_type, slug, display_name, video_count, intro, faq, meta, generated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NOW())
         ON CONFLICT (entity_type, slug) DO UPDATE
         SET display_name=EXCLUDED.display_name, video_count=EXCLUDED.video_count,
             intro=EXCLUDED.intro, faq=EXCLUDED.faq, meta=EXCLUDED.meta, generated_at=NOW()`,
        [
          type,
          r.slug,
          name,
          s.total,
          intro,
          JSON.stringify(faq),
          JSON.stringify(meta),
        ],
      );
      written++;
      if (written % 500 === 0)
        console.log(`    ${type}: ${written}/${todo.length}`);
    } catch (err) {
      skipped++;
      console.log(`    ${type}: SKIP ${r.slug} (${err.message.slice(0, 80)})`);
    }
  }
  console.log(`  ${type}: done — ${written} written, ${skipped} skipped`);
  return written;
}

async function main() {
  // statement_timeout 30s (DB default is 10s, too low for mega-tag aggregates)
  // + max 3 connections to stay gentle on the live DB during the batch.
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 3,
    statement_timeout: 30000,
  });
  let total = 0;
  try {
    const types = ENTITY === "all" ? ["tag", "character", "series"] : [ENTITY];
    for (const t of types) total += await enrichType(pool, t);
  } finally {
    await pool.end();
  }
  console.log(`\nDone. ${total} entity_seo rows written.`);
}

main().catch((err) => {
  console.error("enrich-entity-seo failed:", err);
  process.exit(1);
});
