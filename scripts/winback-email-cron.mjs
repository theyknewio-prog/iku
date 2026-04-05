/**
 * scripts/winback-email-cron.mjs
 *
 * Winback email campaign — sends re-engagement emails to inactive users
 * at exact day-windows: j7, j14, j30. Each user receives at most 3 winback
 * emails ever (one per window).
 *
 * Dedup via email_log check — never sends the same template twice to the
 * same user. Safe to run daily (idempotent).
 *
 * Runs via GitHub Actions cron daily at 08:00 UTC.
 *
 * ENV:
 *   RESEND_API_KEY
 *   DATABASE_URL
 *   EMAIL_FROM              (optional, default "iku.gg <hello@iku.gg>")
 *   NEXT_PUBLIC_SITE_URL    (optional, default https://iku.gg)
 *   WINBACK_DRY_RUN         (optional, set to "1" to log picks without sending)
 */

import pg from "pg";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const FROM_ADDRESS = process.env.EMAIL_FROM || "iku.gg <hello@iku.gg>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iku.gg";
const DRY_RUN = process.env.WINBACK_DRY_RUN === "1";

if (!RESEND_API_KEY || !DATABASE_URL) {
  console.error("Missing env: need RESEND_API_KEY + DATABASE_URL");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);
const pool = new pg.Pool({ connectionString: DATABASE_URL });

// ─────────────────────────────────────────────────────────────
// Tier names (mirror src/lib/gamification.ts)
// ─────────────────────────────────────────────────────────────
function tierForScore(score) {
  if (score >= 50000) return "Hentai Sage";
  if (score >= 15000) return "Waifu Scholar";
  if (score >= 5000)  return "Otaku";
  if (score >= 1000)  return "Senpai";
  if (score >= 200)   return "Kouhai";
  return "Wanderer";
}

// ─────────────────────────────────────────────────────────────
// HTML escape helper
// ─────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// Email shell (mirrors src/lib/email.ts emailShell)
// ─────────────────────────────────────────────────────────────
function emailShell({ title, preheader, body, ctaLabel, ctaUrl, footnote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0514;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#fff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0514;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:linear-gradient(180deg,#1a0b2e 0%,#120820 100%);border:1px solid rgba(255,107,157,0.2);border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 32px 16px;background:linear-gradient(135deg,rgba(255,107,157,0.15),rgba(192,132,252,0.15));">
              <div style="font-size:32px;font-weight:900;color:#ff6b9d;letter-spacing:-1px;">iku.gg ✨</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;color:#fff;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#fff;line-height:1.3;">${escapeHtml(title)}</h1>
              <div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">${body}</div>
              ${ctaUrl && ctaLabel ? `
              <div style="margin:28px 0 12px;text-align:center;">
                <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ff6b9d,#c084fc);color:#fff !important;text-decoration:none;font-weight:800;font-size:14px;border-radius:12px;letter-spacing:0.02em;">${escapeHtml(ctaLabel)}</a>
              </div>
              ` : ""}
              ${footnote ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(255,255,255,0.5);line-height:1.5;">${footnote}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 32px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">
                <a href="${SITE_URL}" style="color:#c084fc;text-decoration:none;">iku.gg</a> · 353,000+ animated hentai · free · 18+ only
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// Build winback email for a given user + day window
// ─────────────────────────────────────────────────────────────
function buildEmail(user, daysInactive) {
  const { username, score = 0, longest_streak: longestStreak = 0, current_streak: currentStreak = 0 } = user;
  const tier = tierForScore(score);

  const subjects = {
    7:  `We miss you, ${username} 💔`,
    14: `${username}, your streak is getting cold ❄️`,
    30: `One last reminder, ${username} — we're still here 💖`,
  };

  const hooks = {
    7:  "It's been a week since you last visited. Your spot on the leaderboard is getting hungry.",
    14: "Two weeks without watching. Your daily quests are piling up and the community is scoring past you.",
    30: "A full month. We know life gets busy — just a reminder that your account, favorites, and progress are still here waiting.",
  };

  const streakLine = longestStreak > 0
    ? `<p style="margin:0 0 16px;padding:14px 18px;background:rgba(255,107,157,0.08);border-left:3px solid #ff6b9d;border-radius:6px;font-size:14px;">
         🔥 Your longest streak was <strong style="color:#ff6b9d;">${longestStreak} days</strong>. Think you can beat it?
       </p>`
    : "";

  const statLine = score > 0
    ? `<p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.65);">
         Current tier: <strong style="color:#c084fc;">${escapeHtml(tier)}</strong>
         &nbsp;·&nbsp; Score: <strong style="color:#c084fc;">${Number(score).toLocaleString()}</strong>
       </p>`
    : "";

  const html = emailShell({
    title: subjects[daysInactive],
    preheader: hooks[daysInactive],
    body: `
      <p style="margin:0 0 16px;">Hey <strong style="color:#fff;">${escapeHtml(username)}</strong>,</p>
      <p style="margin:0 0 16px;">${hooks[daysInactive]}</p>
      ${streakLine}
      ${statLine}
      <p style="margin:0 0 12px;font-weight:700;color:#ff6b9d;">What's new since you've been gone:</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:rgba(255,255,255,0.75);font-size:14px;line-height:1.8;">
        <li>🆕 Fresh clips added daily from all sources</li>
        <li>🎯 3 new daily quests waiting for you (+15 pts each)</li>
        <li>🏆 New badges to unlock on your next visit</li>
        <li>💎 iku.gg Pro — remove ads + early access (now live)</li>
      </ul>
    `,
    ctaLabel: currentStreak > 0 ? "Resume my streak 🔥" : "Take me back 💖",
    ctaUrl: `${SITE_URL}/?utm_source=email&utm_medium=winback&utm_campaign=j${daysInactive}`,
    footnote: `You're receiving this because you haven't visited iku.gg in ${daysInactive} days. <a href="${SITE_URL}/settings" style="color:#c084fc;text-decoration:none;">Unsubscribe from re-engagement emails</a>.`,
  });

  return { subject: subjects[daysInactive], html };
}

// ─────────────────────────────────────────────────────────────
// Core: find + send
// ─────────────────────────────────────────────────────────────
async function findUsersInactiveExactly(daysInactive) {
  // Join users + user_stats, filter by last_active_date exactly N days ago,
  // exclude users who already received this winback template.
  const { rows } = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.username,
      u.email_verified,
      COALESCE(s.score, 0)           AS score,
      COALESCE(s.current_streak, 0)  AS current_streak,
      COALESCE(s.longest_streak, 0)  AS longest_streak,
      s.last_active_date
    FROM users u
    INNER JOIN user_stats s ON s.user_id = u.id
    WHERE u.email_verified = TRUE
      AND u.email IS NOT NULL
      AND u.email NOT LIKE '%@discord.iku.gg'
      AND s.last_active_date = (CURRENT_DATE - ($1::int * INTERVAL '1 day'))::date
      AND NOT EXISTS (
        SELECT 1 FROM email_log
        WHERE email_log.user_id = u.id
          AND email_log.template = $2
      )
    ORDER BY u.id ASC
    LIMIT 500
    `,
    [daysInactive, `winback_j${daysInactive}`]
  );
  return rows;
}

async function logEmail(userId, toEmail, template, status, resendId, error) {
  try {
    await pool.query(
      `INSERT INTO email_log (user_id, to_email, template, status, resend_id, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, toEmail, template, status, resendId, error]
    );
  } catch (err) {
    console.error("email_log insert failed:", err.message);
  }
}

async function sendWinback(user, daysInactive) {
  const { subject, html } = buildEmail(user, daysInactive);
  const template = `winback_j${daysInactive}`;

  if (DRY_RUN) {
    console.log(`[DRY RUN] would send ${template} to ${user.email} (${user.username})`);
    return { ok: true, dry: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: user.email,
      subject,
      html,
    });

    if (error) {
      await logEmail(user.id, user.email, template, "failed", null, error.message);
      console.error(`FAIL ${template} → ${user.email}: ${error.message}`);
      return { ok: false };
    }

    await logEmail(user.id, user.email, template, "sent", data?.id || null, null);
    console.log(`SENT ${template} → ${user.email} (id=${data?.id})`);
    return { ok: true };
  } catch (err) {
    await logEmail(user.id, user.email, template, "failed", null, err.message);
    console.error(`EXCEPTION ${template} → ${user.email}: ${err.message}`);
    return { ok: false };
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`iku.gg winback cron — ${new Date().toISOString()} (dry_run=${DRY_RUN})`);

  const windows = [7, 14, 30];
  const totals = { picked: 0, sent: 0, failed: 0 };

  for (const days of windows) {
    const users = await findUsersInactiveExactly(days);
    console.log(`\n── j${days} window: ${users.length} users found`);
    totals.picked += users.length;

    for (const user of users) {
      // Gentle rate limit: Resend free tier = 100/day, paid = higher.
      // 250ms between sends = 4/sec max, well under any reasonable limit.
      await new Promise((r) => setTimeout(r, 250));
      const res = await sendWinback(user, days);
      if (res.ok) totals.sent++;
      else totals.failed++;
    }
  }

  console.log(`\n✅ done — picked=${totals.picked} sent=${totals.sent} failed=${totals.failed}`);
  await pool.end();
}

main().catch((err) => {
  console.error("fatal:", err);
  pool.end().catch(() => {});
  process.exit(1);
});
