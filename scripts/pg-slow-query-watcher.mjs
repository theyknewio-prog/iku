#!/usr/bin/env node
/**
 * pg-slow-query-watcher.mjs
 *
 * Polls pg_stat_activity for queries running >500ms on iku-postgres.
 * Pings Telegram if any found (deduped 10min per query hash so we don't spam).
 *
 * Runs on Hetzner via cron every 5min:
 *   star/5 * * * * /usr/bin/node /opt/iku-scrapers/pg-slow-query-watcher.mjs
 *
 * Env (loaded from /opt/iku-scrapers/.env):
 *   DATABASE_URL, TELEGRAM_BOT_TOKEN_IKU
 */
import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const CHAT_ID = "5617056258";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN_IKU;
// Script runs on the Hetzner host, not inside the Docker network — rewrite
// the `iku-postgres` hostname (only resolvable inside Docker) to 127.0.0.1,
// which is where the container's 5432 port is bound.
const DATABASE_URL = (process.env.DATABASE_URL || "").replace(
  "@iku-postgres:",
  "@127.0.0.1:",
);
const STATE_FILE = "/tmp/pg-slow-watcher.json";
const WARN_MS = 500;
const CRIT_MS = 2000;
const DEDUPE_MS = 10 * 60 * 1000;

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch {
    return { lastAlerts: {} };
  }
}

async function saveState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state));
}

function hash(q) {
  // normalize query text: collapse whitespace + lowercase + strip quoted strings
  const normalized = q
    .replace(/'[^']*'/g, "'?'")
    .replace(/\$\d+/g, "$?")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
  return createHash("sha1").update(normalized).digest("hex").slice(0, 12);
}

async function tg(text) {
  if (!TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("tg fail", e.message);
  }
}

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(`
    SELECT
      pid,
      EXTRACT(EPOCH FROM (now() - query_start)) * 1000 AS duration_ms,
      state,
      query
    FROM pg_stat_activity
    WHERE state = 'active'
      AND query NOT ILIKE '%pg_stat_activity%'
      AND query NOT ILIKE '%VACUUM%'
      AND query_start IS NOT NULL
      AND (now() - query_start) > interval '500 milliseconds'
    ORDER BY query_start ASC
    LIMIT 10
  `);

  await client.end();

  if (rows.length === 0) {
    console.log("OK — no slow queries");
    return;
  }

  const state = await loadState();
  const now = Date.now();
  const toAlert = [];

  for (const r of rows) {
    const h = hash(r.query);
    const last = state.lastAlerts[h] || 0;
    if (now - last < DEDUPE_MS) continue;
    state.lastAlerts[h] = now;
    toAlert.push(r);
  }

  // prune old state
  for (const [h, ts] of Object.entries(state.lastAlerts)) {
    if (now - ts > 2 * DEDUPE_MS) delete state.lastAlerts[h];
  }
  await saveState(state);

  if (toAlert.length === 0) {
    console.log(`${rows.length} slow queries running (all deduped)`);
    return;
  }

  const critical = toAlert.some((r) => r.duration_ms >= CRIT_MS);
  const icon = critical ? "🚨" : "⚠️";
  const head = critical ? "CRITIQUE" : "ALERTE";
  const lines = [`${icon} *iku.gg PG ${head}*`, ""];
  for (const r of toAlert) {
    const ms = Math.round(r.duration_ms);
    const snippet = r.query.replace(/\s+/g, " ").trim().slice(0, 250);
    lines.push(`\`${ms}ms\` pid=${r.pid}`);
    lines.push("```");
    lines.push(snippet);
    lines.push("```");
  }
  lines.push("");
  lines.push(`_Seuil: >${WARN_MS}ms warn, >${CRIT_MS}ms crit. Dedup 10min._`);

  await tg(lines.join("\n"));
  console.log(`alerted: ${toAlert.length}`);
}

main().catch(async (e) => {
  console.error(e);
  if (TOKEN) {
    await tg(
      `🔴 *pg-slow-query-watcher crashed*\n\n\`\`\`\n${e.message}\n\`\`\``,
    );
  }
  process.exit(1);
});
