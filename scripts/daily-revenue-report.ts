#!/usr/bin/env npx tsx
/**
 * scripts/daily-revenue-report.ts
 *
 * Daily revenue report for iku.gg — runs at 08:00 UTC via cron.
 * Queries Stripe (live) + PostgreSQL (live) for yesterday's data.
 * Placeholder functions for ExoClick/Adsterra/CrakRevenue/Chaturbate
 * APIs — fill in once API credentials are available.
 *
 * Usage:
 *   npx tsx scripts/daily-revenue-report.ts
 *   npx tsx scripts/daily-revenue-report.ts --dry-run   # print to console, no Telegram
 *   npx tsx scripts/daily-revenue-report.ts --today     # use today instead of yesterday
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY     — sk_live_...
 *   DATABASE_URL          — postgresql://...
 *   TELEGRAM_BOT_TOKEN    — Telegram bot token
 *
 * Optional env vars (fill when API access obtained):
 *   EXOCLICK_API_KEY      — ExoClick reporting API key
 *   ADSTERRA_API_KEY      — Adsterra publisher API key
 *   CRAKREVENUE_API_KEY   — CrakRevenue affiliate API token
 *   CHATURBATE_API_KEY    — Chaturbate affiliate API token
 *   CHATURBATE_USERNAME   — Chaturbate affiliate username (ikugg)
 *
 * Cron (Hetzner /etc/cron.d/iku-revenue):
 *   0 8 * * * root cd /opt/iku-scrapers && TELEGRAM_BOT_TOKEN=... STRIPE_SECRET_KEY=... DATABASE_URL=... npx tsx scripts/daily-revenue-report.ts >> /var/log/iku-revenue.log 2>&1
 */

import https from "https";
import { Pool } from "pg";

// ── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const USE_TODAY = process.argv.includes("--today");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = "5617056258";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const EXOCLICK_API_KEY = process.env.EXOCLICK_API_KEY;
const ADSTERRA_API_KEY = process.env.ADSTERRA_API_KEY;
const CRAKREVENUE_API_KEY = process.env.CRAKREVENUE_API_KEY;
const CHATURBATE_API_KEY = process.env.CHATURBATE_API_KEY;
const CHATURBATE_USERNAME = process.env.CHATURBATE_USERNAME || "ikugg";

// Stripe price IDs — must match Coolify env
const STRIPE_PRICES = {
  monthly: "price_1TIsKwE6BjkfAdXjZGpChcFW",
  yearly: "price_1TIsKwE6BjkfAdXjJnVBTmyC",
  lifetime: "price_1TIsKxE6BjkfAdXjuF7yu2KT",
};

// ── Date helpers ─────────────────────────────────────────────────────────────

function getReportDate(): {
  label: string;
  startEpoch: number;
  endEpoch: number;
  iso: string;
} {
  const now = new Date();
  const target = USE_TODAY
    ? now
    : new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
      );

  const year = target.getUTCFullYear();
  const month = String(target.getUTCMonth() + 1).padStart(2, "0");
  const day = String(target.getUTCDate()).padStart(2, "0");
  const iso = `${year}-${month}-${day}`;

  const startEpoch = Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000);
  const endEpoch = Math.floor(new Date(`${iso}T23:59:59Z`).getTime() / 1000);

  const label = USE_TODAY ? iso + " (today)" : iso;
  return { label, startEpoch, endEpoch, iso };
}

// ── Logging ──────────────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`  ${msg}`);
const section = (title: string) =>
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsGet(
  url: string,
  headers: Record<string, string> = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const reqOpts = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: "GET",
      headers: { "User-Agent": "iku.gg/revenue-report", ...headers },
    };
    const req = https.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.end();
  });
}

function httpsPost(
  url: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const buf = Buffer.from(body);
    const reqOpts = {
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": buf.length,
        "User-Agent": "iku.gg/revenue-report",
        ...headers,
      },
    };
    const req = https.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(buf);
    req.end();
  });
}

// ── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<void> {
  if (DRY_RUN) {
    console.log("\n── TELEGRAM MESSAGE (dry-run) " + "─".repeat(32));
    console.log(text.replace(/<[^>]+>/g, ""));
    console.log("─".repeat(62));
    return;
  }
  if (!TELEGRAM_BOT_TOKEN) {
    log("TELEGRAM_BOT_TOKEN not set — printing to console instead");
    console.log(text);
    return;
  }
  const payload = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
  });
  await httpsPost(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    payload,
    { "Content-Type": "application/json" },
  );
}

// ── Stripe ───────────────────────────────────────────────────────────────────
// Uses Stripe REST API directly (no npm package needed) to avoid a heavy dep.

interface StripeData {
  newSubs: number;
  revenue: number; // EUR cents → converted to EUR
  breakdown: { monthly: number; yearly: number; lifetime: number };
  mrr: number; // active MRR estimate in EUR
  activeSubs: number;
}

async function fetchStripeData(
  startEpoch: number,
  endEpoch: number,
): Promise<StripeData | null> {
  if (!STRIPE_SECRET_KEY) {
    log("STRIPE_SECRET_KEY not set — skipping Stripe");
    return null;
  }

  const auth = Buffer.from(`${STRIPE_SECRET_KEY}:`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  try {
    // 1. New subscriptions created yesterday
    const subsUrl =
      `https://api.stripe.com/v1/subscriptions?` +
      `created[gte]=${startEpoch}&created[lte]=${endEpoch}&limit=100&status=all`;
    const subsRaw = await httpsGet(subsUrl, headers);
    const subsJson = JSON.parse(subsRaw);

    // 2. One-time charges (lifetime) created yesterday
    const chargesUrl =
      `https://api.stripe.com/v1/payment_intents?` +
      `created[gte]=${startEpoch}&created[lte]=${endEpoch}&limit=100`;
    const chargesRaw = await httpsGet(chargesUrl, headers);
    const chargesJson = JSON.parse(chargesRaw);

    // 3. Active subscriptions (for MRR)
    const activeMrrUrl = `https://api.stripe.com/v1/subscriptions?status=active&limit=100`;
    const activeMrrRaw = await httpsGet(activeMrrUrl, headers);
    const activeMrrJson = JSON.parse(activeMrrRaw);

    let newSubs = 0;
    let revenue = 0;
    const breakdown = { monthly: 0, yearly: 0, lifetime: 0 };

    // Count new subscriptions created on the target day
    if (subsJson.data) {
      for (const sub of subsJson.data) {
        if (sub.status === "active" || sub.status === "trialing") {
          newSubs++;
          const priceId = sub.items?.data?.[0]?.price?.id;
          const amount = (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100;
          if (priceId === STRIPE_PRICES.monthly) {
            breakdown.monthly++;
            revenue += amount;
          } else if (priceId === STRIPE_PRICES.yearly) {
            breakdown.yearly++;
            revenue += amount;
          }
        }
      }
    }

    // Count lifetime purchases (succeeded payment_intents for lifetime price)
    if (chargesJson.data) {
      for (const pi of chargesJson.data) {
        if (pi.status === "succeeded" && pi.amount >= 6999) {
          // Lifetime is 69.99 EUR = 6999 cents
          breakdown.lifetime++;
          newSubs++;
          revenue += pi.amount / 100;
        }
      }
    }

    // MRR from active subscriptions
    let mrr = 0;
    let activeSubs = 0;
    if (activeMrrJson.data) {
      activeSubs = activeMrrJson.data.length;
      for (const sub of activeMrrJson.data) {
        const priceId = sub.items?.data?.[0]?.price?.id;
        const amount = (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100;
        if (priceId === STRIPE_PRICES.monthly) {
          mrr += amount;
        } else if (priceId === STRIPE_PRICES.yearly) {
          mrr += amount / 12; // normalize to monthly
        }
        // Lifetime = no MRR contribution
      }
    }

    return {
      newSubs,
      revenue,
      breakdown,
      mrr: Math.round(mrr * 100) / 100,
      activeSubs,
    };
  } catch (err) {
    log(`Stripe error: ${(err as Error).message}`);
    return null;
  }
}

// ── ExoClick ─────────────────────────────────────────────────────────────────
// ExoClick Statistics API v2 (publisher side).
// Step 1: POST /v2/login  { api_token } → { token, expires_in }
// Step 2: GET  /v2/statistics/p/date?date-from=...&date-to=...  (Bearer <token>)
// Response row: { ddate, impressions, clicks, video_hits, value, revenue }
// `revenue` is already in dollars (value/100). Use it directly.

interface ExoClickData {
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

async function exoclickLogin(): Promise<string | null> {
  if (!EXOCLICK_API_KEY) return null;
  try {
    const raw = await httpsPost(
      "https://api.exoclick.com/v2/login",
      JSON.stringify({ api_token: EXOCLICK_API_KEY }),
    );
    const json = JSON.parse(raw);
    return json?.token ?? null;
  } catch (err) {
    log(`ExoClick login error: ${(err as Error).message}`);
    return null;
  }
}

async function fetchExoClickData(
  dateIso: string,
): Promise<ExoClickData | null> {
  if (!EXOCLICK_API_KEY) {
    log("EXOCLICK_API_KEY not set — skipping ExoClick");
    return null;
  }

  try {
    const token = await exoclickLogin();
    if (!token) return null;

    const url =
      `https://api.exoclick.com/v2/statistics/p/date?` +
      `date-from=${dateIso}&date-to=${dateIso}`;

    const raw = await httpsGet(url, {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    });

    const json = JSON.parse(raw);
    const row = (json?.result ?? [])[0] ?? {};

    return {
      revenue: parseFloat(row.revenue ?? "0"),
      impressions: parseInt(row.impressions ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
      ctr: parseFloat(row.ctr ?? "0"),
    };
  } catch (err) {
    log(`ExoClick error: ${(err as Error).message}`);
    return null;
  }
}

// ── Adsterra ─────────────────────────────────────────────────────────────────
// Adsterra Publisher API (beta.publishers.adsterra.com → Profile → API).
// GET https://api3.adsterratools.com/publisher/stats.json
//   ?start_date=YYYY-MM-DD&finish_date=YYYY-MM-DD&group_by=date
// Header: X-API-Key: <API_KEY>
// Row: { date, impression, clicks, ctr, cpm, revenue }

interface AdsterraData {
  revenue: number;
  impressions: number;
  clicks: number;
}

async function fetchAdsterraData(
  dateIso: string,
): Promise<AdsterraData | null> {
  if (!ADSTERRA_API_KEY) {
    log("ADSTERRA_API_KEY not set — skipping Adsterra");
    return null;
  }

  try {
    const url =
      `https://api3.adsterratools.com/publisher/stats.json?` +
      `start_date=${dateIso}&finish_date=${dateIso}&group_by=date`;

    const raw = await httpsGet(url, {
      "X-API-Key": ADSTERRA_API_KEY,
      Accept: "application/json",
    });

    const json = JSON.parse(raw);
    const row = json?.items?.[0] ?? {};

    return {
      revenue: parseFloat(row.revenue ?? "0"),
      impressions: parseInt(row.impression ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
    };
  } catch (err) {
    log(`Adsterra error: ${(err as Error).message}`);
    return null;
  }
}

// ── CrakRevenue ───────────────────────────────────────────────────────────────
// CrakRevenue Affiliate API
// Endpoint: GET https://api.crakrevenue.com/v1/affiliate/reports/summary
// Requires: api_token query param or Authorization header
// API key location: affiliates.crakrevenue.com → My Account → API

interface CrakRevenueData {
  revenue: number;
  conversions: number;
  clicks: number;
}

async function fetchCrakRevenueData(
  dateIso: string,
): Promise<CrakRevenueData | null> {
  if (!CRAKREVENUE_API_KEY) {
    log("CRAKREVENUE_API_KEY not set — skipping CrakRevenue");
    return null;
  }

  try {
    // CrakRevenue reporting API
    // Docs: https://affiliates.crakrevenue.com/affiliate/account.php (API section)
    const url =
      `https://api.crakrevenue.com/v1/affiliate/reports/daily?` +
      `api_token=${CRAKREVENUE_API_KEY}&start_date=${dateIso}&end_date=${dateIso}`;

    const raw = await httpsGet(url, { Accept: "application/json" });
    const json = JSON.parse(raw);

    // Response: { data: [{ payout, conversions, clicks }] }
    const row = json?.data?.[0] ?? json?.result?.[0] ?? {};

    return {
      revenue: parseFloat(row.payout ?? row.revenue ?? "0"),
      conversions: parseInt(row.conversions ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
    };
  } catch (err) {
    log(`CrakRevenue error: ${(err as Error).message}`);
    return null;
  }
}

// ── Chaturbate ────────────────────────────────────────────────────────────────
// Chaturbate Affiliate API
// Endpoint: GET https://chaturbate.com/affiliates/api/stats/
// Requires: username + affiliate_token
// API key location: chaturbate.com → Affiliates → Promo Tools → API

interface ChaturbateData {
  revenue: number;
  signups: number;
  clicks: number;
}

async function fetchChaturbateData(
  dateIso: string,
): Promise<ChaturbateData | null> {
  if (!CHATURBATE_API_KEY) {
    log("CHATURBATE_API_KEY not set — skipping Chaturbate");
    return null;
  }

  try {
    // Chaturbate affiliate stats API
    // Docs: https://chaturbate.com/affiliates/payout_guide/ (API section)
    const url =
      `https://chaturbate.com/affiliates/api/stats/?` +
      `username=${CHATURBATE_USERNAME}&token=${CHATURBATE_API_KEY}` +
      `&start_date=${dateIso}&end_date=${dateIso}&format=json`;

    const raw = await httpsGet(url, { Accept: "application/json" });
    const json = JSON.parse(raw);

    // Response structure varies — adapt once we have real API access
    const row = json?.data?.[0] ?? json?.results?.[0] ?? json ?? {};

    return {
      revenue: parseFloat(row.revenue ?? row.earnings ?? "0"),
      signups: parseInt(row.signups ?? row.registrations ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
    };
  } catch (err) {
    log(`Chaturbate error: ${(err as Error).message}`);
    return null;
  }
}

// ── PostgreSQL stats ──────────────────────────────────────────────────────────

interface PgStats {
  totalVideos: number;
  todayViews: number | null; // null if user_history table doesn't have a created_at index
  topCountries: Array<{ country: string; pct: number }> | null;
}

async function fetchPgStats(
  startEpoch: number,
  endEpoch: number,
): Promise<PgStats | null> {
  if (!DATABASE_URL) {
    log("DATABASE_URL not set — skipping PostgreSQL stats");
    return null;
  }

  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

  try {
    // Total video count (always available)
    const countRes = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM videos",
    );
    const totalVideos = parseInt(countRes.rows[0]?.count ?? "0", 10);

    // Page views for the day — from user_history table if it exists and has timestamps
    // user_history: { user_id, video_slug, watched_at }
    let todayViews: number | null = null;
    try {
      const startTs = new Date(startEpoch * 1000).toISOString();
      const endTs = new Date(endEpoch * 1000).toISOString();
      const viewsRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM user_history
         WHERE watched_at >= $1 AND watched_at <= $2`,
        [startTs, endTs],
      );
      todayViews = parseInt(viewsRes.rows[0]?.count ?? "0", 10);
    } catch {
      // Table may not exist or column name different — skip silently
      todayViews = null;
    }

    await pool.end();
    return { totalVideos, todayViews, topCountries: null };
  } catch (err) {
    log(`PostgreSQL error: ${(err as Error).message}`);
    try {
      await pool.end();
    } catch {}
    return null;
  }
}

// ── Load yesterday's snapshot for trend comparison ────────────────────────────

interface Snapshot {
  date: string;
  totalRevenue: number;
}

function loadYesterdaySnapshot(): Snapshot | null {
  // Snapshots are stored in /tmp/iku-revenue-snapshot.json on the server
  // so they persist between cron runs but are reset on reboot (acceptable).
  try {
    // Dynamic import of fs to keep Node.js compatibility
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const snapshotPath = path.join("/tmp", "iku-revenue-snapshot.json");
    if (!fs.existsSync(snapshotPath)) return null;
    const raw = fs.readFileSync(snapshotPath, "utf-8");
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

function saveSnapshot(date: string, totalRevenue: number): void {
  try {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const snapshotPath = path.join("/tmp", "iku-revenue-snapshot.json");
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify({ date, totalRevenue }),
      "utf-8",
    );
  } catch {
    // non-critical
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function eur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function numK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function trendArrow(current: number, previous: number): string {
  if (previous === 0) return "NEW";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs yesterday`;
}

// ── Build report message ──────────────────────────────────────────────────────

interface AllData {
  date: { label: string; iso: string };
  stripe: StripeData | null;
  exoclick: ExoClickData | null;
  adsterra: AdsterraData | null;
  crakrevenue: CrakRevenueData | null;
  chaturbate: ChaturbateData | null;
  pg: PgStats | null;
}

function buildMessage(data: AllData): string {
  const { date, stripe, exoclick, adsterra, crakrevenue, chaturbate, pg } =
    data;

  const lines: string[] = [];

  lines.push(`<b>📊 iku.gg Revenue Report — ${date.label}</b>`);
  lines.push("");

  // ExoClick
  if (exoclick) {
    const detail = `${numK(exoclick.impressions)} impr, ${numK(exoclick.clicks)} clicks`;
    lines.push(`💰 <b>ExoClick:</b> ${eur(exoclick.revenue)} (${detail})`);
  } else {
    lines.push(`💰 <b>ExoClick:</b> N/A — set EXOCLICK_API_KEY`);
  }

  // Adsterra
  if (adsterra) {
    lines.push(
      `💰 <b>Adsterra:</b> ${eur(adsterra.revenue)} (${numK(adsterra.impressions)} impr)`,
    );
  } else {
    lines.push(`💰 <b>Adsterra:</b> N/A — set ADSTERRA_API_KEY`);
  }

  // Stripe
  if (stripe) {
    const parts: string[] = [];
    if (stripe.breakdown.monthly > 0)
      parts.push(`${stripe.breakdown.monthly}×monthly`);
    if (stripe.breakdown.yearly > 0)
      parts.push(`${stripe.breakdown.yearly}×yearly`);
    if (stripe.breakdown.lifetime > 0)
      parts.push(`${stripe.breakdown.lifetime}×lifetime`);
    const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    lines.push(
      `💰 <b>Stripe Pro:</b> ${stripe.newSubs} new subs${detail}, ${eur(stripe.revenue)} new revenue`,
    );
    lines.push(
      `   MRR: ${eur(stripe.mrr)} | Active subs: ${stripe.activeSubs}`,
    );
  } else {
    lines.push(`💰 <b>Stripe Pro:</b> N/A — set STRIPE_SECRET_KEY`);
  }

  // CrakRevenue
  if (crakrevenue) {
    lines.push(
      `💰 <b>CrakRevenue:</b> ${eur(crakrevenue.revenue)} (${crakrevenue.conversions} conversions)`,
    );
  } else {
    lines.push(`💰 <b>CrakRevenue:</b> N/A — set CRAKREVENUE_API_KEY`);
  }

  // Chaturbate
  if (chaturbate) {
    lines.push(
      `💰 <b>Chaturbate:</b> ${eur(chaturbate.revenue)} (${chaturbate.signups} signups)`,
    );
  } else {
    lines.push(`💰 <b>Chaturbate:</b> N/A — set CHATURBATE_API_KEY`);
  }

  lines.push("");

  // Total
  const total =
    (exoclick?.revenue ?? 0) +
    (adsterra?.revenue ?? 0) +
    (stripe?.revenue ?? 0) +
    (crakrevenue?.revenue ?? 0) +
    (chaturbate?.revenue ?? 0);

  lines.push(`📈 <b>Total: ${eur(total)}</b>`);

  // Trend
  const yesterday = loadYesterdaySnapshot();
  if (yesterday && yesterday.date !== date.iso) {
    lines.push(`📊 Trend: ${trendArrow(total, yesterday.totalRevenue)}`);
  }

  lines.push("");

  // Page views (from PostgreSQL user_history)
  if (pg) {
    if (pg.todayViews !== null) {
      lines.push(`👁️ Page views: ${numK(pg.todayViews)}`);
    }
    lines.push(`🎬 Total videos: ${numK(pg.totalVideos)}`);
  }

  // Top countries — placeholder until we have analytics API
  // PostHog has this data but requires REST API call; add when POSTHOG_PERSONAL_API_KEY is available
  lines.push(`🌍 Top countries: set POSTHOG_PERSONAL_API_KEY to enable`);

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const reportDate = getReportDate();

  section("iku.gg Daily Revenue Report");
  log(`Date: ${reportDate.label}`);
  log(`Dry run: ${DRY_RUN}`);

  section("Fetching data");

  const [stripe, exoclick, adsterra, crakrevenue, chaturbate, pg] =
    await Promise.allSettled([
      fetchStripeData(reportDate.startEpoch, reportDate.endEpoch),
      fetchExoClickData(reportDate.iso),
      fetchAdsterraData(reportDate.iso),
      fetchCrakRevenueData(reportDate.iso),
      fetchChaturbateData(reportDate.iso),
      fetchPgStats(reportDate.startEpoch, reportDate.endEpoch),
    ]);

  const data: AllData = {
    date: { label: reportDate.label, iso: reportDate.iso },
    stripe: stripe.status === "fulfilled" ? stripe.value : null,
    exoclick: exoclick.status === "fulfilled" ? exoclick.value : null,
    adsterra: adsterra.status === "fulfilled" ? adsterra.value : null,
    crakrevenue: crakrevenue.status === "fulfilled" ? crakrevenue.value : null,
    chaturbate: chaturbate.status === "fulfilled" ? chaturbate.value : null,
    pg: pg.status === "fulfilled" ? pg.value : null,
  };

  log(
    `Stripe: ${data.stripe ? `${data.stripe.newSubs} new subs, ${eur(data.stripe.revenue)}` : "N/A"}`,
  );
  log(`ExoClick: ${data.exoclick ? eur(data.exoclick.revenue) : "N/A"}`);
  log(`Adsterra: ${data.adsterra ? eur(data.adsterra.revenue) : "N/A"}`);
  log(
    `CrakRevenue: ${data.crakrevenue ? eur(data.crakrevenue.revenue) : "N/A"}`,
  );
  log(`Chaturbate: ${data.chaturbate ? eur(data.chaturbate.revenue) : "N/A"}`);

  section("Sending Telegram");

  const message = buildMessage(data);
  await sendTelegram(message);

  // Save snapshot for tomorrow's trend comparison
  const total =
    (data.exoclick?.revenue ?? 0) +
    (data.adsterra?.revenue ?? 0) +
    (data.stripe?.revenue ?? 0) +
    (data.crakrevenue?.revenue ?? 0) +
    (data.chaturbate?.revenue ?? 0);

  saveSnapshot(reportDate.iso, total);

  log("Done.");
}

main().catch(async (err) => {
  console.error("CRASH:", err);
  await sendTelegram(
    `<b>💥 Revenue Report CRASH</b>\n${(err as Error).message}\n\nCheck /var/log/iku-revenue.log`,
  ).catch(() => {});
  process.exit(1);
});
