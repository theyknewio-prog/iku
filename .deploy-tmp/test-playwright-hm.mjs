#!/usr/bin/env node
// Test if headless Playwright can reach a hentaimama episode page past CF challenge.
import { chromium } from "playwright";

const URL = "https://hentaimama.io/episodes/1ldk-jk-ikinari-doukyo-micchaku-hatsu-ecchi-episode-6/";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000); // Let CF challenge + JS settle
    console.log("status:", res?.status());
    console.log("title:", await page.title());

    // Look for iframe or video source
    const iframes = await page.$$eval("iframe", (els) =>
      els.map((el) => ({ src: el.src, size: el.offsetWidth + "x" + el.offsetHeight }))
    );
    console.log("iframes:", iframes.slice(0, 10));

    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300));
    console.log("bodyStart:", bodyText);
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    await browser.close();
  }
})();
