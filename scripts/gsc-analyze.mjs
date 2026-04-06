#!/usr/bin/env node
/**
 * GSC Analyze — Pull Google Search Console data, analyze keyword opportunities,
 * and generate targeted SEO content recommendations.
 *
 * Usage:
 *   node scripts/gsc-analyze.mjs                    # last 7 days
 *   node scripts/gsc-analyze.mjs --days 28          # last 28 days
 *   node scripts/gsc-analyze.mjs --generate         # auto-generate blog articles for top opportunities
 *
 * Requires: gsc-service-account.json at project root (gitignored)
 * Prereq:   service account email added as user in GSC with read access
 */

import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const KEY_PATH = resolve(ROOT, "gsc-service-account.json");
const SITE_URL = "sc-domain:iku.gg"; // GSC domain property
const SITE_URL_ALT = "https://iku.gg/"; // fallback: URL-prefix property

// ── Auth ────────────────────────────────────────────────────────
function getAuth() {
  if (!existsSync(KEY_PATH)) {
    console.error("❌ gsc-service-account.json not found at project root.");
    console.error("   Download it from Google Cloud Console → Service Accounts → Keys.");
    process.exit(1);
  }
  const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

// ── Helpers ─────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function formatNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Pull GSC Data ───────────────────────────────────────────────
async function pullGSCData(days = 7) {
  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const startDate = daysAgo(days);
  const endDate = daysAgo(1); // yesterday (today's data not final)

  console.log(`\n📊 Pulling GSC data: ${startDate} → ${endDate} (${days} days)\n`);

  // Try domain property first, fallback to URL prefix
  let siteUrl = SITE_URL;
  try {
    await searchconsole.sites.get({ siteUrl });
  } catch {
    console.log(`  ⚠ Domain property "${SITE_URL}" not accessible, trying URL prefix...`);
    siteUrl = SITE_URL_ALT;
    try {
      await searchconsole.sites.get({ siteUrl });
    } catch (e) {
      console.error(`❌ Cannot access GSC for either "${SITE_URL}" or "${SITE_URL_ALT}".`);
      console.error(`   Make sure the service account email is added as a user in GSC.`);
      console.error(`   Error: ${e.message}`);
      process.exit(1);
    }
  }
  console.log(`  ✅ Connected to GSC: ${siteUrl}\n`);

  // 1. Queries (keywords)
  const queriesRes = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 500,
      dataState: "all",
    },
  });
  const queries = (queriesRes.data.rows || []).map((r) => ({
    keyword: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: (r.ctr * 100).toFixed(1),
    position: r.position.toFixed(1),
  }));

  // 2. Pages
  const pagesRes = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 100,
      dataState: "all",
    },
  });
  const pages = (pagesRes.data.rows || []).map((r) => ({
    page: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: (r.ctr * 100).toFixed(1),
    position: r.position.toFixed(1),
  }));

  // 3. Countries
  const countriesRes = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["country"],
      rowLimit: 50,
      dataState: "all",
    },
  });
  const countries = (countriesRes.data.rows || []).map((r) => ({
    country: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: (r.ctr * 100).toFixed(1),
    position: r.position.toFixed(1),
  }));

  // 4. Devices
  const devicesRes = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["device"],
      rowLimit: 10,
      dataState: "all",
    },
  });
  const devices = (devicesRes.data.rows || []).map((r) => ({
    device: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: (r.ctr * 100).toFixed(1),
    position: r.position.toFixed(1),
  }));

  // 5. Query + Page (to see which keyword lands on which page)
  const queryPageRes = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: 500,
      dataState: "all",
    },
  });
  const queryPages = (queryPageRes.data.rows || []).map((r) => ({
    keyword: r.keys[0],
    page: r.keys[1],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position.toFixed(1),
  }));

  return { queries, pages, countries, devices, queryPages, startDate, endDate, siteUrl };
}

// ── Analysis ────────────────────────────────────────────────────
function analyzeData(data) {
  const { queries, pages, countries, devices, queryPages } = data;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  GSC REPORT — iku.gg");
  console.log("  Period:", data.startDate, "→", data.endDate);
  console.log("═══════════════════════════════════════════════════════\n");

  // Summary
  const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
  console.log(`  Total: ${totalClicks} clicks | ${formatNum(totalImpressions)} impressions | ${queries.length} keywords | ${pages.length} pages\n`);

  // Top keywords by impressions
  console.log("── TOP KEYWORDS (by impressions) ──────────────────────");
  console.log("  Keyword".padEnd(55), "Imp".padStart(6), "Clk".padStart(5), "Pos".padStart(6), "CTR".padStart(6));
  console.log("  " + "─".repeat(75));
  const topQueries = [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 30);
  for (const q of topQueries) {
    console.log(
      `  ${q.keyword.padEnd(53)} ${String(q.impressions).padStart(6)} ${String(q.clicks).padStart(5)} ${q.position.padStart(6)} ${(q.ctr + "%").padStart(6)}`
    );
  }

  // Opportunities: high impressions + low CTR + good position (< 10)
  console.log("\n── OPPORTUNITIES (high impressions, position < 10, CTR < 5%) ──");
  const opportunities = queries
    .filter((q) => q.impressions >= 2 && parseFloat(q.position) < 10 && parseFloat(q.ctr) < 5)
    .sort((a, b) => b.impressions - a.impressions);

  if (opportunities.length === 0) {
    console.log("  No clear opportunities yet — need more data.\n");
  } else {
    for (const q of opportunities.slice(0, 15)) {
      console.log(`  🎯 "${q.keyword}" — ${q.impressions} imp, pos ${q.position}, CTR ${q.ctr}%`);
      // Find which page this keyword lands on
      const landing = queryPages.find((qp) => qp.keyword === q.keyword);
      if (landing) console.log(`     └─ landing: ${landing.page}`);
    }
  }

  // Keywords WITHOUT a dedicated page (content gap)
  console.log("\n── CONTENT GAPS (keywords without dedicated content) ────");
  const blogPage = "https://iku.gg/blog/best-hentai-studios";
  const gaps = queries.filter((q) => {
    const landings = queryPages.filter((qp) => qp.keyword === q.keyword);
    // If all landings are the same blog post, this keyword needs its own page
    return landings.every((l) => l.page === blogPage) && q.impressions >= 2;
  });
  if (gaps.length === 0) {
    console.log("  No clear gaps yet.\n");
  } else {
    for (const g of gaps.slice(0, 10)) {
      console.log(`  📝 "${g.keyword}" — ${g.impressions} imp, pos ${g.position} → needs its own article`);
    }
  }

  // Pages
  console.log("\n── PAGES ──────────────────────────────────────────────");
  for (const p of pages) {
    console.log(`  ${p.page}`);
    console.log(`     ${p.impressions} imp | ${p.clicks} clicks | pos ${p.position} | CTR ${p.ctr}%`);
  }

  // Countries
  console.log("\n── TOP COUNTRIES ──────────────────────────────────────");
  const topCountries = [...countries].sort((a, b) => b.impressions - a.impressions).slice(0, 10);
  for (const c of topCountries) {
    console.log(`  ${c.country.padEnd(6)} ${String(c.impressions).padStart(5)} imp | ${c.clicks} clicks | pos ${c.position}`);
  }

  // Devices
  console.log("\n── DEVICES ────────────────────────────────────────────");
  for (const d of devices) {
    console.log(`  ${d.device.padEnd(10)} ${String(d.impressions).padStart(6)} imp | ${d.clicks} clicks | CTR ${d.ctr}%`);
  }

  // New keywords (position > 10 = just appeared, might climb)
  console.log("\n── EMERGING KEYWORDS (position 5-20, could climb) ─────");
  const emerging = queries
    .filter((q) => parseFloat(q.position) >= 5 && parseFloat(q.position) <= 20 && q.impressions >= 1)
    .sort((a, b) => parseFloat(a.position) - parseFloat(b.position));
  for (const q of emerging.slice(0, 10)) {
    console.log(`  ↗ "${q.keyword}" — pos ${q.position}, ${q.impressions} imp`);
  }

  console.log("\n═══════════════════════════════════════════════════════\n");

  // Save raw data for future comparison
  const snapshot = {
    date: new Date().toISOString().split("T")[0],
    period: { start: data.startDate, end: data.endDate },
    totalClicks,
    totalImpressions,
    keywordCount: queries.length,
    pageCount: pages.length,
    queries: queries.slice(0, 100),
    pages,
    countries: countries.slice(0, 20),
    opportunities: opportunities.slice(0, 20),
    gaps: gaps.slice(0, 20),
  };

  const snapshotPath = resolve(ROOT, "data", "gsc-snapshots");
  if (!existsSync(snapshotPath)) {
    mkdirSync(snapshotPath, { recursive: true });
  }
  const filename = resolve(snapshotPath, `gsc-${snapshot.date}.json`);
  writeFileSync(filename, JSON.stringify(snapshot, null, 2));
  console.log(`  💾 Snapshot saved: ${filename}\n`);

  return { opportunities, gaps, snapshot };
}

// ── Main ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const days = args.includes("--days") ? parseInt(args[args.indexOf("--days") + 1]) || 7 : 7;

try {
  const data = await pullGSCData(days);
  analyzeData(data);
} catch (err) {
  console.error("❌ Error:", err.message);
  if (err.message.includes("403")) {
    console.error("\n   → The service account doesn't have access to this GSC property.");
    console.error("   → Go to GSC → Settings → Users → Add user:");
    console.error("     iku-gg@jovial-evening-492020-c3.iam.gserviceaccount.com");
  }
  process.exit(1);
}
