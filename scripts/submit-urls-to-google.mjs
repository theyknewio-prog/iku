#!/usr/bin/env node
/**
 * submit-urls-to-google.mjs — Submit URLs to Google for indexing
 *
 * Uses the Google Indexing API (indexing.googleapis.com) to request
 * indexing of priority URLs. Falls back to URL Inspection API if
 * Indexing API is not available.
 *
 * Rate limit: 10 URLs per run (Google's daily quota is 200 for Indexing API).
 *
 * Priority order:
 *   1. New blog articles published in the last 48h
 *   2. Top character pages by search volume
 *   3. Top series pages
 *   4. Random sample of /watch/ pages
 *
 * Tracks submitted URLs in data/submitted-urls.json to avoid
 * re-submitting within 7 days.
 *
 * Usage:
 *   node scripts/submit-urls-to-google.mjs
 *   node scripts/submit-urls-to-google.mjs --dry-run
 *
 * Requires: gsc-service-account.json at project root
 */

import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const KEY_PATH = resolve(ROOT, "gsc-service-account.json");
const SUBMITTED_PATH = resolve(ROOT, "data/submitted-urls.json");
const SITE_URL = "https://iku.gg";
const MAX_URLS_PER_RUN = 10;
const RESUBMIT_DAYS = 7;

const DRY_RUN = process.argv.includes("--dry-run");
const log = (msg) => console.log(`  ${msg}`);

// ── Top characters by search volume (for priority submission) ──
const TOP_CHARACTERS = [
  { slug: "hinata-hyuga", volume: 14800 },
  { slug: "tsunade", volume: 14800 },
  { slug: "nami", volume: 14800 },
  { slug: "tatsumaki", volume: 14800 },
  { slug: "bulma", volume: 14800 },
  { slug: "boa-hancock", volume: 12100 },
  { slug: "starfire", volume: 12100 },
  { slug: "raven", volume: 12100 },
  { slug: "zelda", volume: 12100 },
  { slug: "android-18", volume: 8100 },
  { slug: "2b", volume: 5400 },
  { slug: "mikasa-ackerman", volume: 5400 },
  { slug: "nico-robin", volume: 5400 },
  { slug: "makima", volume: 4400 },
  { slug: "yor-forger", volume: 4400 },
  { slug: "tifa-lockhart", volume: 4400 },
  { slug: "sakura-haruno", volume: 4400 },
  { slug: "ochako-uraraka", volume: 4400 },
  { slug: "megumin", volume: 4400 },
  { slug: "aqua", volume: 4400 },
];

const TOP_SERIES = [
  "naruto", "one-piece", "dragon-ball", "my-hero-academia",
  "fairy-tail", "genshin-impact", "overwatch", "fate",
  "demon-slayer", "jujutsu-kaisen",
];

// ── Auth ──────────────────────────────────────────────────────
function getAuth(scopes) {
  if (!existsSync(KEY_PATH)) {
    throw new Error("gsc-service-account.json not found");
  }
  const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  return new google.auth.GoogleAuth({ credentials: key, scopes });
}

// ── Submitted URLs tracker ────────────────────────────────────
function loadSubmitted() {
  if (!existsSync(SUBMITTED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SUBMITTED_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveSubmitted(submitted) {
  const dir = dirname(SUBMITTED_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SUBMITTED_PATH, JSON.stringify(submitted, null, 2));
}

function isRecentlySubmitted(url, submitted) {
  const entry = submitted[url];
  if (!entry) return false;
  const daysSince = (Date.now() - new Date(entry.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < RESUBMIT_DAYS;
}

// ── Collect priority URLs ─────────────────────────────────────
function collectPriorityUrls(submitted) {
  const urls = [];

  // 1. New blog articles (last 48h)
  for (const file of ["blog.ts", "blog-new.ts", "blog-seo-push.ts"]) {
    const path = resolve(ROOT, "src/data", file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    const slugMatches = [...content.matchAll(/slug:\s*"([^"]+)"/g)];
    const dateMatches = [...content.matchAll(/publishedAt:\s*"([^"]+)"/g)];
    for (let i = 0; i < slugMatches.length && i < dateMatches.length; i++) {
      const slug = slugMatches[i][1];
      const date = dateMatches[i][1];
      const age = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
      if (age <= 48) {
        urls.push({ url: `${SITE_URL}/blog/${slug}`, priority: 1, reason: "new blog article" });
      }
    }
  }

  // Also check content-queue for recently published
  const queuePath = resolve(ROOT, "src/data/content-queue.json");
  if (existsSync(queuePath)) {
    try {
      const queue = JSON.parse(readFileSync(queuePath, "utf8"));
      for (const item of queue) {
        if (item.status === "published" && item.data?.slug) {
          const age = (Date.now() - new Date(item.publishDate).getTime()) / (1000 * 60 * 60);
          if (age <= 48) {
            urls.push({ url: `${SITE_URL}/blog/${item.data.slug}`, priority: 1, reason: "new queued article" });
          }
        }
      }
    } catch { /* ignore */ }
  }

  // 2. Top character pages
  for (const char of TOP_CHARACTERS) {
    urls.push({ url: `${SITE_URL}/character/${char.slug}`, priority: 2, reason: `character (vol ${char.volume})` });
  }

  // 3. Top series pages
  for (const series of TOP_SERIES) {
    urls.push({ url: `${SITE_URL}/series/${series}`, priority: 3, reason: "series page" });
  }

  // 4. Random /watch/ pages (pick from sitemap range)
  // Generate 20 random IDs across the catalog range for discovery
  const watchIds = [];
  for (let i = 0; i < 20; i++) {
    const randomId = Math.floor(Math.random() * 350000) + 1;
    watchIds.push(randomId);
  }
  // We don't know the exact slugs, so submit tag pages instead as catch-all
  const popularTags = [
    "anal", "uncensored", "3d", "milf", "vanilla", "tentacle",
    "big_breasts", "creampie", "blowjob", "group",
  ];
  for (const tag of popularTags) {
    urls.push({ url: `${SITE_URL}/tag/${tag}`, priority: 4, reason: "popular tag" });
  }

  // Filter out recently submitted
  const fresh = urls.filter((u) => !isRecentlySubmitted(u.url, submitted));

  // Sort by priority, take top N
  fresh.sort((a, b) => a.priority - b.priority);
  return fresh.slice(0, MAX_URLS_PER_RUN);
}

// ── Submit via Indexing API ───────────────────────────────────
async function submitViaIndexingAPI(urls) {
  const results = { success: [], failed: [], unsupported: false };

  try {
    const auth = getAuth(["https://www.googleapis.com/auth/indexing"]);
    const client = await auth.getClient();

    for (const { url, reason } of urls) {
      try {
        const res = await client.request({
          url: "https://indexing.googleapis.com/v3/urlNotifications:publish",
          method: "POST",
          data: { url, type: "URL_UPDATED" },
        });
        results.success.push({ url, reason, status: res.status });
        log(`OK ${url} (${reason})`);
      } catch (e) {
        const status = e?.response?.status || "unknown";
        const msg = e?.response?.data?.error?.message || e.message;
        if (status === 403 || status === 401) {
          results.unsupported = true;
          log(`Indexing API not available (${status}): ${msg}`);
          break;
        }
        results.failed.push({ url, reason, error: msg });
        log(`FAIL ${url}: ${msg}`);
      }
    }
  } catch (e) {
    results.unsupported = true;
    log(`Indexing API auth failed: ${e.message}`);
  }

  return results;
}

// ── Fallback: ping sitemaps ───────────────────────────────────
async function pingSitemaps() {
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;
  try {
    const auth = getAuth(["https://www.googleapis.com/auth/webmasters"]);
    const sc = google.searchconsole({ version: "v1", auth });
    await sc.sitemaps.submit({ siteUrl: "sc-domain:iku.gg", feedpath: sitemapUrl });
    log(`Sitemap ping OK: ${sitemapUrl}`);
    return true;
  } catch (e) {
    log(`Sitemap ping failed: ${e.message}`);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────
export async function submitUrlsToGoogle() {
  console.log("\n── URL SUBMISSION TO GOOGLE ──────────────────────");
  const submitted = loadSubmitted();
  const urls = collectPriorityUrls(submitted);

  if (urls.length === 0) {
    log("No new URLs to submit (all recently submitted)");
    return { submitted: 0, failed: 0, urls: [] };
  }

  log(`${urls.length} URLs to submit:`);
  for (const u of urls) log(`  [P${u.priority}] ${u.url} (${u.reason})`);

  if (DRY_RUN) {
    log("DRY RUN — skipping actual submission");
    return { submitted: 0, failed: 0, urls: urls.map((u) => u.url) };
  }

  // Try Indexing API first
  const results = await submitViaIndexingAPI(urls);

  // If Indexing API is not available, log URLs for manual submission
  if (results.unsupported) {
    log("Indexing API not available — falling back to sitemap ping");
    await pingSitemaps();
    log("URLs that need manual submission via GSC UI:");
    for (const u of urls) log(`  ${u.url}`);
  }

  // Track submitted URLs
  const now = new Date().toISOString();
  for (const s of results.success) {
    submitted[s.url] = { submittedAt: now, method: "indexing-api", reason: s.reason };
  }
  // Even if indexing API failed, track that we attempted via sitemap ping
  if (results.unsupported) {
    for (const u of urls) {
      if (!submitted[u.url] || !isRecentlySubmitted(u.url, submitted)) {
        submitted[u.url] = { submittedAt: now, method: "sitemap-ping", reason: u.reason };
      }
    }
  }

  // Prune old entries (>30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [url, entry] of Object.entries(submitted)) {
    if (new Date(entry.submittedAt).getTime() < thirtyDaysAgo) {
      delete submitted[url];
    }
  }

  saveSubmitted(submitted);
  log(`Tracked ${Object.keys(submitted).length} URLs in submitted-urls.json`);

  return {
    submitted: results.success.length,
    failed: results.failed.length,
    unsupported: results.unsupported,
    urls: urls.map((u) => u.url),
  };
}

// Run standalone
if (process.argv[1] && process.argv[1].includes("submit-urls-to-google")) {
  submitUrlsToGoogle().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
}
