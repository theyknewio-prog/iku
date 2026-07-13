#!/usr/bin/env node
/**
 * 20 agents in the visible Chrome CDP. Each one checks ONLY 2 things:
 *   1. Ads — which surfaces fire on this device/page (banner, VAST, IPP,
 *      sticky 300x100, Stripcash slider, popunder script)
 *   2. Speed — TTFB, DOMContentLoaded, Load event, total time
 *
 * Tabs stay OPEN at the end so Sab can flip through them.
 */

import { chromium } from "playwright";
import fs from "fs";

const SITE = "https://iku.gg";

// 20 profiles — half /, half /watch/random, mix mobile/desktop, mix locales.
const PROFILES = [
  // Mobile (10) — split between / and /watch
  { id: 1, kind: "mobile", w: 393, h: 852, lang: "en-US", page: "/" },
  { id: 2, kind: "mobile", w: 393, h: 852, lang: "en-US", page: "/watch" },
  { id: 3, kind: "mobile", w: 375, h: 667, lang: "ja-JP", page: "/" },
  { id: 4, kind: "mobile", w: 375, h: 667, lang: "ja-JP", page: "/watch" },
  { id: 5, kind: "mobile", w: 360, h: 780, lang: "de-DE", page: "/" },
  { id: 6, kind: "mobile", w: 360, h: 780, lang: "de-DE", page: "/watch" },
  { id: 7, kind: "mobile", w: 412, h: 915, lang: "fr-FR", page: "/" },
  { id: 8, kind: "mobile", w: 412, h: 915, lang: "fr-FR", page: "/watch" },
  { id: 9, kind: "mobile", w: 414, h: 896, lang: "pt-BR", page: "/" },
  { id: 10, kind: "mobile", w: 414, h: 896, lang: "en-IN", page: "/watch" },
  // Desktop (10)
  { id: 11, kind: "desktop", w: 1920, h: 1080, lang: "en-US", page: "/" },
  { id: 12, kind: "desktop", w: 1920, h: 1080, lang: "en-US", page: "/watch" },
  { id: 13, kind: "desktop", w: 1440, h: 900, lang: "de-DE", page: "/" },
  { id: 14, kind: "desktop", w: 1440, h: 900, lang: "de-DE", page: "/watch" },
  { id: 15, kind: "desktop", w: 1366, h: 768, lang: "ja-JP", page: "/" },
  { id: 16, kind: "desktop", w: 1366, h: 768, lang: "ja-JP", page: "/watch" },
  { id: 17, kind: "desktop", w: 1600, h: 900, lang: "fr-FR", page: "/" },
  { id: 18, kind: "desktop", w: 1600, h: 900, lang: "fr-FR", page: "/watch" },
  { id: 19, kind: "desktop", w: 2560, h: 1440, lang: "en-GB", page: "/" },
  { id: 20, kind: "desktop", w: 1280, h: 720, lang: "en-CA", page: "/watch" },
];

async function pickRandomSlug() {
  // Hit /trending and grab a real slug. Hardcoded list rots.
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const ctx = browser.contexts()[0];
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    try {
      localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });
  await p.goto(SITE + "/trending", {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  const slugs = await p.evaluate(() => [
    ...new Set(
      Array.from(document.querySelectorAll('a[href*="/watch/"]'))
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && h.startsWith("/watch/"))
        .map((h) => h.replace("/watch/", "")),
    ),
  ]);
  await p.close();
  return slugs;
}

async function runAgent(browser, p, allSlugs) {
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.setViewportSize({ width: p.w, height: p.h });
  await page.setExtraHTTPHeaders({ "Accept-Language": p.lang });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });

  // Track ad-related network calls
  const adRequests = {
    vastApi: false, // /api/vast called → Surface #2 component is alive
    hilltopBanner: false, // selfassured-celebration script → banner
    hilltopIpp: false, // similar host but different URL
    stripcashLib: false, // creative.mavrtracktor.com → Surface #4
    popadsLib: false, // popads.net cdn → Surface #7 (not yet mounted)
  };
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/api/vast")) adRequests.vastApi = true;
    if (u.includes("selfassured-celebration.com"))
      adRequests.hilltopBanner = true;
    if (u.includes("creative.mavrtracktor.com")) adRequests.stripcashLib = true;
    if (u.includes("popads.net") || u.includes("popcash"))
      adRequests.popadsLib = true;
  });

  let url;
  if (p.page === "/watch") {
    const slug =
      allSlugs[Math.floor(Math.random() * allSlugs.length)] ||
      "r34-14029915-animated";
    url = `${SITE}/watch/${slug}`;
  } else {
    url = SITE + p.page;
  }

  const obs = {
    id: p.id,
    profile: `${p.kind} ${p.w}x${p.h} ${p.lang} ${p.page}`,
    url,
    speed: {},
    ads: {},
  };

  try {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    const tLoad = Date.now() - t0;

    // Wait for ad lazy-load timeouts (sticky 8s, IPP 3s)
    await page.waitForTimeout(9_000);

    // Speed metrics from PerformanceNavigationTiming
    obs.speed = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance
        .getEntriesByType("paint")
        .find((p) => p.name === "first-contentful-paint")?.startTime;
      return {
        ttfb: Math.round(nav?.responseStart || 0),
        domContentLoaded: Math.round(nav?.domContentLoadedEventEnd || 0),
        load: Math.round(nav?.loadEventEnd || 0),
        fcp: Math.round(fcp || 0),
        transferKB: Math.round((nav?.transferSize || 0) / 1024),
      };
    });
    obs.speed.totalMs = tLoad;

    // Visual ad detection (DOM presence)
    const adsDom = await page.evaluate(() => {
      const banner300 = !!document.querySelector(
        "iframe[title*=banner300x250]",
      );
      const banner100 = !!document.querySelector(
        "iframe[title*=banner300x100]",
      );
      const stickyEl = document.querySelector(".sticky-hilltop-bottom");
      const stickyVisible = stickyEl
        ? window.getComputedStyle(stickyEl).opacity !== "0"
        : false;
      const ippScript = !!document.getElementById("iku-hilltop-ipp-wrap");
      const stripcashHost = !!document.querySelector("[data-stripcash-slider]");
      return { banner300, banner100, stickyVisible, ippScript, stripcashHost };
    });

    obs.ads = {
      bannerInline: adsDom.banner300, // /watch banner
      bannerSticky: adsDom.stickyVisible, // mobile-only
      vastApi: adRequests.vastApi,
      hilltopBannerNet: adRequests.hilltopBanner,
      ipp: adsDom.ippScript,
      stripcash: adsDom.stripcashHost || adRequests.stripcashLib,
      popads: adRequests.popadsLib,
    };

    // Screenshot for posterity
    const safeId = String(p.id).padStart(2, "0");
    await page.screenshot({
      path: `agent-${safeId}-${p.kind}-${p.page === "/" ? "home" : "watch"}.jpeg`,
      type: "jpeg",
      quality: 65,
      fullPage: false,
    });
  } catch (e) {
    obs.error = e.message.slice(0, 120);
  }
  // DON'T close the page — Sab wants to flip through tabs
  return obs;
}

(async () => {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  console.log("Picking real slugs from /trending…");
  const slugs = await pickRandomSlug();
  console.log(`Got ${slugs.length} slugs.\n`);

  console.log(
    "Spawning 20 agents in batches of 5 (avoid socket saturation)…\n",
  );
  const t0 = Date.now();
  const reports = [];
  const BATCH = 5;
  for (let i = 0; i < PROFILES.length; i += BATCH) {
    const slice = PROFILES.slice(i, i + BATCH);
    const batchReports = await Promise.all(
      slice.map((p) => runAgent(browser, p, slugs)),
    );
    reports.push(...batchReports);
    console.log(
      `Batch ${i / BATCH + 1}/${Math.ceil(PROFILES.length / BATCH)} done — ${batchReports.length} agents`,
    );
  }
  console.log(`All done in ${((Date.now() - t0) / 1000).toFixed(1)}s.\n`);

  fs.writeFileSync(
    "twenty-agents-report.json",
    JSON.stringify(reports, null, 2),
  );

  // Summary table
  console.log(
    "ID  Profile                                    | TTFB  Load   FCP   | Banner Sticky VAST IPP Stripcash",
  );
  console.log("─".repeat(120));
  for (const r of reports.sort((a, b) => a.id - b.id)) {
    if (r.error) {
      console.log(
        `#${String(r.id).padStart(2)} ${r.profile.padEnd(40)} | ERROR: ${r.error}`,
      );
      continue;
    }
    const s = r.speed;
    const a = r.ads;
    const ok = (b) => (b ? "✅" : "❌");
    const naDesktop = r.profile.includes("desktop")
      ? "n/a"
      : ok(a.bannerSticky);
    const onWatch = r.url.includes("/watch/");
    console.log(
      `#${String(r.id).padStart(2)} ${r.profile.padEnd(40)} | ` +
        `${String(s.ttfb).padStart(4)}  ${String(s.load).padStart(5)}  ${String(s.fcp).padStart(4)} | ` +
        ` ${onWatch ? ok(a.bannerInline) : "n/a"}     ${naDesktop}     ${onWatch ? ok(a.vastApi) : "n/a"}   ${ok(a.ipp)}    ${ok(a.stripcash)}`,
    );
  }

  // Aggregate stats
  const validReports = reports.filter((r) => !r.error && r.speed.load);
  const avg = (k) =>
    Math.round(
      validReports.reduce((acc, r) => acc + (r.speed[k] || 0), 0) /
        validReports.length,
    );
  console.log(
    `\nAvg across ${validReports.length} agents: TTFB ${avg("ttfb")}ms · DCL ${avg("domContentLoaded")}ms · Load ${avg("load")}ms · FCP ${avg("fcp")}ms`,
  );

  console.log("\nReport saved to twenty-agents-report.json");
  console.log("All tabs left open in your Chrome — flip through them at will.");
})();
