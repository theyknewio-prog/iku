#!/usr/bin/env node
/**
 * health-check.mjs
 *
 * Fast realtime health probe. Runs every 5 min via cron and fires a
 * Telegram alert if any of these conditions are true:
 *
 *   - Homepage TTFB > 1.5s (median of 3 samples) — server slow
 *   - /watch/hc-37809 TTFB > 2.5s                — hentaicity playback slow
 *   - /api/health returns non-200                 — app down
 *   - /api/health uptime < 120s                   — app just crashed/restarted
 *   - PG active queries > 15                      — queries piling up
 *   - Any scraper cron log mentions "FATAL" or "FAIL" in last 6h
 *
 * State (last alert sent, dedupe) lives in /var/lib/iku-health-state.json
 * so we don't spam Telegram with the same alert every 5 min — re-fires
 * only if the incident keeps happening past a 30-min cooldown.
 *
 * Required env vars (loaded from /opt/iku-scrapers/.env):
 *   TELEGRAM_BOT_TOKEN
 *
 * Cron (Hetzner /etc/cron.d/iku-health or crontab):
 *   star/5 * * * * cd /opt/iku-scrapers && set -a && source .env && set +a && node scripts/health-check.mjs >> /var/log/iku-health.log 2>&1
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const STATE_PATH = "/var/lib/iku-health-state.json";
const COOLDOWN_MS = 30 * 60 * 1000; // 30 min per-alert dedupe

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = "5617056258";

const URLS = {
  home: "https://iku.gg/",
  watchHC:
    "https://iku.gg/watch/hc-37809-anal-mania-otaku-and-a-lady-who-loves-anal-play-1-busty-idol-pops-balls-out-of-h",
  health: "https://iku.gg/api/health",
};

const THRESHOLDS = {
  homeTtfbMs: 1500,
  watchTtfbMs: 2500,
  minUptimeAfterRestartSec: 120,
  pgActiveQueries: 15,
};

// ── State persistence ───────────────────────────────────────────────

function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}
function saveState(s) {
  try {
    writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
  } catch (err) {
    console.error("state save:", err.message);
  }
}

// ── Probe helpers ───────────────────────────────────────────────────

async function fetchTtfb(url, samples = 3) {
  const ttfbs = [];
  let status = 0;
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "iku-health/1.0",
          "Cache-Control": "no-cache",
        },
      });
      ttfbs.push(Math.round(performance.now() - t0));
      status = r.status;
      await r.arrayBuffer();
    } catch (err) {
      return { median: null, status: 0, error: err.message };
    }
  }
  ttfbs.sort((a, b) => a - b);
  return {
    median: ttfbs[Math.floor(ttfbs.length / 2)],
    status,
    samples: ttfbs,
  };
}

async function fetchHealth() {
  try {
    const r = await fetch(URLS.health, {
      headers: { "User-Agent": "iku-health/1.0" },
    });
    if (!r.ok) return { ok: false, status: r.status };
    const j = await r.json();
    return {
      ok: true,
      uptimeSec: Math.round(j.uptime || 0),
      heapUsedMB: j.memory?.heapUsedMB,
      rssMB: j.memory?.rssMB,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function pgActiveQueryCount() {
  try {
    const out = execSync(
      `docker exec iku-postgres psql -U iku -d iku -tAc "SELECT count(*) FROM pg_stat_activity WHERE state='active'" 2>/dev/null`,
      { encoding: "utf8", timeout: 5000 },
    );
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return -1;
  }
}

function recentScraperFailures() {
  try {
    const sixHours = 6 * 3600;
    const logs = [
      "/var/log/iku-scrape/scrape.log",
      "/var/log/iku-scrape-hentaicity.log",
      "/var/log/iku-scrape-hentaigasm.log",
    ];
    const failures = [];
    for (const log of logs) {
      if (!existsSync(log)) continue;
      const content = readFileSync(log, "utf8");
      const lastLines = content.split("\n").slice(-50).join("\n");
      if (/FATAL|FAIL|ECONNREFUSED/.test(lastLines)) {
        failures.push(log.split("/").pop());
      }
    }
    return failures;
  } catch {
    return [];
  }
}

// ── Telegram ────────────────────────────────────────────────────────

async function tg(text) {
  if (!TG_TOKEN) {
    console.log("[NO TOKEN]", text);
    return;
  }
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
    );
    const j = await r.json();
    if (!j.ok) console.error("tg err", j);
  } catch (err) {
    console.error("tg send:", err.message);
  }
}

function shouldAlert(state, key) {
  const now = Date.now();
  const last = state[key]?.lastSent || 0;
  if (now - last < COOLDOWN_MS) return false;
  state[key] = { lastSent: now };
  return true;
}

// ── Main ────────────────────────────────────────────────────────────

(async () => {
  const state = loadState();
  const alerts = [];

  // 1. Homepage TTFB
  const home = await fetchTtfb(URLS.home);
  if (home.median == null) {
    if (shouldAlert(state, "home-down"))
      alerts.push(`🔴 *Homepage DOWN* — ${home.error || "no response"}`);
  } else if (home.median > THRESHOLDS.homeTtfbMs) {
    if (shouldAlert(state, "home-slow"))
      alerts.push(
        `🟡 *Homepage slow* — TTFB median ${home.median}ms > ${THRESHOLDS.homeTtfbMs}ms (samples ${home.samples.join("/")})`,
      );
  }

  // 2. Watch page TTFB
  const watch = await fetchTtfb(URLS.watchHC);
  if (watch.median == null) {
    if (shouldAlert(state, "watch-down"))
      alerts.push(
        `🔴 *Hentaicity watch DOWN* — ${watch.error || "no response"}`,
      );
  } else if (watch.median > THRESHOLDS.watchTtfbMs) {
    if (shouldAlert(state, "watch-slow"))
      alerts.push(
        `🟡 *Watch page slow* — TTFB median ${watch.median}ms > ${THRESHOLDS.watchTtfbMs}ms`,
      );
  }

  // 3. Health endpoint
  const h = await fetchHealth();
  if (!h.ok) {
    if (shouldAlert(state, "health-fail"))
      alerts.push(
        `🔴 *API /health fail* — status ${h.status || "error"} ${h.error || ""}`,
      );
  } else if (
    h.uptimeSec != null &&
    h.uptimeSec < THRESHOLDS.minUptimeAfterRestartSec
  ) {
    if (shouldAlert(state, "app-restart"))
      alerts.push(
        `🟠 *App recently restarted* — uptime ${h.uptimeSec}s · heap ${h.heapUsedMB}MB · rss ${h.rssMB}MB`,
      );
  }

  // 4. PG active queries
  const pg = pgActiveQueryCount();
  if (pg > THRESHOLDS.pgActiveQueries) {
    if (shouldAlert(state, "pg-saturation"))
      alerts.push(
        `🟡 *PG queries piling up* — ${pg} active > ${THRESHOLDS.pgActiveQueries} threshold`,
      );
  } else if (pg === -1) {
    if (shouldAlert(state, "pg-unreachable"))
      alerts.push(`🔴 *iku-postgres unreachable via docker exec*`);
  }

  // 5. Scraper failures
  const failures = recentScraperFailures();
  if (failures.length > 0 && shouldAlert(state, "scraper-fail")) {
    alerts.push(`🟡 *Scraper errors* in: ${failures.join(", ")}`);
  }

  // Send alerts if any
  if (alerts.length > 0) {
    const msg = [
      "*⚠️ iku.gg health alert*",
      "",
      ...alerts,
      "",
      `_${new Date().toISOString()}_`,
    ].join("\n");
    await tg(msg);
    console.log("ALERTS:", alerts.length);
  } else {
    console.log(
      `[${new Date().toISOString().slice(0, 19)}] OK home=${home.median}ms watch=${watch.median}ms uptime=${h.uptimeSec}s pg=${pg}`,
    );
  }

  saveState(state);
})();
