/**
 * scripts/discord-daily-drop.mjs
 *
 * Posts the "Daily Drop" — one hand-picked banger per day — to #🔥-daily-drop.
 *
 * Picks: a random clip from the top 500 videos by score, filtered to those
 * with a real thumbnail. Deterministic per UTC day (same pick within a day
 * even if the script runs multiple times).
 *
 * Runs via GitHub Actions cron daily at 06:00 UTC.
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
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

const BANNED_TAGS = [
  "loli","lolicon","lolidom","loli_focus","shota","shotacon","shotadom","shota_focus",
  "child","children","minor","underage","toddler","toddlercon","infant",
  "young_girl","young_boy","child_on_child","cub","baby","oppai_loli","legal_loli",
  "elementary_school","kindergarten","randoseru",
];

function todaySeed() {
  // Deterministic seed per UTC day
  const today = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function buildTitle(video) {
  if (video.title && video.title.trim()) return titleCase(video.title.replace(/_/g, " "));
  if (video.characters?.[0]) return titleCase(video.characters[0].replace(/_/g, " "));
  if (video.copyrights?.[0]) return titleCase(video.copyrights[0].replace(/_/g, " "));
  return "Animated Hentai";
}

async function run() {
  console.log("🔥 Daily Drop bot starting");

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Pick the daily drop deterministically from the top 500 by score
    const { rows } = await client.query(
      `SELECT source, source_id, slug, title, thumbnail, preview, score,
              tags, characters, copyrights, duration
       FROM videos
       WHERE thumbnail IS NOT NULL AND thumbnail <> ''
         AND NOT (tags && $1::text[])
       ORDER BY score DESC
       LIMIT 500`,
      [BANNED_TAGS]
    );

    if (rows.length === 0) {
      console.log("No videos available");
      return;
    }

    const index = todaySeed() % rows.length;
    const video = rows[index];
    console.log(`Picked: ${video.slug} (score: ${video.score})`);

    // Find the #🔥-daily-drop channel
    const channels = await api("GET", `/guilds/${GUILD_ID}/channels`);
    const channel = channels.find((c) => c.name === "🔥-daily-drop");
    if (!channel) {
      console.log("Channel #🔥-daily-drop not found");
      return;
    }

    // Check if we already posted today (dedup)
    const todayStr = new Date().toISOString().slice(0, 10);
    const recent = await api("GET", `/channels/${channel.id}/messages?limit=5`);
    for (const msg of recent) {
      if (msg.timestamp?.startsWith(todayStr)) {
        console.log("Already posted today, skipping");
        return;
      }
    }

    // Build rich embed
    const title = buildTitle(video);
    const videoUrl = `https://iku.gg/watch/${video.slug}`;
    const formatDuration = (s) => {
      if (!s) return null;
      const m = Math.floor(s / 60);
      const r = Math.floor(s % 60);
      return `${m}:${r.toString().padStart(2, "0")}`;
    };

    const meaningfulTags = (video.tags || [])
      .filter((t) => !["animated","video","sound","tagme","highres","1girl","1boy","solo"].includes(t.toLowerCase()))
      .slice(0, 4)
      .map((t) => `\`${t.replace(/_/g, " ")}\``)
      .join(" ");

    const embed = {
      title: `🔥 ${title}`,
      url: videoUrl,
      description: `**Today's Daily Drop** — hand-picked by the algorithm for your pleasure\n\n${meaningfulTags ? `**Tags:** ${meaningfulTags}\n` : ""}${video.duration ? `**Duration:** ${formatDuration(video.duration)}\n` : ""}`,
      color: 0xff6b9d,
      image: { url: video.thumbnail },
      footer: { text: "iku.gg · new drop every day at 06:00 UTC" },
      timestamp: new Date().toISOString(),
    };

    await api("POST", `/channels/${channel.id}/messages`, {
      content: `✨ **${title}**\n${videoUrl}`,
      embeds: [embed],
    });

    console.log("✓ posted to #🔥-daily-drop");
  } finally {
    await client.end();
  }
}

run().catch((err) => { console.error("❌", err); process.exit(1); });
