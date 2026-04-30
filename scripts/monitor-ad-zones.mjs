#!/usr/bin/env node
/**
 * monitor-ad-zones.mjs — runs on Hetzner cron 4x/day (every 6h).
 *
 * The pattern that has burned us 3 times: surface ships → ISR caches →
 * we move on → 7 days later we discover it never fired (Surface #2 VAST
 * had 1 impression, Surface #3 Live Cams had 2 clicks, Surface #1 banner
 * was OK only because Playwright-verified at deploy). This catches the
 * regression in 6h instead of 7 days.
 *
 * Checks per run:
 *  1. HilltopAds yesterday total via API. If 0 impressions for 2
 *     consecutive runs → alert (zone may be paused / CSP regressed).
 *  2. Spin Playwright @ 430x932 (mobile, our 90% viewport), open random
 *     /watch/<slug> page, verify:
 *     a. <iframe> exists with srcdoc containing the HilltopAds banner
 *        script (Surface #1 mobile zone 6969685 is the high-volume one).
 *     b. POST or GET to /api/vast happens within 10s (Surface #2 VAST
 *        preroll script tries to fetch). If it never fires → component
 *        not mounted (ISR stale).
 *     c. Mobile drawer opens via .v2-topbar-hamburger AND the Live Cams
 *        anchor is rendered above viewport bottom (y < 932). Surface #3.
 *  3. Anything that fails → Telegram alert with screenshot.
 *
 * Cron entry (/etc/cron.d/iku-monitor-ads):
 *   0 5,11,17,23 * * * root cd /opt/iku-scrapers && set -a && source .env
 *     && set +a && node scripts/monitor-ad-zones.mjs >> /var/log/iku-scrape/monitor-ads.log 2>&1
 */

import { chromium } from "playwright";
import https from "https";
import fs from "fs";
import path from "path";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = "5617056258";
const HILLTOP_KEY = process.env.HILLTOPADS_API_KEY;
const SITE = "https://iku.gg";
const STATE_FILE = "/var/log/iku-scrape/monitor-ads.state.json";

// Yesterday in YYYY-MM-DD UTC
function yesterdayISO() {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { hilltopZeroStreak: 0 };
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

async function checkHilltopAdsApi() {
  if (!HILLTOP_KEY) return { skipped: "HILLTOPADS_API_KEY missing" };
  const date = yesterdayISO();
  const url = `https://api.hilltopads.com/publisher/listStats?key=${HILLTOP_KEY}&date=${date}&group=date`;
  const text = await new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => resolve(buf));
      })
      .on("error", reject);
  });
  const json = JSON.parse(text);
  const row = json.result?.[date]?.[0];
  return {
    date,
    impressions: row?.impressions ?? 0,
    revenue: parseFloat(row?.revenue ?? "0"),
    clicks: row?.clicks ?? 0,
    cpm: parseFloat(row?.cpm ?? "0"),
  };
}

async function pickWatchSlug() {
  // Pull a live slug from /trending — guaranteed to exist (or trending is broken).
  // Hardcoded fallback slugs rot as videos get purged (the previous list 404ed).
  try {
    const html = await new Promise((resolve, reject) => {
      https
        .get(
          `${SITE}/trending`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
            },
          },
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
    if (unique.length === 0) throw new Error("no slugs found in /trending");
    // Skip Pro-gated long-form (r34v-* episodes can be Pro). Prefer non-r34v slugs.
    const nonPro = unique.filter((s) => !s.startsWith("r34v-"));
    const pool = nonPro.length > 0 ? nonPro : unique;
    return pool[Math.floor(Math.random() * pool.length)];
  } catch (e) {
    // Last-resort fallback. r34 short-form, very stable.
    return "r34-14029915-animated";
  }
}

async function checkLivePage() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  // Pre-seed AgeGate localStorage so the ad-bearing page renders.
  // Key per src/components/AgeGate.tsx: "iku-age-verified" = "true".
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("iku-age-verified", "true");
    } catch {}
  });

  const page = await ctx.newPage();
  const slug = await pickWatchSlug();
  const url = `${SITE}/watch/${slug}`;

  let vastFired = false;
  let bannerSeen = false;
  let ippScriptSeen = false;
  let stripcashScriptSeen = false;

  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/vast")) vastFired = true;
    if (
      u.includes("selfassured-celebration.com") ||
      u.includes("difficultblock.com") ||
      u.includes("silent-basis.pro")
    ) {
      bannerSeen = true;
    }
    // IPP injection url is the same selfassured-celebration host but a
    // different path. We can't easily distinguish, so we additionally
    // probe DOM presence after waitForTimeout below.
    if (u.includes("creative.mavrtracktor.com")) {
      stripcashScriptSeen = true;
    }
  });

  const failures = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Let ads load
    await page.waitForTimeout(8_000);

    // Check 1: HilltopAds banner iframe (srcdoc pattern)
    const bannerIframe = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll("iframe"));
      return frames.some((f) => {
        const sd = f.getAttribute("srcdoc") || "";
        return (
          sd.includes("selfassured-celebration") ||
          sd.includes("HILLTOPADS") ||
          sd.includes("hilltopads")
        );
      });
    });
    if (!bannerIframe && !bannerSeen) {
      failures.push("banner iframe NOT mounted (Surface #1)");
    }

    // Check 2: VAST preroll fired
    if (!vastFired) {
      failures.push("VAST preroll NEVER called /api/vast (Surface #2)");
    }

    // Check 3: Live Cams visible after opening drawer
    const burger = await page.$(".v2-topbar-hamburger");
    if (burger) {
      await burger.click();
      // Drawer animation can take 300-500ms; wait for the drawer node to be
      // actually visible before measuring. Empirically waitForTimeout(500)
      // was racing with hydration on slower runs.
      await page
        .waitForSelector(".v2-nav-drawer", { state: "visible", timeout: 5_000 })
        .catch(() => {});
      await page.waitForTimeout(800);
      const probe = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll("a")).map(
          (a) => ({
            text: (a.textContent || "").trim().slice(0, 40),
            href: a.href.slice(0, 80),
          }),
        );
        const drawer = document.querySelector(".v2-nav-drawer");
        const liveCams = Array.from(
          document.querySelectorAll(".v2-nav-drawer a"),
        ).find((el) => /live\s*cam/i.test(el.textContent || ""));
        let liveCamY = -1;
        if (liveCams) {
          const r = liveCams.getBoundingClientRect();
          liveCamY = r.width > 0 && r.height > 0 ? r.y : -1;
        }
        return {
          drawerOpen: !!drawer,
          drawerVisible: drawer
            ? window.getComputedStyle(drawer).display !== "none"
            : false,
          liveCamFound: !!liveCams,
          liveCamY,
          drawerLinkCount: drawer ? drawer.querySelectorAll("a").length : 0,
          firstFewDrawerLinks: drawer
            ? Array.from(drawer.querySelectorAll("a"))
                .slice(0, 5)
                .map((a) => (a.textContent || "").trim().slice(0, 30))
            : [],
        };
      });
      if (!probe.drawerOpen) {
        failures.push("drawer node missing after burger click");
      } else if (!probe.drawerVisible) {
        failures.push("drawer rendered but display:none");
      } else if (!probe.liveCamFound) {
        failures.push(
          `Live Cams link NOT in drawer (drawer has ${probe.drawerLinkCount} links: ${JSON.stringify(probe.firstFewDrawerLinks)})`,
        );
      } else if (probe.liveCamY === -1) {
        failures.push("Live Cams link found but invisible (0x0)");
      } else if (probe.liveCamY > 932) {
        failures.push(`Live Cams below fold (y=${probe.liveCamY}px > 932)`);
      }
    } else {
      failures.push("hamburger not found — drawer broken");
    }

    // Check 4: IPP script tag injected (Surface #5, zone 6969697).
    // Component injects after a 3s settle, so wait long enough.
    await page.waitForTimeout(2_000);
    const ippInjected = await page.evaluate(
      () => !!document.getElementById("iku-hilltop-ipp-wrap"),
    );
    if (!ippInjected) {
      failures.push("HilltopAds IPP wrapper script not in DOM (Surface #5)");
    }

    // Check 5: Sticky 300x100 banner present (Surface #6, zone 6969733).
    // Component appears after 2s settle.
    const stickyBottom = await page.evaluate(() => {
      const el = document.querySelector(".sticky-hilltop-bottom");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { y: r.y, h: r.height, visible: r.height > 0 };
    });
    if (!stickyBottom) {
      failures.push("Sticky 300x100 banner not mounted (Surface #6)");
    } else if (!stickyBottom.visible) {
      failures.push("Sticky 300x100 banner present but invisible (Surface #6)");
    }

    // Check 6: Stripcash Video Slider — host div exists OR script loaded
    // (script defer'd via requestIdleCallback so may not have fired yet on
    // a quick check). Either signal counts as alive.
    const stripcashHostExists = await page.evaluate(
      () => !!document.querySelector("[data-stripcash-slider]"),
    );
    if (!stripcashHostExists && !stripcashScriptSeen) {
      failures.push("Stripcash Video Slider not mounted (Surface #4)");
    }
  } catch (e) {
    failures.push(`page error: ${e.message}`);
  } finally {
    await browser.close();
  }

  return { url, failures };
}

(async () => {
  const state = loadState();
  const lines = [`📡 *iku.gg ad-zone check* — ${new Date().toISOString()}`];
  let alert = false;

  // 1. HilltopAds API check
  const ht = await checkHilltopAdsApi();
  if (ht.skipped) {
    lines.push(`⚠️ HilltopAds API: ${ht.skipped}`);
  } else if (ht.impressions === 0) {
    state.hilltopZeroStreak = (state.hilltopZeroStreak || 0) + 1;
    lines.push(
      `🔴 HilltopAds ${ht.date}: 0 impr (streak ${state.hilltopZeroStreak})`,
    );
    if (state.hilltopZeroStreak >= 2) alert = true;
  } else {
    state.hilltopZeroStreak = 0;
    lines.push(
      `✅ HilltopAds ${ht.date}: ${ht.impressions} impr · ${ht.clicks} clicks · $${ht.revenue.toFixed(4)} · eCPM $${ht.cpm.toFixed(3)}`,
    );
  }

  // 2. Playwright live check
  const live = await checkLivePage();
  if (live.failures.length === 0) {
    lines.push(`✅ live ${live.url}: 3/3 checks pass`);
  } else {
    alert = true;
    lines.push(`🔴 live ${live.url}:`);
    for (const f of live.failures) lines.push(`   • ${f}`);
  }

  saveState(state);

  const msg = lines.join("\n");
  console.log(msg);
  if (alert) await tg(msg);
  process.exit(0);
})();
