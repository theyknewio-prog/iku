#!/usr/bin/env node
/**
 * warmup-cron.mjs — keeps the Next.js memoize cache hot for hot taxonomy pages.
 *
 * Problem: getVideos() is memoized 30 min. A persona sim on 2026-04-17 showed
 * /hentai, /3d, /tag/animated, /series/naruto taking 13-18s on cold hit because
 * warmup.sh runs once at deploy and only 7 pages. Low-QPS taxonomy pages drop
 * out of cache between organic visits → Googlebot + long-tail users hit a 15s
 * TTFB → ~95% bounce, massive lost ad impressions + Pro conversions.
 *
 * Solution: every 4 min, hit the top N taxonomy pages on localhost so memoize
 * stays warm. Runs on the VPS directly — no external HTTP, no CF cost.
 *
 * Hardcoded top lists (they barely move week-to-week; refresh quarterly).
 */

const BASE = process.env.WARMUP_BASE || "http://localhost:3000";
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 3;

const HUBS = [
  "/",
  "/trending",
  "/new",
  "/explore",
  "/hentai",
  "/3d",
  "/feed",
  "/episodes",
  "/tags",
  "/character",
  "/series",
];

// Top 30 tags by volume (Apr 2026 snapshot from PG video_count).
const TOP_TAGS = [
  "animated",
  "sound",
  "1girl",
  "solo",
  "large_breasts",
  "breasts",
  "nude",
  "female",
  "pov",
  "vaginal",
  "big_breasts",
  "penis",
  "long_hair",
  "ass",
  "cum",
  "sex",
  "cowgirl",
  "creampie",
  "hentai",
  "nipples",
  "blowjob",
  "anal",
  "masturbation",
  "missionary",
  "paizuri",
  "fellatio",
  "2girls",
  "tongue",
  "oral",
  "doggystyle",
];

// Top 10 characters and series by traffic.
const TOP_CHARACTERS = [
  "marie-rose",
  "tifa-lockhart",
  "boa-hancock",
  "nico-robin",
  "hinata-hyuga",
  "bulma",
  "android-18",
  "samus-aran",
  "lara-croft",
  "power",
];

const TOP_SERIES = [
  "one-piece",
  "naruto",
  "dragon-ball",
  "overwatch",
  "final-fantasy",
  "genshin-impact",
  "dead-or-alive",
  "fate",
  "my-hero-academia",
  "demon-slayer",
];

async function hit(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(BASE + path, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "iku-warmup-cron/1.0",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    await res.arrayBuffer();
    const ms = Date.now() - start;
    return { path, ok: res.status < 500, code: res.status, ms };
  } catch (err) {
    return {
      path,
      ok: false,
      code: 0,
      ms: Date.now() - start,
      err: err.message,
    };
  } finally {
    clearTimeout(t);
  }
}

async function run() {
  const startedAt = Date.now();
  const paths = [
    ...HUBS,
    ...TOP_TAGS.map((t) => `/tag/${t}`),
    ...TOP_CHARACTERS.map((c) => `/character/${c}`),
    ...TOP_SERIES.map((s) => `/series/${s}`),
  ];

  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < paths.length) {
      const mine = idx++;
      const r = await hit(paths[mine]);
      results.push(r);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const slow = results.filter((r) => r.ms > 3000);
  const failed = results.filter((r) => !r.ok);
  const avg = results.length
    ? Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length)
    : 0;

  const ts = new Date().toISOString();
  console.log(
    `[${ts}] warmup: ${results.length} pages, avg ${avg}ms, slow(>3s)=${slow.length}, failed=${failed.length} (run ${Date.now() - startedAt}ms)`,
  );
  if (slow.length) {
    for (const r of slow.slice(0, 10)) {
      console.log(`  SLOW ${r.ms}ms ${r.code} ${r.path}`);
    }
  }
  if (failed.length) {
    for (const r of failed.slice(0, 10)) {
      console.log(`  FAIL ${r.code} ${r.path} ${r.err || ""}`);
    }
  }
}

run().catch((e) => {
  console.error("[warmup-cron] fatal:", e);
  process.exit(1);
});
