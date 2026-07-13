#!/usr/bin/env node
/**
 * Clean /watch speed test — 1 fresh headless context per slug, no
 * Chrome saturation. Validates the post-fix loadEvent timing.
 */

import { chromium } from "playwright";

const SITE = "https://iku.gg";

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Pull 5 real slugs
  const ctxA = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  });
  await ctxA.addInitScript(() => {
    try {
      localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });
  const tp = await ctxA.newPage();
  await tp.goto(SITE + "/trending", { waitUntil: "domcontentloaded" });
  const slugs = await tp.evaluate(() =>
    [
      ...new Set(
        Array.from(document.querySelectorAll('a[href*="/watch/"]'))
          .map((a) => a.getAttribute("href"))
          .filter((h) => h && h.startsWith("/watch/"))
          .map((h) => h.replace("/watch/", "")),
      ),
    ].slice(0, 5),
  );
  await ctxA.close();

  console.log(`Testing /watch on 5 fresh contexts (mobile, post-fix):`);
  console.log("─".repeat(80));

  const results = [];
  for (const slug of slugs) {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("iku-age-verified", "true");
      } catch {}
    });
    // Each context must have its own fresh sessionStorage so iku_vast_preroll_count = 1
    const page = await ctx.newPage();
    const t0 = Date.now();
    try {
      await page.goto(`${SITE}/watch/${slug}`, {
        waitUntil: "load",
        timeout: 25_000,
      });
      const totalMs = Date.now() - t0;
      const v = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance
          .getEntriesByType("paint")
          .find((p) => p.name === "first-contentful-paint")?.startTime;
        return {
          ttfb: Math.round(nav.responseStart),
          dcl: Math.round(nav.domContentLoadedEventEnd),
          load: Math.round(nav.loadEventEnd),
          fcp: Math.round(fcp || 0),
        };
      });
      results.push({ slug, totalMs, ...v });
      console.log(
        `  /watch/${slug.padEnd(35)} TTFB=${v.ttfb}ms FCP=${v.fcp}ms DCL=${v.dcl}ms Load=${v.load}ms total=${totalMs}ms`,
      );
    } catch (e) {
      console.log(
        `  /watch/${slug.padEnd(35)} TIMEOUT (${e.message.slice(0, 40)})`,
      );
      results.push({ slug, error: true });
    }
    await ctx.close();
  }

  console.log("─".repeat(80));
  const valid = results.filter((r) => !r.error);
  if (valid.length) {
    const avg = (k) =>
      Math.round(valid.reduce((a, r) => a + r[k], 0) / valid.length);
    console.log(
      `Avg across ${valid.length}/5: TTFB=${avg("ttfb")}ms FCP=${avg("fcp")}ms DCL=${avg("dcl")}ms Load=${avg("load")}ms total=${avg("totalMs")}ms`,
    );
  }
  await browser.close();
})();
