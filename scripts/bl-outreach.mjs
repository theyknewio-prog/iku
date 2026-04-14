#!/usr/bin/env node
// Backlink outreach bot — sends short BL exchange pitches via Resend,
// logs everything to PostgreSQL, and sends one follow-up at D+5.
//
// Usage:
//   node scripts/bl-outreach.mjs --init      (create PG table)
//   node scripts/bl-outreach.mjs --send      (send daily batch)
//   node scripts/bl-outreach.mjs --followup  (send D+5 follow-ups)
//   node scripts/bl-outreach.mjs --stats     (print current status)
//
// Env:
//   DATABASE_URL        postgres connection
//   RESEND_API_KEY      Resend API key
//   EMAIL_FROM          sender (default: iku.gg <hello@iku.gg>)
//   REPLY_TO            reply-to (default: iku.media.gg@gmail.com)
//   DAILY_CAP           max sends per run (default 25)
//   TELEGRAM_BOT_TOKEN  optional — ping Sab after each run

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LIST_PATH = resolve(ROOT, "scripts/bl-outreach-list.json");

const DB_URL = process.env.DATABASE_URL;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "iku.gg <hello@iku.gg>";
const REPLY_TO = process.env.REPLY_TO || "iku.media.gg@gmail.com";
const DAILY_CAP = Number(process.env.DAILY_CAP || 25);
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "5617056258";

if (!DB_URL) { console.error("DATABASE_URL required"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DB_URL, max: 3 });

// ── PG schema ───────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS bl_outreach (
  id            BIGSERIAL PRIMARY KEY,
  site_name     TEXT NOT NULL,
  site_url      TEXT NOT NULL,
  email         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued', -- queued | sent | failed | replied | posted
  sent_at       TIMESTAMPTZ,
  followup_sent_at TIMESTAMPTZ,
  replied_at    TIMESTAMPTZ,
  posted_at     TIMESTAMPTZ,
  last_error    TEXT,
  resend_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS bl_outreach_status_idx ON bl_outreach (status, sent_at);
`;

// ── Template ────────────────────────────────────────────────────
function buildBody(siteName, siteUrl) {
  return [
    `Hi,`,
    ``,
    `I run iku.gg, a free hentai streaming site with 346K+ videos and growing organic traffic (around 1,400 daily uniques, up from zero two weeks ago thanks to SEO).`,
    ``,
    `I'd like to trade a sitewide backlink. Yours in our footer Friends section (visible on 346K pages), ours on yours.`,
    ``,
    `Same vertical, zero risk, pure mutual SEO win.`,
    ``,
    `If you're in, reply with the URL you want linked and the anchor text. I can have it live within the hour.`,
    ``,
    `Sab`,
    `iku.gg`,
  ].join("\n");
}

function buildFollowupBody(siteName) {
  return [
    `Hi again,`,
    ``,
    `Bumping this one in case it slipped through. Still open to a sitewide link exchange with ${siteName}.`,
    ``,
    `iku.gg is at ~1,400 daily uniques now and climbing fast on SEO. The footer slot is visible on 346K pages and indexed by Google.`,
    ``,
    `Short reply with your URL and anchor is all I need.`,
    ``,
    `Sab`,
    `iku.gg`,
  ].join("\n");
}

function subject(siteName) {
  return `iku.gg link exchange`;
}

// ── Resend send ─────────────────────────────────────────────────
async function sendMail(to, subjectStr, textBody) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: subjectStr,
      text: textBody,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`resend ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.id;
}

// ── Telegram ping ───────────────────────────────────────────────
async function pingTg(msg) {
  if (!TG_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg }),
    });
  } catch { /* noop */ }
}

// ── Commands ────────────────────────────────────────────────────
async function cmdInit() {
  await pool.query(SCHEMA);
  console.log("Schema ready.");

  // Seed from JSON (idempotent via UNIQUE email)
  const list = JSON.parse(readFileSync(LIST_PATH, "utf8"));
  let inserted = 0;
  for (const p of list.prospects) {
    for (const email of p.emails) {
      const r = await pool.query(
        `INSERT INTO bl_outreach (site_name, site_url, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [p.site, p.url, email.toLowerCase()]
      );
      inserted += r.rowCount;
    }
  }
  console.log(`Seeded ${inserted} new prospects.`);
  const tot = await pool.query(`SELECT status, COUNT(*) FROM bl_outreach GROUP BY status`);
  console.log("Status:", tot.rows);
}

async function cmdSend() {
  const { rows } = await pool.query(
    `SELECT id, site_name, site_url, email
       FROM bl_outreach
      WHERE status = 'queued'
      ORDER BY id ASC
      LIMIT $1`,
    [DAILY_CAP]
  );
  if (!rows.length) {
    console.log("No queued prospects.");
    return;
  }
  let sent = 0, failed = 0;
  for (const p of rows) {
    try {
      const id = await sendMail(p.email, subject(p.site_name), buildBody(p.site_name, p.site_url));
      await pool.query(
        `UPDATE bl_outreach SET status='sent', sent_at=now(), resend_id=$2 WHERE id=$1`,
        [p.id, id]
      );
      sent++;
      console.log(`✓ ${p.email} (${p.site_name})`);
    } catch (e) {
      await pool.query(
        `UPDATE bl_outreach SET status='failed', last_error=$2 WHERE id=$1`,
        [p.id, String(e).slice(0, 500)]
      );
      failed++;
      console.log(`✗ ${p.email}: ${String(e).slice(0, 120)}`);
    }
    // light throttle: 1 send every ~1.5s
    await new Promise(r => setTimeout(r, 1500));
  }
  const msg = `📮 BL outreach batch\n✓ Sent: ${sent}\n✗ Failed: ${failed}\nQueue remaining: check --stats`;
  console.log(msg);
  await pingTg(msg);
}

async function cmdFollowup() {
  const { rows } = await pool.query(
    `SELECT id, site_name, site_url, email
       FROM bl_outreach
      WHERE status = 'sent'
        AND followup_sent_at IS NULL
        AND sent_at < now() - INTERVAL '5 days'
      ORDER BY sent_at ASC
      LIMIT $1`,
    [DAILY_CAP]
  );
  if (!rows.length) {
    console.log("No follow-ups due.");
    return;
  }
  let sent = 0;
  for (const p of rows) {
    try {
      await sendMail(p.email, `Re: ${subject(p.site_name)}`, buildFollowupBody(p.site_name));
      await pool.query(
        `UPDATE bl_outreach SET followup_sent_at=now() WHERE id=$1`,
        [p.id]
      );
      sent++;
      console.log(`↻ ${p.email}`);
    } catch (e) {
      console.log(`✗ ${p.email}: ${String(e).slice(0, 120)}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  await pingTg(`🔄 BL follow-up batch: ${sent} sent`);
}

async function cmdStats() {
  const r = await pool.query(
    `SELECT status, COUNT(*) FROM bl_outreach GROUP BY status ORDER BY 1`
  );
  console.log("Status breakdown:");
  for (const row of r.rows) console.log(`  ${row.status.padEnd(10)} ${row.count}`);
  const recent = await pool.query(
    `SELECT site_name, email, status, sent_at, replied_at
       FROM bl_outreach
      WHERE sent_at IS NOT NULL
      ORDER BY sent_at DESC LIMIT 10`
  );
  console.log("\nLast 10 sent:");
  for (const row of recent.rows) {
    const when = row.sent_at?.toISOString?.().slice(0, 16) || '';
    console.log(`  [${row.status}] ${when} ${row.site_name} (${row.email})`);
  }
}

// ── Main ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cmd = args[0] || "--stats";

try {
  if (cmd === "--init") await cmdInit();
  else if (cmd === "--send") await cmdSend();
  else if (cmd === "--followup") await cmdFollowup();
  else if (cmd === "--stats") await cmdStats();
  else {
    console.log("Usage: node bl-outreach.mjs [--init | --send | --followup | --stats]");
    process.exit(1);
  }
} finally {
  await pool.end();
}
