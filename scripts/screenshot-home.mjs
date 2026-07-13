#!/usr/bin/env node
import { chromium } from "playwright";

(async () => {
  // Use a fresh context (no auth, no Pro flag) to see what a 1st-time
  // visitor sees.
  const browser = await chromium.launch({ headless: true });

  // Mobile (90% of traffic)
  const mctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  });
  await mctx.addInitScript(() => {
    try {
      localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });
  const mp = await mctx.newPage();
  await mp.goto("https://iku.gg/", { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(6000);
  await mp.screenshot({
    path: "home-mobile.jpeg",
    fullPage: true,
    type: "jpeg",
    quality: 80,
  });
  await mp.screenshot({
    path: "home-mobile-fold.jpeg",
    type: "jpeg",
    quality: 85,
  });

  // Desktop
  const dctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132 Safari/537.36",
  });
  await dctx.addInitScript(() => {
    try {
      localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });
  const dp = await dctx.newPage();
  await dp.goto("https://iku.gg/", { waitUntil: "domcontentloaded" });
  await dp.waitForTimeout(6000);
  await dp.screenshot({
    path: "home-desktop.jpeg",
    fullPage: true,
    type: "jpeg",
    quality: 80,
  });
  await dp.screenshot({
    path: "home-desktop-fold.jpeg",
    type: "jpeg",
    quality: 85,
  });

  await browser.close();
  console.log(
    "Saved: home-mobile.jpeg home-mobile-fold.jpeg home-desktop.jpeg home-desktop-fold.jpeg",
  );
})();
