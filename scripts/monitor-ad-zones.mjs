#!/usr/bin/env node
/**
 * monitor-ad-zones.mjs v3 — runs on Hetzner cron 4x/day (every 6h).
 *
 * v3 (2026-07-03): rewritten after the display relight. v2 checked the
 * HilltopAds banner stack, dead since 2026-06-30 (white squares killed,
 * slots refilled with AdRotationBanner affiliate creatives) — every v2
 * run was red on checks for surfaces that no longer exist.
 *
 * Current architecture (2026-07-03):
 *  - ExoClick display: watch underplayer 728x90/320x50 + sidebar 300x250,
 *    /explore native (AdZoneClient + a.magsrv.com/ad-provider.js)
 *  - AdRotationBanner CR affiliate 300x250 (joi/candy/swipey) on
 *    /, /watch, /explore + 13 browse pages
 *  - Soulkyn vertical, MegaFooter /go links, Mondiad interstitial+push
 *  - /feed (Shorts) is DELIBERATELY ad-free — do not add checks there.
 *
 * Checks every 6h:
 *  1. /watch mobile 430x932: ExoClick zone mounted + request fired,
 *     CR joi/candy anchors, imglnkx creative, drawer works.
 *  2. / desktop: CR anchors + trending carousel native.
 *  3. /explore desktop: ExoClick native zone + CR anchors.
 *  4. ONCE per day (05h run only, to keep fake clicks off CR stats):
 *     /go/{slug} END-TO-END — follows the full redirect chain with a
 *     browser UA and fails if it dead-ends on the tracker domain, gets
 *     bounced back to iku.gg, or lands on a ~blank page. This is the
 *     check that would have caught the missing-/0 CR bug (blank 200
 *     page, zero clicks registered 2026-05-12 → 2026-07-03) on day one.
 *  Anything fails → Telegram alert.
 */

import { chromium } from "playwright";
import https from "https";
import fs from "fs";
import path from "path";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = "5617056258";
const SITE = "https://iku.gg";
const STATE_FILE = "/var/log/iku-scrape/monitor-ads.state.json";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Affiliate tracker hosts. If a /go/ chain ENDS on one of these, the
// tracker served a page instead of redirecting to the offer = dead link.
const TRACKER_HOSTS = [
  "t.vlmai-1.com",
  "t.aagm.link",
  "t.bbwafx.com",
  "go.mavrtracktor.com",
  "kpdtrk.com",
];

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(s) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(s));
  } catch (e) {
    console.error("state write failed:", e.message);
  }
}

async function tg(text) {
  if (!TG_TOKEN) {
    console.log("[tg-skip]", text);
    return;
  }
  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id: TG_CHAT,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
    const req = https.request(
      `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", resolve);
      },
    );
    req.on("error", () => resolve());
    req.write(body);
    req.end();
  });
}

async function pickWatchSlug() {
  try {
    const html = await new Promise((resolve, reject) => {
      https
        .get(
          `${SITE}/trending`,
          { headers: { "User-Agent": CHROME_UA } },
          (res) => {
            let buf = "";
            res.on("data", (c) => (buf += c));
            res.on("end", () => resolve(buf));
          },
        )
        .on("error", reject);
    });
    const matches = [...html.matchAll(/\/watch\/([\w-]+)/g)].map((m) => m[1]);
    const unique = [...new Set(matches)];
    if (unique.length === 0) throw new Error("no slugs found");
    return unique[Math.floor(Math.random() * unique.length)];
  } catch {
    return "r34-14029915-animated";
  }
}

// ── Check 4: /go/ END-TO-END — the pipe itself, not just the anchor ──
async function checkGoLinksEndToEnd() {
  const slugs = [
    "joi-ai",
    "candy-ai",
    "swipey",
    "hentai-heroes",
    "soulkyn",
    "stripcash",
  ];
  const failures = [];
  for (const slug of slugs) {
    try {
      const res = await fetch(`${SITE}/go/${slug}`, {
        redirect: "follow",
        headers: { "User-Agent": CHROME_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(25_000),
      });
      const finalUrl = new URL(res.url);
      const body = await res.text();
      if (finalUrl.hostname.replace(/^www\./, "") === "iku.gg") {
        failures.push(`/go/${slug}: bounced back to iku.gg (bot-flagged?)`);
      } else if (TRACKER_HOSTS.includes(finalUrl.hostname)) {
        failures.push(
          `/go/${slug}: DEAD-ENDS on tracker ${finalUrl.hostname} (status ${res.status}, body ${body.length}b) — offer id dead or link format broken`,
        );
      } else if (
        res.status === 403 &&
        finalUrl.hostname.endsWith("soulkyn.com")
      ) {
        // Soulkyn's WAF blocks datacenter IPs (Hetzner) but serves 200 to
        // residential traffic — verified 2026-07-03. Reaching soulkyn.com
        // at all means the redirect chain is intact.
      } else if (res.status !== 200) {
        failures.push(
          `/go/${slug}: landing ${finalUrl.hostname} → HTTP ${res.status}`,
        );
      } else if (body.length < 500) {
        failures.push(
          `/go/${slug}: landing ${finalUrl.hostname} near-blank (${body.length}b)`,
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      failures.push(`/go/${slug}: ${e.message}`);
    }
  }
  return { url: `${SITE}/go/*`, failures };
}

// ── Check 1: /watch mobile ──
async function checkWatchMobile() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });
  const page = await ctx.newPage();
  const slug = await pickWatchSlug();
  const url = `${SITE}/watch/${slug}`;

  let exoReqSeen = false;
  let crImgSeen = false;
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("magsrv") || u.includes("exosrv") || u.includes("bkcdn"))
      exoReqSeen = true;
    if (u.includes("imglnkx.com")) crImgSeen = true;
  });

  const failures = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(10_000);

    const dom = await page.evaluate(() => {
      const zones = Array.from(document.querySelectorAll(".ad-zone"));
      const visibleZones = zones.filter(
        (z) => window.getComputedStyle(z).display !== "none",
      );
      const joiAnchor = !!Array.from(document.querySelectorAll("a")).find((a) =>
        (a.href || "").includes("/go/joi-ai"),
      );
      const candyAnchor = !!Array.from(document.querySelectorAll("a")).find(
        (a) => (a.href || "").includes("/go/candy-ai"),
      );
      return {
        zoneCount: zones.length,
        visibleZoneCount: visibleZones.length,
        joiAnchor,
        candyAnchor,
      };
    });

    if (dom.zoneCount === 0)
      failures.push("ExoClick: no .ad-zone mounted on /watch");
    if (dom.visibleZoneCount === 0)
      failures.push("ExoClick: all .ad-zone hidden on /watch mobile");
    if (!exoReqSeen)
      failures.push("ExoClick: no magsrv/exosrv/bkcdn request fired on /watch");
    if (!dom.joiAnchor)
      failures.push("CR Joi /go/joi-ai anchor missing on /watch");
    if (!dom.candyAnchor)
      failures.push("CR Candy /go/candy-ai anchor missing on /watch");
    if (!crImgSeen)
      failures.push("CR creative GIF (imglnkx.com) never loaded on /watch");

    const burger = await page.$(".v2-topbar-hamburger");
    if (!burger) {
      failures.push("Mobile burger missing on /watch");
    } else {
      await burger.click();
      await page
        .waitForSelector(".v2-nav-drawer", { state: "visible", timeout: 5_000 })
        .catch(() => {});
      await page.waitForTimeout(800);
      const drawerProbe = await page.evaluate(() => {
        const d = document.querySelector(".v2-nav-drawer");
        if (!d) return { ok: false, reason: "no drawer node" };
        if (window.getComputedStyle(d).display === "none")
          return { ok: false, reason: "drawer display:none" };
        const links = d.querySelectorAll("a").length;
        if (links < 10)
          return { ok: false, reason: `only ${links} links in drawer` };
        const liveCams = Array.from(d.querySelectorAll("a")).find((a) =>
          /live\s*cams?/i.test(a.textContent || ""),
        );
        if (!liveCams)
          return { ok: false, reason: "Live Cams link missing in drawer" };
        return { ok: true, links };
      });
      if (!drawerProbe.ok)
        failures.push(`Drawer broken: ${drawerProbe.reason}`);
    }
  } catch (e) {
    failures.push(`page error: ${e.message}`);
  } finally {
    await browser.close();
  }

  return { url, failures };
}

// ── Check 2: homepage desktop ──
async function checkHomepageDesktop() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: CHROME_UA,
  });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });
  const page = await ctx.newPage();
  const failures = [];
  try {
    await page.goto(`${SITE}/`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(8_000);
    const r = await page.evaluate(() => {
      const carouselTrack = document.querySelector(".carousel-track");
      const adInTrack = carouselTrack
        ? Array.from(carouselTrack.querySelectorAll("a")).filter((a) =>
            (a.href || "").includes("/go/joi-ai"),
          ).length
        : 0;
      return {
        joiAnchorsAll: Array.from(document.querySelectorAll("a")).filter((a) =>
          (a.href || "").includes("/go/joi-ai"),
        ).length,
        candyAnchorsAll: Array.from(document.querySelectorAll("a")).filter(
          (a) => (a.href || "").includes("/go/candy-ai"),
        ).length,
        adInsideTrendingCarousel: adInTrack,
        goAnchorsTotal: Array.from(document.querySelectorAll("a")).filter((a) =>
          (a.href || "").includes("/go/"),
        ).length,
      };
    });
    if (r.joiAnchorsAll < 1) failures.push("Homepage: Joi anchor missing");
    if (r.candyAnchorsAll < 1) failures.push("Homepage: Candy anchor missing");
    if (r.adInsideTrendingCarousel < 1)
      failures.push("Homepage: Trending carousel native ad missing");
    if (r.goAnchorsTotal < 10)
      failures.push(
        `Homepage: only ${r.goAnchorsTotal} /go/ anchors total (MegaFooter gone?)`,
      );
  } catch (e) {
    failures.push(`Homepage error: ${e.message}`);
  } finally {
    await browser.close();
  }
  return { url: `${SITE}/`, failures };
}

// ── Check 3: /explore desktop ──
async function checkExploreDesktop() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: CHROME_UA,
  });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });
  const page = await ctx.newPage();
  let exoReqSeen = false;
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("magsrv") || u.includes("exosrv") || u.includes("bkcdn"))
      exoReqSeen = true;
  });
  const failures = [];
  try {
    await page.goto(`${SITE}/explore`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // Native zone is lazy — scroll it into view before judging.
    await page.waitForTimeout(4_000);
    await page.evaluate(() => {
      const z = document.querySelector('[data-ad-zone="5893292"]');
      if (z) z.scrollIntoView({ block: "center" });
      else window.scrollTo(0, document.body.scrollHeight * 0.7);
    });
    await page.waitForTimeout(8_000);
    const r = await page.evaluate(() => ({
      nativeZone: !!document.querySelector('[data-ad-zone="5893292"]'),
      goAnchors: Array.from(document.querySelectorAll("a")).filter((a) =>
        (a.href || "").includes("/go/"),
      ).length,
    }));
    if (!r.nativeZone)
      failures.push("/explore: ExoClick native zone 5893292 not mounted");
    if (!exoReqSeen)
      failures.push("/explore: no ExoClick network request fired");
    if (r.goAnchors < 3)
      failures.push(`/explore: only ${r.goAnchors} /go/ anchors`);
  } catch (e) {
    failures.push(`/explore desktop error: ${e.message}`);
  } finally {
    await browser.close();
  }
  return { url: `${SITE}/explore`, failures };
}

(async () => {
  const state = loadState();
  const lines = [`📡 *iku.gg ad-zone check v3* — ${new Date().toISOString()}`];
  let alert = false;

  const watchCheck = await checkWatchMobile();
  if (watchCheck.failures.length === 0) {
    lines.push(`✅ /watch mobile: ExoClick + Joi + Candy + drawer OK`);
  } else {
    alert = true;
    lines.push(`🔴 ${watchCheck.url}:`);
    for (const f of watchCheck.failures) lines.push(`   • ${f}`);
  }

  const homepageCheck = await checkHomepageDesktop();
  if (homepageCheck.failures.length === 0) {
    lines.push(`✅ / desktop: affiliate anchors + carousel native OK`);
  } else {
    alert = true;
    lines.push(`🔴 ${homepageCheck.url}:`);
    for (const f of homepageCheck.failures) lines.push(`   • ${f}`);
  }

  const exploreCheck = await checkExploreDesktop();
  if (exploreCheck.failures.length === 0) {
    lines.push(`✅ /explore desktop: ExoClick native OK`);
  } else {
    alert = true;
    lines.push(`🔴 ${exploreCheck.url}:`);
    for (const f of exploreCheck.failures) lines.push(`   • ${f}`);
  }

  // End-to-end /go/ check: once a day (05h UTC run) so test clicks stay
  // negligible in the networks' stats. Force with GO_E2E=1.
  const hour = new Date().getUTCHours();
  if (hour < 6 || process.env.GO_E2E === "1") {
    const goCheck = await checkGoLinksEndToEnd();
    if (goCheck.failures.length === 0) {
      lines.push(`✅ /go/* end-to-end: all 6 slugs land on real offers`);
    } else {
      alert = true;
      lines.push(`🔴 ${goCheck.url} END-TO-END:`);
      for (const f of goCheck.failures) lines.push(`   • ${f}`);
    }
  }

  saveState(state);

  const msg = lines.join("\n");
  console.log(msg);
  if (alert) await tg(msg);
  process.exit(0);
})();
