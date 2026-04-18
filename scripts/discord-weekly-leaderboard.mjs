/**
 * scripts/discord-weekly-leaderboard.mjs
 *
 * Posts the weekly leaderboard (top 10 users by score) every Monday at 09:00 UTC
 * to a designated Discord channel.
 *
 * Runs via GitHub Actions cron.
 */

import pg from "pg";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN || !GUILD_ID || !DATABASE_URL) {
  console.error("Missing env vars");
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
    await new Promise((r) => setTimeout(r, (retry.retry_after + 0.5) * 1000));
    return api(method, path, body);
  }
  if (res.status === 204) return {};
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

const TIER_NAME = (score) => {
  if (score >= 50000) return "🔥 Hentai Sage";
  if (score >= 15000) return "💎 Waifu Scholar";
  if (score >= 5000) return "🎮 Otaku";
  if (score >= 1000) return "⭐ Senpai";
  if (score >= 200) return "🌸 Kouhai";
  return "🌙 Wanderer";
};

const MEDAL = (i) =>
  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`#${i + 1}\``;

async function run() {
  console.log("🏆 Weekly leaderboard starting");

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT u.username, u.avatar_emoji, s.score, s.current_streak,
              s.total_views, s.total_favorites
       FROM user_stats s
       JOIN users u ON u.id = s.user_id
       WHERE s.score > 0
       ORDER BY s.score DESC
       LIMIT 10`,
    );

    const channels = await api("GET", `/guilds/${GUILD_ID}/channels`);
    // Post to announcements for now — dedicated leaderboard channel can be created later
    const channel =
      channels.find((c) => c.name === "📣-announcements") ||
      channels.find((c) => c.name === "💬-general-chat");
    if (!channel) {
      console.log("No target channel found");
      return;
    }

    if (rows.length === 0) {
      await api("POST", `/channels/${channel.id}/messages`, {
        content:
          "🏆 **Weekly Leaderboard** — no activity yet. Be the first to score some points!",
      });
      return;
    }

    // Build the embed
    const lines = rows.map(
      (u, i) =>
        `${MEDAL(i)}  ${u.avatar_emoji} **${u.username}** · ${TIER_NAME(u.score)} · **${u.score.toLocaleString()}** pts · 🔥 ${u.current_streak}`,
    );

    const embed = {
      title: "🏆 Weekly Leaderboard",
      description:
        "The top 10 iku.gg fans by total score.\nEarn points by watching, favoriting, and building streaks. Compete for the **Top Contributor** role!\n\n" +
        lines.join("\n"),
      color: 0xc084fc,
      footer: { text: "Updated every Monday · iku.gg/profile" },
      timestamp: new Date().toISOString(),
    };

    await api("POST", `/channels/${channel.id}/messages`, {
      content: "🏆 **Weekly Leaderboard is live** — check where you stand ⬇️",
      embeds: [embed],
    });

    console.log(`✓ posted leaderboard with ${rows.length} entries`);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
