#!/usr/bin/env node
/**
 * Perf audit mobile — measures TTFB, FCP, LCP, total load time, JS size,
 * and lists every 3rd-party script that fires on the homepage. Simulates
 * a mid-tier 4G connection (1.6 Mbps down, 750 Kbps up, 150ms RTT).
 */

import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });

  // Throttle to slow 4G — DevTools "Slow 4G" preset
  const cdp = await ctx.newCDPSession(await ctx.newPage());
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });

  const page = ctx.pages()[0];
  const requests = [];
  page.on("request", (req) => {
    requests.push({
      url: req.url(),
      method: req.method(),
      type: req.resourceType(),
      t: Date.now(),
    });
  });
  const responses = [];
  page.on("response", (res) => {
    responses.push({
      url: res.url(),
      status: res.status(),
      size: 0, // filled later
      t: Date.now(),
    });
  });

  console.log("Loading https://iku.gg/ on simulated Slow 4G…");
  const t0 = Date.now();
  await page.goto("https://iku.gg/", { waitUntil: "load", timeout: 120_000 });
  const tLoad = Date.now() - t0;
  console.log(`window.load fired at +${tLoad}ms`);

  // Wait a bit more for any lazy stuff
  await page.waitForTimeout(3_000);

  // Web Vitals from the page
  const vitals = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find(
      (p) => p.name === "first-contentful-paint",
    )?.startTime;
    return {
      ttfb: nav?.responseStart,
      domContentLoaded: nav?.domContentLoadedEventEnd,
      loadEvent: nav?.loadEventEnd,
      transferSize: nav?.transferSize,
      decodedBodySize: nav?.decodedBodySize,
      fcp,
    };
  });
  console.log("\nWeb Vitals:");
  console.log(JSON.stringify(vitals, null, 2));

  // Categorize requests by host
  const byHost = {};
  for (const r of requests) {
    try {
      const h = new URL(r.url).hostname;
      byHost[h] = (byHost[h] || 0) + 1;
    } catch {}
  }
  console.log("\nRequests by host:");
  Object.entries(byHost)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([h, n]) => console.log(`  ${n.toString().padStart(3)}  ${h}`));

  // 3rd party scripts
  const thirdPartyScripts = requests.filter(
    (r) =>
      r.type === "script" &&
      !r.url.includes("iku.gg") &&
      !r.url.includes("/_next/"),
  );
  console.log("\n3rd-party scripts loaded:");
  for (const r of thirdPartyScripts) {
    const dt = ((r.t - t0) / 1000).toFixed(1);
    console.log(`  +${dt}s ${r.url.slice(0, 120)}`);
  }

  // JS bundle size from /_next/static/chunks
  const chunks = requests.filter(
    (r) => r.url.includes("/_next/static/chunks/") && r.url.endsWith(".js"),
  );
  console.log(`\nNext chunks loaded: ${chunks.length}`);

  await browser.close();
})();
