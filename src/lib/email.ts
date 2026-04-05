/**
 * email.ts — Resend wrapper + email templates for iku.gg
 *
 * Templates:
 *   - verification : magic link to verify new email addresses
 *   - password_reset : one-shot password reset link
 *   - welcome : sent once after email verified
 *   - winback_j3 / j7 / j14 : inactive user re-engagement (future)
 *
 * All sends are logged to email_log for audit + rate limiting.
 * Anonymous users or unconfigured Resend = silent no-op.
 *
 * ENV:
 *   RESEND_API_KEY — full-access key
 *   EMAIL_FROM     — "iku.gg <hello@iku.gg>" (optional, defaults below)
 *   NEXT_PUBLIC_SITE_URL — https://iku.gg (for link generation)
 */

import crypto from "crypto";
import { Resend } from "resend";
import pool from "@/lib/db";

const API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM || "iku.gg <hello@iku.gg>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iku.gg";

const resend = API_KEY ? new Resend(API_KEY) : null;

// ─────────────────────────────────────────────────────────────
// Shared email shell (dark anime-themed, renders in Gmail/Outlook)
// ─────────────────────────────────────────────────────────────

function emailShell(opts: {
  title: string;
  preheader: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}): string {
  const { title, preheader, body, ctaLabel, ctaUrl, footnote } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
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
              <div style="font-size:32px;font-weight:900;background:linear-gradient(135deg,#ff6b9d,#c084fc);-webkit-background-clip:text;background-clip:text;color:#ff6b9d;letter-spacing:-1px;">iku.gg ✨</div>
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
              <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.4);text-align:center;">
                Or paste this link into your browser:<br>
                <span style="color:#c084fc;word-break:break-all;">${escapeHtml(ctaUrl)}</span>
              </p>
              ` : ""}
              ${footnote ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(255,255,255,0.5);line-height:1.5;">${footnote}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 32px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);">
                <a href="${SITE_URL}" style="color:#c084fc;text-decoration:none;">iku.gg</a> · 353,000+ animated hentai · free · 18+ only
              </p>
              <p style="margin:8px 0 0;font-size:10px;color:rgba(255,255,255,0.3);">
                You received this because you have an account on iku.gg.
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// Raw send + log
// ─────────────────────────────────────────────────────────────

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

async function rawSend(opts: {
  to: string;
  subject: string;
  html: string;
  userId?: number | string;
  template: string;
}): Promise<SendResult> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping ${opts.template} to ${opts.to}`);
    return { ok: false, error: "resend not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (error) {
      await logEmail({
        userId: opts.userId,
        to: opts.to,
        template: opts.template,
        status: "failed",
        error: error.message,
      });
      return { ok: false, error: error.message };
    }

    await logEmail({
      userId: opts.userId,
      to: opts.to,
      template: opts.template,
      status: "sent",
      resendId: data?.id,
    });

    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await logEmail({
      userId: opts.userId,
      to: opts.to,
      template: opts.template,
      status: "failed",
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

async function logEmail(opts: {
  userId?: number | string;
  to: string;
  template: string;
  status: "sent" | "failed";
  resendId?: string;
  error?: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_log (user_id, to_email, template, status, resend_id, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        opts.userId ?? null,
        opts.to,
        opts.template,
        opts.status,
        opts.resendId ?? null,
        opts.error ?? null,
      ]
    );
  } catch (err) {
    console.error("email_log insert failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createVerificationToken(userId: number | string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000); // 24h
  await pool.query(
    `INSERT INTO email_verification_tokens (token, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  return token;
}

export async function createPasswordResetToken(userId: number | string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60_000); // 1h
  await pool.query(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  return token;
}

// ─────────────────────────────────────────────────────────────
// Public send functions — one per template
// ─────────────────────────────────────────────────────────────

export async function sendVerificationEmail(opts: {
  userId: number | string;
  email: string;
  username: string;
}): Promise<SendResult> {
  const token = await createVerificationToken(opts.userId);
  const url = `${SITE_URL}/api/auth/verify?token=${token}`;

  const html = emailShell({
    title: `Welcome, ${opts.username} — confirm your email`,
    preheader: "One click to activate your iku.gg account",
    body: `
      <p style="margin:0 0 16px;">Hey <strong style="color:#fff;">${escapeHtml(opts.username)}</strong>,</p>
      <p style="margin:0 0 16px;">Thanks for joining iku.gg. Click the button below to confirm your email address and unlock your account:</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:rgba(255,255,255,0.7);font-size:14px;">
        <li>Save unlimited favorites</li>
        <li>Sync your history across devices</li>
        <li>Earn points, climb the leaderboard</li>
        <li>Get early access to new clips (Pro tier)</li>
      </ul>
    `,
    ctaLabel: "Confirm my email",
    ctaUrl: url,
    footnote: "This link expires in 24 hours. If you didn't create an iku.gg account, you can safely ignore this message.",
  });

  return rawSend({
    to: opts.email,
    subject: "Confirm your iku.gg email address ✨",
    html,
    userId: opts.userId,
    template: "verification",
  });
}

export async function sendPasswordResetEmail(opts: {
  userId: number | string;
  email: string;
  username: string;
}): Promise<SendResult> {
  const token = await createPasswordResetToken(opts.userId);
  const url = `${SITE_URL}/reset-password?token=${token}`;

  const html = emailShell({
    title: "Reset your password",
    preheader: "Someone requested a password reset for your iku.gg account",
    body: `
      <p style="margin:0 0 16px;">Hey <strong style="color:#fff;">${escapeHtml(opts.username)}</strong>,</p>
      <p style="margin:0 0 16px;">Someone (hopefully you) asked to reset the password for your iku.gg account. Click below to pick a new one:</p>
    `,
    ctaLabel: "Reset my password",
    ctaUrl: url,
    footnote: "This link expires in 1 hour. If you didn't request a password reset, your account is still safe — just ignore this email.",
  });

  return rawSend({
    to: opts.email,
    subject: "Reset your iku.gg password 🔒",
    html,
    userId: opts.userId,
    template: "password_reset",
  });
}

export async function sendWelcomeEmail(opts: {
  userId: number | string;
  email: string;
  username: string;
}): Promise<SendResult> {
  const html = emailShell({
    title: `Welcome to iku.gg, ${opts.username} 💖`,
    preheader: "Your account is live — here's how to get started",
    body: `
      <p style="margin:0 0 16px;">Your email is confirmed. You're now part of the biggest animated hentai community on the internet.</p>
      <p style="margin:0 0 12px;font-weight:700;color:#ff6b9d;">Here's what you just unlocked:</p>
      <ul style="margin:0 0 20px;padding-left:20px;color:rgba(255,255,255,0.8);font-size:14px;line-height:1.8;">
        <li>❤️ <strong>Favorites</strong> — save clips and sync across devices</li>
        <li>🕐 <strong>History</strong> — pick up where you left off</li>
        <li>🏆 <strong>Gamification</strong> — earn points, badges, and climb 6 tiers</li>
        <li>🔥 <strong>Daily streak</strong> — come back every day for bonus rewards</li>
        <li>🎯 <strong>Daily quests</strong> — complete 3 challenges for +15 pts each</li>
        <li>💎 <strong>Pro tier</strong> — remove ads, early access, Discord lounge</li>
      </ul>
      <p style="margin:0 0 16px;">Join the Discord to chat with other fans, get daily drops, and participate in watch parties:</p>
    `,
    ctaLabel: "Join the Discord 🎮",
    ctaUrl: "https://discord.gg/cQZc8trq8N",
    footnote: `Start watching: <a href="${SITE_URL}" style="color:#ff6b9d;text-decoration:none;">iku.gg</a> · Your profile: <a href="${SITE_URL}/profile" style="color:#ff6b9d;text-decoration:none;">iku.gg/profile</a>`,
  });

  return rawSend({
    to: opts.email,
    subject: "Welcome to iku.gg — your account is live 💖",
    html,
    userId: opts.userId,
    template: "welcome",
  });
}

// ─────────────────────────────────────────────────────────────
// Token consumption helpers (used by /api/auth/verify + /reset-password)
// ─────────────────────────────────────────────────────────────

export async function consumeVerificationToken(token: string): Promise<number | null> {
  const { rows } = await pool.query(
    `UPDATE email_verification_tokens
     SET used_at = NOW()
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [token]
  );
  if (rows.length === 0) return null;
  const userId = Number(rows[0].user_id);

  // Mark user email as verified + send welcome email
  await pool.query(
    `UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = $1`,
    [userId]
  );

  return userId;
}

export async function consumePasswordResetToken(token: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [token]
  );
  return rows.length === 0 ? Number(rows[0]?.user_id) || null : Number(rows[0].user_id);
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1`,
    [token]
  );
}
