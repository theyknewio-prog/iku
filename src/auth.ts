/**
 * auth.ts — NextAuth v5 (Auth.js) configuration for iku.gg
 *
 * Two sign-in methods:
 *   1. Credentials (email + password) — stored hashed in `users` table
 *   2. Discord OAuth — linked via `user_oauth_accounts` table
 *
 * Session strategy: JWT (no session DB lookup on every request).
 * The JWT contains the internal user id + username + avatar, so pages
 * can render user info without hitting PG.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { createRateLimiter } from "@/lib/rate-limit";

// Login brute-force guards (B4, bug audit 2026-04-23).
// 20 attempts per 5 min per IP, 10 per 15 min per email — a targeted
// stuffing campaign that rotates IPs still burns itself out after 10
// tries against any single email.
const loginIpLimiter = createRateLimiter({
  name: "login-ip",
  max: 20,
  windowMs: 5 * 60_000,
});
const loginEmailLimiter = createRateLimiter({
  name: "login-email",
  max: 10,
  windowMs: 15 * 60_000,
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      avatarEmoji: string;
    } & DefaultSession["user"];
  }
}

interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string | null;
  avatar_emoji: string;
  email_verified?: boolean;
}

/** Look up a user by email (case-insensitive). */
async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `SELECT id, email, username, password_hash, avatar_emoji, email_verified
     FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

/** Look up a user by internal id. */
async function findUserById(id: number | string): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `SELECT id, email, username, password_hash, avatar_emoji, email_verified
     FROM users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Find or create a user from a Discord OAuth profile.
 *
 * Security hardening against account takeover:
 *   1. If Discord profile email is not verified by Discord itself, ignore it
 *      entirely (treat as no email). Prevents linking via an attacker-owned
 *      unverified email.
 *   2. Only auto-link to an existing iku.gg account by email IF both sides are
 *      email-verified. Otherwise create a fresh Discord-only account so the
 *      pending-verification row stays claimable only via the password flow.
 */
async function findOrCreateDiscordUser(profile: {
  id: string;
  email: string | null;
  username: string;
  avatar: string | null;
  verified?: boolean;
}): Promise<UserRow> {
  // 1. Already linked?
  const existing = await pool.query(
    `SELECT u.id, u.email, u.username, u.password_hash, u.avatar_emoji, u.email_verified
     FROM user_oauth_accounts o
     JOIN users u ON u.id = o.user_id
     WHERE o.provider = 'discord' AND o.provider_user_id = $1`,
    [profile.id],
  );
  if (existing.rows[0]) return existing.rows[0];

  // Harden: if Discord says the email is NOT verified, refuse to use it
  // as a lookup key. Attackers can have Discord accounts with arbitrary
  // unverified emails — we don't want to auto-link those to existing users.
  const trustedEmail =
    profile.verified === true && profile.email ? profile.email : null;

  // 2. Account by email? (link, don't duplicate) — ONLY if both sides verified.
  if (trustedEmail) {
    const byEmail = await findUserByEmail(trustedEmail);
    if (byEmail) {
      if (!byEmail.email_verified) {
        // Pending-verification account — don't auto-link. Fall through to
        // creating a fresh Discord-only account. The original owner can still
        // complete email verification and own the iku.gg account.
        console.warn(
          `[auth] refusing Discord auto-link to unverified user ${byEmail.id} (email=${trustedEmail})`,
        );
      } else {
        await pool.query(
          `INSERT INTO user_oauth_accounts (provider, provider_user_id, user_id)
           VALUES ('discord', $1, $2)
           ON CONFLICT DO NOTHING`,
          [profile.id, byEmail.id],
        );
        return byEmail;
      }
    }
  }

  // 3. Create new user. Username must be unique — suffix with discord id if clash.
  const baseUsername =
    profile.username.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "user";
  let username = baseUsername;
  const clash = await pool.query(
    `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username],
  );
  if (clash.rows.length > 0) {
    username = `${baseUsername}_${profile.id.slice(-4)}`;
  }

  // Use the trusted email if available; otherwise fall back to a synthetic
  // @discord.iku.gg address (exempt from the email-verification gate).
  const email = trustedEmail ?? `${profile.id}@discord.iku.gg`;
  // If Discord says the email is verified, trust that and mark the user
  // verified — they clearly own that inbox per Discord's own check.
  const emailVerified = !!trustedEmail;
  const avatar = "🎮"; // Discord default

  const { rows } = await pool.query(
    `INSERT INTO users (email, username, avatar_emoji, email_verified, email_verified_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NOW() ELSE NULL END)
     RETURNING id, email, username, password_hash, avatar_emoji, email_verified`,
    [email, username, avatar, emailVerified],
  );
  const newUser = rows[0];

  await pool.query(
    `INSERT INTO user_oauth_accounts (provider, provider_user_id, user_id)
     VALUES ('discord', $1, $2)`,
    [profile.id, newUser.id],
  );

  return newUser;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Don't use the default `/api/auth/*` DB adapter — we manage users manually
  // because this is adult content and we want full control over signup flow.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Rate-limit the login endpoint — B4 (bug audit 2026-04-23).
        // NextAuth's /api/auth/callback/credentials had zero limiter while
        // forgot-password and signup are both capped at 5/h, making the
        // login endpoint the natural credential-stuffing target. Keyed on
        // both IP (blocks single-IP brute force) and email (blocks
        // multi-IP targeted stuffing of one account).
        //
        // On the first failure we silently treat it as an auth reject
        // (return null) so the attacker can't distinguish "bad password"
        // from "rate-limited" — stops them from backing off to dodge the
        // limit.
        const ipHeaders = request?.headers;
        const ip =
          ipHeaders?.get?.("x-real-ip")?.trim() ||
          ipHeaders?.get?.("x-forwarded-for")?.split(",").pop()?.trim() ||
          "unknown";
        if (loginIpLimiter.consume(ip)) return null;
        if (loginEmailLimiter.consume(email)) return null;

        const user = await findUserByEmail(email);
        if (!user || !user.password_hash) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.username,
          image: user.avatar_emoji,
        };
      },
    }),

    // Discord is optional — only enabled when env vars are set.
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          Discord({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: { params: { scope: "identify email" } },
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Discord OAuth flow: resolve to our internal user row
      if (account?.provider === "discord" && profile) {
        const discordProfile = profile as {
          id: string;
          email: string | null;
          username: string;
          avatar: string | null;
          verified?: boolean;
        };
        const row = await findOrCreateDiscordUser(discordProfile);
        // Mutate user object so jwt() callback sees our internal id + username
        user.id = String(row.id);
        user.name = row.username;
        user.email = row.email;
        user.image = row.avatar_emoji;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.username = user.name ?? "";
        token.avatarEmoji = user.image ?? "🌸";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        session.user.username = String(token.username ?? "");
        session.user.avatarEmoji = String(token.avatarEmoji ?? "🌸");
      }
      return session;
    },
  },

  trustHost: true, // Required behind Coolify/Traefik
});

export { findUserById };
