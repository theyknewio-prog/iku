#!/usr/bin/env node
/**
 * smoke-test.mjs
 *
 * Hits 15 representative routes on iku.gg with a 5s timeout each. Reports
 * failing routes (HTTP != 200 or timeout) and slow routes (>2s). Exits 1
 * if any route fails.
 *
 * Called by deploy.sh after a deploy to catch regressions. Can also be run
 * ad-hoc:
 *   node scripts/smoke-test.mjs
 *   SITE_URL=https://iku.gg node scripts/smoke-test.mjs
 */

const SITE = process.env.SITE_URL || "https://iku.gg";
const TIMEOUT_MS = 5000;
const SLOW_MS = 2000;

const ROUTES = [
  "/",
  "/trending",
  "/new",
  "/explore",
  "/tags",
  "/character",
  "/series",
  "/episodes",
  "/blog",
  "/tag/anal",
  "/tag/big-breasts",
  "/character/naruto",
  "/series/genshin-impact",
  "/api/health",
  "/sitemap.xml",
];

async function check(path) {
  const url = SITE + path;
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "iku-smoke-test/1.0",
        "Cache-Control": "no-cache",
      },
      signal: ctrl.signal,
      redirect: "manual",
    });
    clearTimeout(timer);
    const ms = Math.round(performance.now() - t0);
    const ok = r.status >= 200 && r.status < 400;
    return { path, status: r.status, ms, ok };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    return { path, status: 0, ms, ok: false, err: e.message };
  }
}

async function main() {
  console.log(`\nSmoke test → ${SITE}\n`);
  const results = await Promise.all(ROUTES.map(check));

  let hardFail = 0;
  let slow = 0;
  for (const r of results) {
    const icon = !r.ok ? "✗" : r.ms > SLOW_MS ? "⚠" : "✓";
    const line = `${icon} [${r.status || "XX"}] ${String(r.ms).padStart(5)}ms  ${r.path}`;
    console.log(line + (r.err ? `  — ${r.err}` : ""));
    if (!r.ok) hardFail++;
    else if (r.ms > SLOW_MS) slow++;
  }

  console.log("");
  console.log(
    `Fail: ${hardFail}  Slow: ${slow}  OK: ${results.length - hardFail - slow}`,
  );
  process.exit(hardFail > 0 ? 1 : 0);
}

main();
