/**
 * scripts/discord-sync-roles.mjs
 *
 * Syncs iku.gg user state to Discord roles, for users who linked their
 * Discord account via OAuth.
 *
 * For each linked user:
 *   - Computes the current tier from user_stats.score (Wanderer → Hentai Sage)
 *   - Computes streak-based badge (7/30/100/365 days)
 *   - Checks Pro subscription status
 *   - Checks Top 100 weekly rank (rolling last 7 days of score events)
 *   - Calls PATCH /guilds/{id}/members/{user}/roles to assign the matching roles
 *   - Removes outdated roles (e.g. user dropped out of top 100)
 *
 * Designed to run as a cron every hour via GitHub Actions.
 *
 * ENV:
 *   DISCORD_BOT_TOKEN
 *   DISCORD_GUILD_ID
 *   DATABASE_URL
 */

import pg from "pg";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN || !GUILD_ID || !DATABASE_URL) {
  console.error("Missing DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, or DATABASE_URL");
  process.exit(1);
}

const API = "https://discord.com/api/v10";
const headers = {
  Authorization: `Bot ${BOT_TOKEN}`,
  "Content-Type": "application/json",
};

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    const retry = await res.json();
    console.log(`  ⏱  rate limited, waiting ${retry.retry_after}s`);
    await new Promise((r) => setTimeout(r, (retry.retry_after + 0.5) * 1000));
    return api(method, path, body);
  }
  if (res.status === 204) return {};
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const e = new Error(`${method} ${path}: ${JSON.stringify(data)}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// Tier definitions — mirror src/lib/gamification.ts
// ─────────────────────────────────────────────────────────────

const TIER_THRESHOLDS = [
  { name: "Wanderer",       threshold: 0 },
  { name: "Kouhai",         threshold: 200 },
  { name: "Senpai",         threshold: 1000 },
  { name: "Otaku",          threshold: 5000 },
  { name: "Waifu Scholar",  threshold: 15000 },
  { name: "Hentai Sage",    threshold: 50000 },
];

function tierFromScore(score) {
  let current = TIER_THRESHOLDS[0];
  for (const t of TIER_THRESHOLDS) {
    if (score >= t.threshold) current = t;
    else break;
  }
  return current.name;
}

// Mapping: site state → Discord role name (as created in the server)
// These roles MUST exist on the server (created by setup-discord.mjs)
const TIER_ROLE_MAP = {
  // Tiers — only the 4 highest get a Discord visible role
  "Otaku":         null, // no specific tier role — Senpai/Otaku don't need one
  "Waifu Scholar": null,
  "Hentai Sage":   null,
};
const PRO_ROLE     = "✨ Pro";
const VIP_ROLE     = "💎 VIP";  // lifetime customers
const STREAK_7_ROLE   = null;  // not created yet
const STREAK_30_ROLE  = null;
const STREAK_100_ROLE = null;
const TOP_FAN_ROLE = "🏆 Top Contributor";  // existing role, rotated weekly top 10
const OG_ROLE      = "🌟 OG";
const AGE_VERIFIED = "🔞 18+ Verified";

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function run() {
  console.log("🔄 Discord role sync starting\n");

  // 1. Fetch all Discord guild roles (for name → id lookup)
  const roles = await api("GET", `/guilds/${GUILD_ID}/roles`);
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  const proRoleId = roleByName[PRO_ROLE];
  const vipRoleId = roleByName[VIP_ROLE];
  const topFanRoleId = roleByName[TOP_FAN_ROLE];
  const ogRoleId = roleByName[OG_ROLE];
  const ageVerifiedId = roleByName[AGE_VERIFIED];

  console.log(`Roles: pro=${proRoleId} vip=${vipRoleId} topFan=${topFanRoleId} og=${ogRoleId}`);

  // 2. Connect to PG + fetch linked users with their state
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Top 10 users by score (Top Contributor role)
    const { rows: top10Rows } = await client.query(
      `SELECT s.user_id FROM user_stats s
       WHERE s.score > 0
       ORDER BY s.score DESC
       LIMIT 10`
    );
    const top10Ids = new Set(top10Rows.map((r) => String(r.user_id)));

    // All linked Discord users with their state
    const { rows: users } = await client.query(
      `SELECT
         u.id            AS user_id,
         u.pro_status,
         u.pro_plan,
         o.provider_user_id AS discord_id,
         COALESCE(s.score, 0)         AS score,
         COALESCE(s.current_streak, 0) AS current_streak,
         u.created_at    AS joined_at
       FROM users u
       JOIN user_oauth_accounts o
         ON o.user_id = u.id AND o.provider = 'discord'
       LEFT JOIN user_stats s
         ON s.user_id = u.id`
    );

    console.log(`${users.length} linked Discord users to sync\n`);

    let synced = 0;
    let failed = 0;

    for (const u of users) {
      try {
        // Fetch current Discord member
        let member;
        try {
          member = await api("GET", `/guilds/${GUILD_ID}/members/${u.discord_id}`);
        } catch (err) {
          if (err.status === 404) {
            console.log(`  ⚠ ${u.discord_id} left the guild, skipping`);
            continue;
          }
          throw err;
        }

        const currentRoles = new Set(member.roles || []);

        // Compute desired state
        const wantsPro = u.pro_status === "active" || u.pro_status === "past_due";
        const wantsVip = u.pro_status === "lifetime";
        const wantsTopFan = top10Ids.has(String(u.user_id));
        const joinedAt = new Date(u.joined_at);
        const wantsOg = joinedAt < new Date("2026-05-01"); // OG = joined before May 2026

        // Build the set of roles we want them to have (additive — keep existing manual roles)
        const roleDeltas = [];

        const addIfMissing = (roleId, want, label) => {
          if (!roleId) return;
          const has = currentRoles.has(roleId);
          if (want && !has) roleDeltas.push({ type: "add", id: roleId, label });
          else if (!want && has) roleDeltas.push({ type: "remove", id: roleId, label });
        };

        addIfMissing(proRoleId,    wantsPro,    "Pro");
        addIfMissing(vipRoleId,    wantsVip,    "VIP");
        addIfMissing(topFanRoleId, wantsTopFan, "Top Contributor");
        addIfMissing(ogRoleId,     wantsOg,     "OG");

        if (roleDeltas.length === 0) {
          console.log(`  = ${u.discord_id} (no change)`);
          continue;
        }

        // Apply deltas
        for (const delta of roleDeltas) {
          if (delta.type === "add") {
            await api("PUT", `/guilds/${GUILD_ID}/members/${u.discord_id}/roles/${delta.id}`);
            console.log(`  + ${u.discord_id} → ${delta.label}`);
          } else {
            await api("DELETE", `/guilds/${GUILD_ID}/members/${u.discord_id}/roles/${delta.id}`);
            console.log(`  - ${u.discord_id} ← ${delta.label}`);
          }
          await sleep(400);
        }

        synced++;
      } catch (err) {
        failed++;
        console.log(`  ❌ ${u.discord_id}: ${err.message?.slice(0, 100)}`);
      }
    }

    console.log(`\n✨ Done: ${synced} synced, ${failed} failed`);
  } finally {
    await client.end();
  }
}

run().catch((err) => { console.error("❌", err); process.exit(1); });
