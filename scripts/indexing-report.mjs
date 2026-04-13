#!/usr/bin/env node
/**
 * indexing-report.mjs — Daily Telegram report on indexing activity.
 *
 * Aggregates the local "submitted" trackers from:
 *   - data/submitted-indexnow.json (Bing+Yandex+Seznam push)
 *   - data/submitted-urls.json (Google Indexing API)
 *
 * Then queries GSC for the last 3 days of impressions/clicks to give
 * Sab a quick "is the indexing actually working" pulse via Telegram.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... node scripts/indexing-report.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = "5617056258"; // Sab
const KEY_PATH = resolve(ROOT, "gsc-service-account.json");
const SITE_URL = "sc-domain:iku.gg";

function loadJson(path) {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
}

function countSubmittedSince(map, ms) {
  const cutoff = Date.now() - ms;
  return Object.values(map).filter((t) => Number(t) > cutoff).length;
}

function countSubmittedTotal(map) {
  return Object.keys(map).length;
}

async function fetchGsc() {
  if (!existsSync(KEY_PATH)) return null;
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const sc = google.searchconsole({ version: "v1", auth: await auth.getClient() });
    const end = new Date();
    end.setDate(end.getDate() - 3);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const { data } = await sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: [],
        rowLimit: 1,
      },
    });
    const row = data.rows?.[0];
    return {
      clicks: Math.round(row?.clicks || 0),
      impressions: Math.round(row?.impressions || 0),
      ctr: ((row?.ctr || 0) * 100).toFixed(2),
      position: (row?.position || 0).toFixed(1),
      window: `${fmt(start)} → ${fmt(end)}`,
    };
  } catch (err) {
    console.error("GSC fetch failed:", err.message);
    return null;
  }
}

function sendTelegram(text) {
  if (!TELEGRAM_TOKEN) {
    console.log("(no TELEGRAM_BOT_TOKEN, skipping send — would have sent:)");
    console.log(text);
    return Promise.resolve();
  }
  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
  return new Promise((resolve) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "api.telegram.org",
        path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10_000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on("error", () => resolve(0));
    req.on("timeout", () => { req.destroy(); resolve(0); });
    req.write(body);
    req.end();
  });
}

async function main() {
  const indexnow = loadJson(resolve(ROOT, "data/submitted-indexnow.json"));
  const google = loadJson(resolve(ROOT, "data/submitted-urls.json"));

  const indexnowDay = countSubmittedSince(indexnow, 86400_000);
  const indexnowWeek = countSubmittedSince(indexnow, 7 * 86400_000);
  const indexnowTotal = countSubmittedTotal(indexnow);

  const googleDay = countSubmittedSince(google, 86400_000);
  const googleWeek = countSubmittedSince(google, 7 * 86400_000);
  const googleTotal = countSubmittedTotal(google);

  const gsc = await fetchGsc();

  let msg = `📊 *iku.gg indexing — daily*\n\n`;
  msg += `*IndexNow* (Bing + Yandex + Seznam)\n`;
  msg += `  · 24h: ${indexnowDay}\n`;
  msg += `  · 7d:  ${indexnowWeek}\n`;
  msg += `  · all: ${indexnowTotal}\n\n`;
  msg += `*Google Indexing API*\n`;
  msg += `  · 24h: ${googleDay}\n`;
  msg += `  · 7d:  ${googleWeek}\n`;
  msg += `  · all: ${googleTotal}\n\n`;
  if (gsc) {
    msg += `*GSC last 7d* (${gsc.window})\n`;
    msg += `  · ${gsc.clicks} clicks · ${gsc.impressions} impressions\n`;
    msg += `  · CTR ${gsc.ctr}% · pos ${gsc.position}\n`;
  } else {
    msg += `_GSC fetch failed or service-account not present._\n`;
  }

  console.log(msg);
  await sendTelegram(msg);
}

main().catch((err) => {
  console.error("indexing-report failed:", err);
  process.exit(1);
});
