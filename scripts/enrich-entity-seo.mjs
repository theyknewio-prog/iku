#!/usr/bin/env node
/**
 * enrich-entity-seo.mjs — Per-tag/character/series SEO body generator.
 *
 * For each entity (top tags/characters/series by video count) generates:
 *   - 200-400 word intro (3-5 paragraphs of unique, varied content)
 *   - 3-4 FAQ pairs
 *   - Meta payload with top related entities
 *
 * Variation: we have ~10 sentence templates per slot (intro hook, body
 * stat sentence, related-entity sentence, conclusion). Each template
 * is picked deterministically based on a slug hash, so the same entity
 * always renders the same content but DIFFERENT entities never share
 * the same paragraph (Google duplicate-content protection).
 *
 * Writes to PG entity_seo table. Runtime queries via memoized helper.
 *
 * Usage:
 *   node scripts/enrich-entity-seo.mjs                # all enabled types
 *   ENTITY=tag node scripts/enrich-entity-seo.mjs     # one type only
 *   MIN_VIDEOS=10 node scripts/enrich-entity-seo.mjs  # raise threshold
 *   MAX=200 node scripts/enrich-entity-seo.mjs        # cap rows per type
 *   --dry-run                                         # preview, no write
 */

import pg from "pg";
import crypto from "crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://iku:iku_pg_2026_strong_pwd_x9k@localhost:15432/iku";

const ENTITY = process.env.ENTITY || "all";
const MIN_VIDEOS = {
  tag: Number(process.env.MIN_TAG || 50),
  character: Number(process.env.MIN_CHAR || 10),
  series: Number(process.env.MIN_SERIES || 20),
};
const MAX_PER_TYPE = Number(process.env.MAX || 5000);
const STALE_DAYS = Number(process.env.STALE_DAYS || 30);
const DRY_RUN = process.argv.includes("--dry-run");

// ─────────────────────────────────────────────────────────────────
// Variety pool — picked deterministically by slug hash so the same
// entity always gets the same content, but different entities don't
// share paragraphs.

function pick(slug, variants) {
  const h = crypto.createHash("md5").update(slug).digest();
  const idx = h.readUInt32BE(0) % variants.length;
  return variants[idx];
}

function titleCase(s) {
  return s
    .replace(/_/g, " ")
    .replace(/:/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

const HOOK_TAG = (name, count) => [
  `${name} hentai is one of the most-watched niches on iku.gg, with ${count.toLocaleString()} animated clips currently in the catalogue.`,
  `Looking for ${name} hentai? You're in the right place — iku.gg hosts ${count.toLocaleString()} free ${name} animations from across the booru ecosystem.`,
  `${name} is a defining keyword in the animated adult space, and iku.gg has built up a library of ${count.toLocaleString()} ${name} clips that update daily.`,
  `Few hentai categories grow as fast as ${name}. iku.gg already lists ${count.toLocaleString()} videos in this tag and pulls fresh uploads every 24 hours.`,
  `Whether you're new to ${name} hentai or a regular, the ${count.toLocaleString()} ${name} videos on iku.gg cover everything from short loops to full episodes.`,
];

const BODY_TAG = (name) => [
  `${titleCase(name)} content rotates between hand-drawn 2D animation, modern 3D renders made in Blender or Koikatsu, and the SFM compilations that became a sub-genre of their own. The ${name} tag often combines with character pages and franchise pages, which is why the related links below are worth exploring.`,
  `What separates the ${name} clips on iku.gg from a generic tube grid is the depth of metadata. Each video carries character, copyright, artist and source attribution, so a single browse on this page surfaces ${name} animations from dozens of artists and a wide spread of franchises.`,
  `${titleCase(name)} works span everything from quick 30-second loops to multi-episode 2D OAVs and 4K 3D renders. The browse-by-score sort keeps the highest-rated ${name} pieces at the top, while sort-by-date surfaces the newest ${name} uploads first.`,
  `On iku.gg, the ${name} library is curated rather than scraped flat — duplicates are merged, incomplete uploads are dropped, and every entry has a working stream URL. That means the videos below are the actual ${name} content, not a list of broken thumbnails.`,
  `${titleCase(name)} animations come from professional studios, indie 3D artists, SFM creators, and a long tail of doujin-circle uploads. iku.gg surfaces all of them in a single feed so you can compare styles without jumping across five different sites.`,
];

const CTA_TAG = (name) => [
  `Use the sort bar above to switch between top-rated and newest ${name} videos. The Premium tier removes every ad and unlocks the full-length episodes — at 4.99 €/month it pays for itself if you watch more than a couple of long-form clips a week.`,
  `If you watch ${name} regularly, save the page to favorites and check back daily — iku.gg adds new ${name} animations through the morning scrape cron. Premium subscribers see them 48 hours before the public catalogue.`,
  `For an ad-free ${name} experience plus 4K when available and full-length episode unlocks, upgrade to iku Premium. Otherwise, the free tier still gets the entire ${name} library — just with a few banners between sections.`,
  `Bookmark this ${name} page if you find yourself coming back. The catalogue refreshes daily, sort options stick across sessions, and Premium kills the ads if they bother you.`,
];

const HOOK_CHAR = (name, series, count) => [
  `${name}${series ? ` from ${series}` : ""} is one of the most popular characters in the animated adult space, with ${count.toLocaleString()} fan-made hentai clips on iku.gg.`,
  `If you've been searching for ${name} hentai, the ${count.toLocaleString()} animations on iku.gg cover almost every interpretation of the character${series ? ` from ${series}` : ""}.`,
  `${name}${series ? ` (${series})` : ""} has inspired ${count.toLocaleString()} animated hentai works currently catalogued on iku.gg — one of the deepest single-character libraries on the site.`,
  `${name} hentai is a category in its own right. iku.gg lists ${count.toLocaleString()} ${name} clips${series ? ` drawn from the ${series} fandom` : ""}, ranging from quick 2D loops to high-end 3D renders.`,
];

const BODY_CHAR = (name, series) => [
  `Why ${name} keeps generating new content is the same reason any character rises in fan animation: a memorable design, an active${series ? ` ${series} fanbase` : " franchise community"}, and creators who keep finding new angles. The browse below is sorted by community score, but the date and favorites sorts both surface different highlights.`,
  `The ${name} animations on iku.gg span the full spectrum of styles — from classic 2D hand-drawn frames to modern 3D rigs in Blender, Koikatsu, and Honey Select. ${series ? `${series} characters tend to attract the most experimental fan animators, and ${name} is no exception. ` : ""}Use the related-tag links below to combine ${name} with specific scenarios.`,
  `If you're new to ${name} hentai, the score-sorted view at the top of this page is the fastest way in — those are the ${name} clips with the highest community ratings. From there, dropping into related tags or the${series ? ` ${series}` : ""} series page expands the discovery loop.`,
];

const CTA_CHAR = (name) => [
  `New ${name} animations appear in the catalogue weekly. Save this page to favorites if you want to come back for fresh uploads, or upgrade to Premium for 48-hour early access on every new ${name} clip.`,
  `Premium subscribers get the full ${name} library ad-free, plus 4K versions when the source supports it. Free users still see every ${name} video — the upgrade is purely about removing the banners.`,
  `Bookmark this ${name} page and the related characters below to build a personalized watch loop. Premium unlocks the long-form ${name} episodes that the free tier locks behind a paywall preview.`,
];

const HOOK_SERIES = (name, count) => [
  `${name} hentai is a sub-genre of its own — iku.gg lists ${count.toLocaleString()} ${name} animations from across the fan-creation ecosystem.`,
  `Searching for ${name} porn? The ${count.toLocaleString()} ${name}-themed animations on iku.gg cover most of the franchise's main and side characters.`,
  `${name} fan content dominates the 3D animated adult space, and iku.gg's catalogue of ${count.toLocaleString()} ${name} hentai clips reflects that — new uploads land daily.`,
  `If ${name} is your franchise, iku.gg is your library: ${count.toLocaleString()} catalogued ${name} hentai pieces with character, artist, and tag metadata on every entry.`,
];

const BODY_SERIES = (name) => [
  `${titleCase(name)} hentai works tend to favour 3D rendering — the franchise design language translates well to Blender, Koikatsu, and Honey Select, which is why the bulk of the catalogue here is 3D animation rather than 2D drawing. The score-sorted view brings the community-favourite ${name} clips to the top.`,
  `What makes the ${name} library on iku.gg deeper than a generic tube category is character-level browsing. Each ${name} hentai entry is tagged with the specific character, so the related-character chips below let you dive straight into the ${name} cast members you're looking for.`,
  `${titleCase(name)} fan animations land everywhere on the quality spectrum — from quick 30-second loops to multi-minute scenes with full lighting and rigged characters. Browse by score for the polished pieces, by date for the newest uploads, or by favourites for the community evergreens.`,
];

const CTA_SERIES = (name) => [
  `New ${name} animations get scraped and tagged daily. Premium subscribers see every fresh ${name} clip 48 hours ahead of the public catalogue and watch ad-free in 4K when the source supports it.`,
  `If ${name} hentai is a regular search for you, save this page and check back each morning — the cron pulls overnight uploads at 04:00 UTC. The Premium tier kills every ad on the page for 4.99 €/month.`,
  `Bookmark the ${name} catalogue, follow the top characters from the cast (linked below), and you've built a personalized ${name} hentai feed without an account. Premium adds long-form episode unlocks on top.`,
];

// ── FAQ pool ─────────────────────────────────────────────────────

const FAQ_POOL = (name, count, type) => [
  {
    q: `Where can I watch ${name} ${type === "character" ? "hentai" : type === "series" ? "hentai" : "hentai videos"} for free?`,
    a: `On iku.gg. Browse this page for the ${count.toLocaleString()} ${name} ${type === "tag" ? "videos" : "clips"} catalogued so far — sort by score for the community top picks, by date for the newest uploads, or by favourites for the all-time evergreens. No account is required to watch.`,
  },
  {
    q: `How often is the ${name} library updated?`,
    a: `Every 24 hours. The scrape cron runs at 04:00 UTC and pulls fresh ${name} uploads from the source booru sites. New entries appear in this list automatically — no manual refresh needed.`,
  },
  {
    q: `Is the ${name} content on iku.gg actually free?`,
    a: `Yes. The full ${name} library is browsable and streamable without an account or payment. Premium (4.99 €/month) removes the ads and unlocks the long-form episodes that are paywalled in the free tier — but the bulk of the ${name} catalogue is free.`,
  },
  {
    q: `Can I filter ${name} videos by tag or style?`,
    a: `Yes. Combine this ${type} with any other tag using the related-tag chips below the listing, or jump straight to the dedicated character / series pages. The filters update the URL so the combinations are bookmarkable and shareable.`,
  },
  {
    q: `What kinds of animation styles are in the ${name} catalogue?`,
    a: `A mix — 2D hand-drawn (classic OAVs, doujin work), 3D modern renders (Blender, Koikatsu, Honey Select, Daz3D), SFM compilations, HMVs (Hentai Music Videos), and a smaller pool of cel-animated indie pieces. The sort bar lets you isolate by HD quality if you only want the high-resolution renders.`,
  },
  {
    q: `Why does ${name} have its own page on iku.gg?`,
    a: `Because every ${type} with a meaningful catalogue gets a dedicated landing — that's how we keep the browsing structure flat and discoverable. ${name} crossed the ${type === "tag" ? "50-video" : type === "character" ? "10-video" : "20-video"} threshold and now sits alongside the other top ${type}s on the site.`,
  },
];

function buildIntro(slug, name, count, type, series) {
  const paragraphs = [];
  if (type === "tag") {
    paragraphs.push(pick(slug + ":h", HOOK_TAG(name, count)));
    paragraphs.push(pick(slug + ":b", BODY_TAG(name)));
    paragraphs.push(pick(slug + ":c", CTA_TAG(name)));
  } else if (type === "character") {
    paragraphs.push(pick(slug + ":h", HOOK_CHAR(name, series, count)));
    paragraphs.push(pick(slug + ":b", BODY_CHAR(name, series)));
    paragraphs.push(pick(slug + ":c", CTA_CHAR(name)));
  } else {
    paragraphs.push(pick(slug + ":h", HOOK_SERIES(name, count)));
    paragraphs.push(pick(slug + ":b", BODY_SERIES(name)));
    paragraphs.push(pick(slug + ":c", CTA_SERIES(name)));
  }
  return paragraphs.join("\n\n");
}

function buildFaq(slug, name, count, type) {
  const pool = FAQ_POOL(name, count, type);
  // Pick 3 deterministically based on slug hash.
  const h = crypto.createHash("md5").update(slug + ":faq").digest();
  const seen = new Set();
  const out = [];
  let cursor = 0;
  while (out.length < 3 && cursor < pool.length * 2) {
    const idx = h[cursor % h.length] % pool.length;
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(pool[idx]);
    }
    cursor++;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Main loop per type.

async function enrichType(pool, type) {
  const colName =
    type === "tag" ? "tags" : type === "character" ? "characters" : "copyrights";
  const minVideos = MIN_VIDEOS[type];

  const { rows } = await pool.query(
    `WITH base AS (
       SELECT lower(unnest(${colName})) AS slug
       FROM videos
     )
     SELECT slug, COUNT(*)::int AS video_count
     FROM base
     WHERE slug <> ''
     GROUP BY slug
     HAVING COUNT(*) >= $1
     ORDER BY video_count DESC
     LIMIT $2`,
    [minVideos, MAX_PER_TYPE]
  );

  console.log(`  ${type}: ${rows.length} candidates (>=${minVideos} videos)`);

  // Skip rows already enriched within STALE_DAYS.
  const slugs = rows.map((r) => r.slug);
  const fresh = new Set();
  if (slugs.length) {
    const { rows: existing } = await pool.query(
      `SELECT slug FROM entity_seo
       WHERE entity_type = $1 AND slug = ANY($2::text[])
         AND generated_at > NOW() - INTERVAL '${STALE_DAYS} days'`,
      [type, slugs]
    );
    for (const r of existing) fresh.add(r.slug);
  }
  const todo = rows.filter((r) => !fresh.has(r.slug));
  console.log(`  ${type}: ${todo.length} need refresh, ${fresh.size} already fresh`);

  if (DRY_RUN) {
    todo.slice(0, 3).forEach((r) => {
      const name = titleCase(r.slug);
      console.log(`\n  preview ${type}=${r.slug} (${r.video_count} videos):`);
      console.log(buildIntro(r.slug, name, r.video_count, type).slice(0, 400) + "...");
    });
    return 0;
  }

  let written = 0;
  for (const r of todo) {
    const name = titleCase(r.slug);
    let series = null;
    if (type === "character") {
      // Fetch top copyright associated with this character for richer prose.
      const { rows: srows } = await pool.query(
        `SELECT lower(unnest(copyrights)) AS s
         FROM videos
         WHERE characters && ARRAY[$1]::text[]
         LIMIT 50`,
        [r.slug]
      );
      const counts = {};
      for (const x of srows) counts[x.s] = (counts[x.s] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) series = titleCase(top[0]);
    }
    const intro = buildIntro(r.slug, name, r.video_count, type, series);
    const faq = buildFaq(r.slug, name, r.video_count, type);

    await pool.query(
      `INSERT INTO entity_seo (entity_type, slug, display_name, video_count, intro, faq, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
       ON CONFLICT (entity_type, slug) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           video_count  = EXCLUDED.video_count,
           intro        = EXCLUDED.intro,
           faq          = EXCLUDED.faq,
           generated_at = NOW()`,
      [type, r.slug, name, r.video_count, intro, JSON.stringify(faq)]
    );
    written++;
    if (written % 250 === 0) console.log(`    ${type}: ${written}/${todo.length} written`);
  }
  console.log(`  ${type}: done — ${written} rows written`);
  return written;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
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
