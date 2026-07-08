/**
 * daily-catalog-health.mjs — ONE trusted number for "how many videos
 * actually work", per source, sent to Telegram once a day.
 *
 * Purpose: stop the "video morte / pas morte" guesswork. Instead of a
 * verbal status that flip-flops between sessions, this reports the real
 * DB state (alive = dead_at IS NULL AND dead_thumbnail_at IS NULL AND
 * thumbnail present) per source, plus the day-over-day delta so a sudden
 * drop is visible immediately.
 *
 * Cron (Hetzner): once daily. Run manually: node scripts/daily-catalog-health.mjs
 */
import pg from "pg";
import { readFileSync, writeFileSync, existsSync } from "fs";

const DB = process.env.DATABASE_URL;
const BOT = process.env.BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID || "5617056258";
const STATE = "/var/log/iku-catalog-health-prev.json";

if (!DB) {
  console.error("missing DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DB });
const { rows } = await pool.query(
  `SELECT source,
          COUNT(*) FILTER (WHERE dead_at IS NULL
                             AND dead_thumbnail_at IS NULL
                             AND thumbnail <> '') AS alive,
          COUNT(*) AS total
     FROM videos
    GROUP BY source
    ORDER BY alive DESC`,
);
await pool.end();

const now = {};
let totalAlive = 0;
for (const r of rows) {
  now[r.source] = Number(r.alive);
  totalAlive += Number(r.alive);
}

let prev = {};
if (existsSync(STATE)) {
  try {
    prev = JSON.parse(readFileSync(STATE, "utf8"));
  } catch {}
}

const fmt = (n) => n.toLocaleString("en-US");
const delta = (src, v) => {
  const p = prev[src];
  if (p === undefined) return "";
  const d = v - p;
  if (d === 0) return "";
  return ` (${d > 0 ? "+" : ""}${fmt(d)})`;
};

const lines = rows
  .map(
    (r) =>
      `• ${r.source}: ${fmt(Number(r.alive))}${delta(r.source, Number(r.alive))}`,
  )
  .join("\n");

const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0);
const totalDelta = prevTotal ? totalAlive - prevTotal : 0;
const totalDeltaStr = prevTotal
  ? ` (${totalDelta >= 0 ? "+" : ""}${fmt(totalDelta)} vs hier)`
  : "";

const msg =
  `📊 iku.gg — vidéos jouables (source de vérité)\n\n` +
  `TOTAL: ${fmt(totalAlive)}${totalDeltaStr}\n\n${lines}\n\n` +
  `Alive = lisible (non morte, vignette OK). Une baisse brutale = incident source à checker.`;

writeFileSync(STATE, JSON.stringify(now));

if (BOT) {
  const res = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text: msg }),
  });
  console.log("telegram:", res.status);
} else {
  console.log(msg);
  console.log("\n(BOT_TOKEN not set — printed only)");
}
