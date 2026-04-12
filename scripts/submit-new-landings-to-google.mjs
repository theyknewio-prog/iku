#!/usr/bin/env node
/**
 * submit-new-landings-to-google.mjs — Push all new high-priority landings
 * to Google's Indexing API in a single batch. Run once after the
 * 2026-04-12 reposition.
 *
 * URLs submitted:
 *   1. / + vertical hubs (/hentai, /3d, /feed) — 4 URLs
 *   2. 10 new head-keyword blog articles — 10 URLs
 *   3. Top 10 characters from Semrush (Chun-Li, Tifa, Ada Wong, etc) — 10 URLs
 *   4. Top 10 franchises (Genshin, Overwatch, Blue Archive, etc) — 10 URLs
 *
 * Total: 34 URLs. Google's daily Indexing API quota is 200/day so we're
 * using 17% of the budget.
 *
 * Usage (run on Hetzner where gsc-service-account.json lives):
 *   node scripts/submit-new-landings-to-google.mjs
 *   node scripts/submit-new-landings-to-google.mjs --dry-run
 */

import { google } from "googleapis";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const KEY_PATH = resolve(ROOT, "gsc-service-account.json");
const DRY = process.argv.includes("--dry-run");

const VERTICALS = [
  "https://iku.gg/",
  "https://iku.gg/hentai",
  "https://iku.gg/3d",
  "https://iku.gg/feed",
];

const BLOG_ARTICLES = [
  "https://iku.gg/blog/3d-hentai-guide-2026",
  "https://iku.gg/blog/cartoon-porn-top-animations",
  "https://iku.gg/blog/3d-porn-animation-best-sfm",
  "https://iku.gg/blog/what-is-animation-porn-explained",
  "https://iku.gg/blog/genshin-impact-porn-complete-guide",
  "https://iku.gg/blog/overwatch-porn-best-3d-animations",
  "https://iku.gg/blog/hmv-hentai-music-video-explained",
  "https://iku.gg/blog/hentai-compilation-best-multi-scene-videos",
  "https://iku.gg/blog/3d-futa-hentai-complete-guide",
  "https://iku.gg/blog/porn-animations-how-genre-evolved",
];

// Top characters by catalog volume (from DB 2026-04-12). Slug format matches
// our /character/[slug] routes (Danbooru-style underscore names).
const TOP_CHARACTERS = [
  "chun-li",
  "ada_wong",
  "tifa_lockhart",
  "lara_croft",
  "harley_quinn",
  "marie_rose",
  "jill_valentine",
  "black_widow",
  "raiden_shogun",
  "2b_(nier:automata)",
].map((s) => `https://iku.gg/character/${encodeURIComponent(s)}`);

// Top franchises by catalog volume (Semrush high-volume matches)
const TOP_SERIES = [
  "genshin_impact",
  "blue_archive",
  "overwatch",
  "zenless_zone_zero",
  "final_fantasy",
  "honkai:_star_rail",
  "fortnite",
  "resident_evil",
  "dead_or_alive",
  "nier:automata",
].map((s) => `https://iku.gg/series/${encodeURIComponent(s)}`);

const URLS = [...VERTICALS, ...BLOG_ARTICLES, ...TOP_CHARACTERS, ...TOP_SERIES];

async function main() {
  console.log(`── submit-new-landings ${DRY ? "(DRY RUN)" : ""} ──`);
  console.log(`Submitting ${URLS.length} URLs:`);
  URLS.forEach((u, i) => console.log(`  ${String(i + 1).padStart(2)}. ${u}`));

  if (DRY) {
    console.log("\n(dry run — no submissions)");
    return;
  }

  // Auth with GSC service account
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/indexing"],
  });
  const authClient = await auth.getClient();

  const indexing = google.indexing({ version: "v3", auth: authClient });

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (const url of URLS) {
    try {
      const res = await indexing.urlNotifications.publish({
        requestBody: { url, type: "URL_UPDATED" },
      });
      const latest = res.data?.urlNotificationMetadata?.latestUpdate?.notifyTime;
      console.log(`  ✓ ${url}${latest ? ` (${latest})` : ""}`);
      ok++;
    } catch (err) {
      const msg = err?.errors?.[0]?.message || err?.message || String(err);
      console.warn(`  ✗ ${url} — ${msg}`);
      failures.push({ url, error: msg });
      fail++;
    }
    // Light throttle — 10 req/sec max per Google
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`\n── Done — ${ok} ok, ${fail} fail ──`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  ${f.url}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
