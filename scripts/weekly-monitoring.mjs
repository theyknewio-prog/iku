#!/usr/bin/env node
/**
 * scripts/weekly-monitoring.mjs
 *
 * Weekly digest: Core Web Vitals (PageSpeed Insights) + Indexation (Google
 * Search Console) + ExoClick last-7-days revenue → Telegram.
 *
 * Runs on the Hetzner server, cron 0 10 * * 1 (every Monday at 10:00 UTC).
 *
 * Required env vars (loaded from /opt/iku-scrapers/.env):
 *   TELEGRAM_BOT_TOKEN    — Telegram bot token
 *   EXOCLICK_API_KEY      — ExoClick publisher API key
 *   GOOGLE_APPLICATION_CREDENTIALS — path to GSC service account JSON (optional)
 *
 * No external deps — uses Node built-ins + node-fetch-compatible undici.
 */

import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = "5617056258";
const EXOCLICK_API_KEY = process.env.EXOCLICK_API_KEY;
const GSC_SITE_URL = "sc-domain:iku.gg";
const GSC_SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || "/opt/iku-scrapers/gsc-service-account.json";

const DRY_RUN = process.argv.includes("--dry-run");

/* ── Real TTFB + cache HIT check (no API needed) ─────────────────── */

async function fetchProdHealth(url) {
  // 3 sequential samples to smooth out CDN warmups
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, { method: "GET", headers: { "User-Agent": "iku-monitor/1.0" } });
      const ttfb = Math.round(performance.now() - t0);
      samples.push({
        ttfb,
        status: r.status,
        cache: r.headers.get("x-nextjs-cache") || "—",
        cfCache: r.headers.get("cf-cache-status") || "—",
        contentType: r.headers.get("content-type")?.split(";")[0] || "?",
      });
      await r.arrayBuffer(); // drain body
    } catch (err) {
      samples.push({ ttfb: null, status: 0, error: err.message });
    }
  }
  const ok = samples.filter((s) => s.status === 200);
  if (ok.length === 0) return { url, status: "down", samples };
  const ttfbs = ok.map((s) => s.ttfb).sort((a, b) => a - b);
  const median = ttfbs[Math.floor(ttfbs.length / 2)];
  return {
    url,
    status: ok[0].status,
    medianTtfb: median,
    minTtfb: Math.min(...ttfbs),
    maxTtfb: Math.max(...ttfbs),
    cache: ok[ok.length - 1].cache,
    cfCache: ok[ok.length - 1].cfCache,
  };
}

/* ── GSC indexation count via service account JWT ───────────────── */

async function getGscAccessToken() {
  try {
    const raw = await readFile(GSC_SA_PATH, "utf8");
    const sa = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })).toString("base64url");
    const signInput = `${header}.${claims}`;
    const sig = createSign("RSA-SHA256").update(signInput).sign(sa.private_key, "base64url");
    const jwt = `${signInput}.${sig}`;
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const d = await r.json();
    return d.access_token;
  } catch (err) {
    console.error("[gsc] auth:", err.message);
    return null;
  }
}

async function fetchGscStats() {
  const token = await getGscAccessToken();
  if (!token) return null;
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86400 * 1000);
  const body = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    dimensions: [],
    rowLimit: 1,
  };
  try {
    const r = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const row = d.rows?.[0];
    return row
      ? { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }
      : { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  } catch (err) {
    console.error("[gsc] stats:", err.message);
    return null;
  }
}

/* ── ExoClick last 7 days revenue ──────────────────────────────── */

async function fetchExoClick() {
  if (!EXOCLICK_API_KEY) return null;
  try {
    const loginR = await fetch("https://api.exoclick.com/v2/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_token: EXOCLICK_API_KEY }),
    });
    const loginD = await loginR.json();
    const token = loginD.token;
    if (!token) return null;

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400 * 1000);
    const df = start.toISOString().slice(0, 10);
    const dt = end.toISOString().slice(0, 10);

    const r = await fetch(
      `https://api.exoclick.com/v2/statistics/publisher/zone?date-from=${df}&date-to=${dt}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d = await r.json();
    const zones = Array.isArray(d.result) ? d.result : [];
    const total = zones.reduce((s, z) => s + (z.revenue || 0), 0);
    const impressions = zones.reduce((s, z) => s + (z.impressions || 0), 0);
    return { total, impressions, zones: zones.length };
  } catch (err) {
    console.error("[exoclick]:", err.message);
    return null;
  }
}

/* ── Telegram send ─────────────────────────────────────────────── */

async function sendTelegram(text) {
  if (DRY_RUN) {
    console.log("── DRY RUN ──\n" + text);
    return;
  }
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not set");
    return;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    const d = await r.json();
    if (!d.ok) console.error("tg error:", d);
  } catch (err) {
    console.error("tg send:", err.message);
  }
}

/* ── Main ──────────────────────────────────────────────────────── */

const URLS_TO_CHECK = [
  "https://iku.gg/",
  "https://iku.gg/watch/r34-14029915-1boy",
  "https://iku.gg/tag/animated",
];

function ttfbGrade(ms) {
  if (ms == null) return "⚫";
  if (ms <= 500) return "🟢";
  if (ms <= 1500) return "🟡";
  return "🔴";
}

(async () => {
  console.log("── weekly monitoring ──");

  const [health1, health2, health3, gsc, exo] = await Promise.all([
    fetchProdHealth(URLS_TO_CHECK[0]),
    fetchProdHealth(URLS_TO_CHECK[1]),
    fetchProdHealth(URLS_TO_CHECK[2]),
    fetchGscStats(),
    fetchExoClick(),
  ]);

  const parts = ["*📊 iku.gg weekly digest*", ""];

  parts.push("*Prod health (TTFB median, 3 samples)*");
  for (const r of [health1, health2, health3]) {
    if (!r || r.status === "down") { parts.push("• 🔴 _down_"); continue; }
    const path = r.url.replace("https://iku.gg", "") || "/";
    const cacheStatus = r.cache === "HIT" ? "⚡ISR" : r.cfCache === "HIT" ? "⚡CF" : "miss";
    parts.push(`${ttfbGrade(r.medianTtfb)} \`${path}\` — ${r.medianTtfb}ms (min ${r.minTtfb}, max ${r.maxTtfb}) · ${cacheStatus}`);
  }
  parts.push("");

  parts.push("*Google Search Console (7d)*");
  if (gsc) {
    parts.push(`• Clicks: *${gsc.clicks}*`);
    parts.push(`• Impressions: *${gsc.impressions.toLocaleString()}*`);
    parts.push(`• CTR: ${(gsc.ctr * 100).toFixed(2)}%`);
    parts.push(`• Avg position: ${gsc.position.toFixed(1)}`);
  } else {
    parts.push("_unavailable — GSC service account missing?_");
  }
  parts.push("");

  parts.push("*ExoClick revenue (7d)*");
  if (exo) {
    parts.push(`• Total: *$${exo.total.toFixed(4)}*`);
    parts.push(`• Impressions: ${exo.impressions.toLocaleString()}`);
    parts.push(`• Zones: ${exo.zones}`);
  } else {
    parts.push("_unavailable_");
  }

  const text = parts.join("\n");
  console.log(text);
  await sendTelegram(text);
})();
