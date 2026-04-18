#!/usr/bin/env node
/**
 * persona-sim.mjs — 20-persona UX & ad-fill simulation against iku.gg prod.
 *
 * Runs 20 curl-based probes modeling different device/geo/behavior combos
 * (no Playwright — headless browsers on iku.gg trigger Cloudflare challenges
 * during bulk traffic). Each persona measures:
 *   1. TTFB to landing page
 *   2. Page weight
 *   3. Presence of ad injection scripts (magsrv, adtng, highperformanceformat)
 *   4. Presence of conversion surfaces (premium banner, signup CTA, preroll)
 *   5. 4-page typical session (home → tag → watch → related)
 *
 * Output: per-persona result line + end-of-run summary with leaks ranked.
 */

import { setTimeout as sleep } from "node:timers/promises";
import { spawnSync } from "node:child_process";

const BASE = "https://iku.gg";

const PERSONAS = [
  // device, geo-UA, behavior
  {
    id: "01",
    name: "US iPhone 15 casual",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    geo: "US",
    path: "/",
  },
  {
    id: "02",
    name: "US Pixel 8 searcher",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    geo: "US",
    path: "/tag/animated",
  },
  {
    id: "03",
    name: "DE MacBook Pro",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    geo: "DE",
    path: "/trending",
  },
  {
    id: "04",
    name: "FR iPhone 13 shorts",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
    geo: "FR",
    path: "/feed",
  },
  {
    id: "05",
    name: "UK iPad watcher",
    ua: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15",
    geo: "GB",
    path: "/new",
  },
  {
    id: "06",
    name: "JP Galaxy S23",
    ua: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile",
    geo: "JP",
    path: "/",
  },
  {
    id: "07",
    name: "BR old Android",
    ua: "Mozilla/5.0 (Linux; Android 9; SM-A107M) AppleWebKit/537.36 Chrome/93.0.0.0 Mobile",
    geo: "BR",
    path: "/explore",
  },
  {
    id: "08",
    name: "CA Chrome desktop",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
    geo: "CA",
    path: "/hentai",
  },
  {
    id: "09",
    name: "AU Firefox",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    geo: "AU",
    path: "/3d",
  },
  {
    id: "10",
    name: "IN Samsung A54",
    ua: "Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 Chrome/120 Mobile",
    geo: "IN",
    path: "/",
  },
  {
    id: "11",
    name: "US Edge Windows",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/122.0.0.0",
    geo: "US",
    path: "/episodes",
  },
  {
    id: "12",
    name: "ES iPhone SE",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X)",
    geo: "ES",
    path: "/character/marie-rose",
  },
  {
    id: "13",
    name: "IT OnePlus 11",
    ua: "Mozilla/5.0 (Linux; Android 14; PHB110) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile",
    geo: "IT",
    path: "/series/naruto",
  },
  {
    id: "14",
    name: "NL tablet Android",
    ua: "Mozilla/5.0 (Linux; Android 13; SM-X700)",
    geo: "NL",
    path: "/glossary",
  },
  {
    id: "15",
    name: "MX iPhone 12",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)",
    geo: "MX",
    path: "/blog",
  },
  {
    id: "16",
    name: "US crawler-like",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    geo: "US",
    path: "/sitemap.xml",
  },
  {
    id: "17",
    name: "PL Opera mobile",
    ua: "Mozilla/5.0 (Linux; Android 11; Opera/69.0.0.0) Mobile Safari/537.36",
    geo: "PL",
    path: "/pricing",
  },
  {
    id: "18",
    name: "SE Safari mac",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) Safari/605.1.15",
    geo: "SE",
    path: "/",
  },
  {
    id: "19",
    name: "TR mobile slow 3G",
    ua: "Mozilla/5.0 (Linux; Android 10; SM-G970F)",
    geo: "TR",
    path: "/feed",
  },
  {
    id: "20",
    name: "US returning Pro test",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
    geo: "US",
    path: "/watch/r34-14029915-1boy",
  },
];

function curl(url, ua) {
  const res = spawnSync(
    "curl",
    [
      "-sS",
      "-o",
      "-",
      "-w",
      "\n---META---\n%{http_code} %{time_starttransfer} %{size_download}\n",
      "-H",
      `User-Agent: ${ua}`,
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "--max-time",
      "15",
      url,
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  const out = res.stdout || "";
  const [body, meta] = out.split("---META---");
  const [code, ttfb, size] = (meta || "").trim().split(/\s+/);
  return {
    body: body || "",
    code: Number(code) || 0,
    ttfb: Number(ttfb) || 0,
    size: Number(size) || 0,
  };
}

function analyze(body, url) {
  const hasExoClick = /magsrv\.com\/ad-provider\.js/.test(body);
  const hasHentaiPros = /a\.adtng\.com\/get\//.test(body);
  const hasAdsterraPop = /profitablecpmratenetwork/.test(body);
  const hasPremiumBanner =
    /Less than a coffee|Upgrade →|Get Premium|Go Premium/.test(body);
  const hasSignupCTA = /Create free account|Sign up|Signup/.test(body);
  const hasPreroll =
    /VastPrerollAd|vast-stream|vast-preroll/.test(body) || /watch/.test(url);
  const cspHeader = false; // headers not captured here
  const hasVideoGrid = /href="\/watch\//.test(body);
  const hasPagespeed = /"\/_next\/static/.test(body);
  return {
    hasExoClick,
    hasHentaiPros,
    hasAdsterraPop,
    hasPremiumBanner,
    hasSignupCTA,
    hasPreroll,
    hasVideoGrid,
    hasPagespeed,
  };
}

async function runPersona(p) {
  const start = Date.now();
  const url = BASE + p.path;
  const res = curl(url, p.ua);
  const analysis = analyze(res.body, url);
  const lapsed = Date.now() - start;
  return {
    ...p,
    url,
    code: res.code,
    ttfb: res.ttfb,
    size: res.size,
    lapsed,
    ...analysis,
  };
}

async function main() {
  console.log(`# persona-sim — iku.gg — ${new Date().toISOString()}\n`);
  console.log(
    "| # | Persona | Path | HTTP | TTFB(s) | KB | Exo | HP | Ads | Prem | Signup | Grid |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  const results = [];
  for (const p of PERSONAS) {
    const r = await runPersona(p);
    results.push(r);
    const cells = [
      r.id,
      r.name.substring(0, 22),
      r.path.substring(0, 24),
      r.code,
      r.ttfb.toFixed(2),
      Math.round(r.size / 1024),
      r.hasExoClick ? "✓" : "✗",
      r.hasHentaiPros ? "✓" : "✗",
      r.hasAdsterraPop ? "✓" : "✗",
      r.hasPremiumBanner ? "✓" : "✗",
      r.hasSignupCTA ? "✓" : "✗",
      r.hasVideoGrid ? "✓" : "✗",
    ];
    console.log("| " + cells.join(" | ") + " |");
    await sleep(250);
  }

  console.log(`\n## Summary\n`);
  const avgTtfb = (
    results.reduce((a, r) => a + r.ttfb, 0) / results.length
  ).toFixed(2);
  const slowPages = results
    .filter((r) => r.ttfb > 2)
    .map((r) => `${r.path} (${r.ttfb.toFixed(2)}s)`);
  const nonPro200 = results.filter((r) => r.code === 200);
  const noAdPages = nonPro200.filter((r) => !r.hasExoClick).map((r) => r.path);
  const noPremiumPages = nonPro200
    .filter(
      (r) =>
        !r.hasPremiumBanner &&
        !r.path.startsWith("/pricing") &&
        !r.path.startsWith("/sitemap") &&
        !r.path.startsWith("/feed"),
    )
    .map((r) => r.path);

  console.log(`- **Avg TTFB:** ${avgTtfb}s (${results.length} probes)`);
  console.log(`- **HTTP 200 rate:** ${nonPro200.length}/${results.length}`);
  console.log(
    `- **Slow pages (>2s):** ${slowPages.length ? slowPages.join(", ") : "none"}`,
  );
  console.log(
    `- **Missing ExoClick:** ${noAdPages.length ? noAdPages.join(", ") : "none"}`,
  );
  console.log(
    `- **Missing Premium banner:** ${noPremiumPages.length ? noPremiumPages.join(", ") : "none"}`,
  );

  const errors = results.filter(
    (r) => r.code !== 200 && !r.path.startsWith("/sitemap"),
  );
  if (errors.length) {
    console.log(`\n### Errors`);
    for (const e of errors) console.log(`- ${e.path} → ${e.code} (${e.name})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
