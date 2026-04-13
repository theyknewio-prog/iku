#!/usr/bin/env node
/**
 * indexnow.mjs — Push URLs to Bing/Yandex/Seznam via the IndexNow protocol.
 *
 * IndexNow = open standard backed by Bing + Yandex + Seznam. A single POST
 * to api.indexnow.org notifies all participating engines instantly. No
 * quota, no auth, no signup. Free fast indexing for ~10-15% of global
 * search share (Bing ~9% + Yandex ~3% + Seznam Czech).
 *
 * Protocol:
 *   1. We host /<KEY>.txt at the site root containing just the key string
 *      (proves we control the host).
 *   2. POST JSON { host, key, keyLocation, urlList[] } — up to 10000 URLs
 *      per request.
 *
 * Priority queue:
 *   - Top N video pages by score (most popular = most worth indexing)
 *   - All character + series + tag landing pages that have results
 *   - Fresh blog articles
 *   - Skip URLs submitted in last 7 days (per data/submitted-indexnow.json)
 *
 * Usage:
 *   node scripts/indexnow.mjs              # full run (up to 10k URLs)
 *   node scripts/indexnow.mjs --dry-run    # preview, no POST
 *   MAX_URLS=500 node scripts/indexnow.mjs # cap
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SUBMITTED_PATH = resolve(ROOT, "data/submitted-indexnow.json");

const HOST = "iku.gg";
const KEY = "4465091d2a8821cbd442f8001bf46725";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const MAX_URLS = Number(process.env.MAX_URLS || 10000);
const RESUBMIT_DAYS = 7;
const DRY_RUN = process.argv.includes("--dry-run");

const log = (msg) => console.log(`  ${msg}`);

// ── Submitted tracking ─────────────────────────────────────────────────
function loadSubmitted() {
  if (!existsSync(SUBMITTED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SUBMITTED_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveSubmitted(map) {
  if (!existsSync(dirname(SUBMITTED_PATH))) {
    mkdirSync(dirname(SUBMITTED_PATH), { recursive: true });
  }
  writeFileSync(SUBMITTED_PATH, JSON.stringify(map, null, 2));
}

function isFresh(map, url) {
  const ts = map[url];
  if (!ts) return false;
  return Date.now() - ts < RESUBMIT_DAYS * 86400_000;
}

// ── Build URL list from PG ─────────────────────────────────────────────
async function buildUrlList(submitted) {
  const url =
    process.env.DATABASE_URL ||
    "postgresql://iku:iku_pg_2026_strong_pwd_x9k@localhost:15432/iku";
  const pool = new pg.Pool({ connectionString: url, max: 4 });

  const urls = [];

  try {
    // 1. Top video pages by score (the ones most likely to convert in SERPs).
    const { rows: videos } = await pool.query(
      `SELECT slug FROM videos
       WHERE thumbnail IS NOT NULL AND thumbnail <> ''
       ORDER BY score DESC NULLS LAST
       LIMIT 5000`
    );
    for (const r of videos) urls.push(`https://${HOST}/watch/${r.slug}`);

    // 2. All character pages with at least one video.
    const { rows: chars } = await pool.query(
      `SELECT ch AS name, COUNT(*)::int AS c
       FROM (SELECT unnest(characters) AS ch FROM videos) t
       WHERE ch <> ''
       GROUP BY ch
       HAVING COUNT(*) > 5
       ORDER BY c DESC
       LIMIT 1500`
    );
    for (const r of chars) {
      urls.push(`https://${HOST}/character/${encodeURIComponent(r.name)}`);
    }

    // 3. All tag pages with > 20 videos.
    const { rows: tags } = await pool.query(
      `SELECT t AS name, COUNT(*)::int AS c
       FROM (SELECT unnest(tags) AS t FROM videos) x
       WHERE t <> ''
       GROUP BY t
       HAVING COUNT(*) > 20
       ORDER BY c DESC
       LIMIT 1500`
    );
    for (const r of tags) {
      urls.push(`https://${HOST}/tag/${encodeURIComponent(r.name)}`);
    }

    // 4. Series pages.
    const { rows: series } = await pool.query(
      `SELECT co AS name, COUNT(*)::int AS c
       FROM (SELECT unnest(copyrights) AS co FROM videos) x
       WHERE co <> ''
       GROUP BY co
       HAVING COUNT(*) > 10
       ORDER BY c DESC
       LIMIT 1000`
    );
    for (const r of series) {
      urls.push(`https://${HOST}/series/${encodeURIComponent(r.name)}`);
    }

    // 5. Static high-value landings.
    urls.push(
      `https://${HOST}/`,
      `https://${HOST}/hentai`,
      `https://${HOST}/3d`,
      `https://${HOST}/trending`,
      `https://${HOST}/new`,
      `https://${HOST}/feed`,
      `https://${HOST}/explore`,
      `https://${HOST}/character`,
      `https://${HOST}/series`,
      `https://${HOST}/tags`,
      `https://${HOST}/blog`,
      `https://${HOST}/glossary`,
      `https://${HOST}/pricing`
    );
  } finally {
    await pool.end();
  }

  // Dedupe + filter already-fresh.
  const seen = new Set();
  const fresh = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    if (isFresh(submitted, u)) continue;
    fresh.push(u);
    if (fresh.length >= MAX_URLS) break;
  }
  return fresh;
}

// ── POST to IndexNow ───────────────────────────────────────────────────
function postBatch(urlList) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    });
    const req = https.request(
      {
        method: "POST",
        hostname: "api.indexnow.org",
        path: "/indexnow",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "iku.gg-indexnow/1.0",
        },
        timeout: 15_000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(body);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const submitted = loadSubmitted();
  log(`Loaded ${Object.keys(submitted).length} previously submitted URLs.`);

  const urls = await buildUrlList(submitted);
  log(`Built ${urls.length} fresh URLs to submit (cap ${MAX_URLS}).`);

  if (urls.length === 0) {
    log("Nothing fresh to submit — all already done in the last 7 days.");
    return;
  }

  if (DRY_RUN) {
    log("DRY RUN — first 5 URLs:");
    urls.slice(0, 5).forEach((u) => console.log(`    ${u}`));
    return;
  }

  // IndexNow accepts up to 10000 URLs per POST. Batch in chunks of 1000
  // to keep payloads small and individual failures recoverable.
  const BATCH = 1000;
  let okCount = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const slice = urls.slice(i, i + BATCH);
    try {
      const res = await postBatch(slice);
      // 200 = received, 202 = accepted, 422 = some URLs not allowed (still ok),
      // 429 = too many requests. Anything 2xx/422 we count as success.
      if (res.status === 200 || res.status === 202 || res.status === 422) {
        okCount += slice.length;
        const now = Date.now();
        for (const u of slice) submitted[u] = now;
        log(`Batch ${i / BATCH + 1}: ${slice.length} URLs → HTTP ${res.status}`);
      } else {
        log(
          `Batch ${i / BATCH + 1}: ${slice.length} URLs → HTTP ${res.status} ` +
            `${res.body.slice(0, 120)}`
        );
      }
    } catch (err) {
      log(`Batch ${i / BATCH + 1}: error ${err.message}`);
    }
    // Polite spacing between batches.
    await new Promise((r) => setTimeout(r, 800));
  }

  saveSubmitted(submitted);
  log(`Done. ${okCount}/${urls.length} URLs submitted.`);
}

main().catch((err) => {
  console.error("indexnow failed:", err);
  process.exit(1);
});
