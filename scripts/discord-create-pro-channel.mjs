/**
 * Creates the Pro-only Discord channel #pro-lounge under the "💎 VIP LOUNGE"
 * category, with permissions: @everyone denied VIEW_CHANNEL, Pro + VIP roles
 * allowed VIEW_CHANNEL + SEND_MESSAGES.
 *
 * Posts a welcome message once created. Idempotent.
 */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
if (!BOT_TOKEN || !GUILD_ID) {
  console.error("Missing env");
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
    const r = await res.json();
    await new Promise((x) => setTimeout(x, (r.retry_after + 0.5) * 1000));
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Permission flags
const VIEW_CHANNEL = 1024n;
const SEND_MESSAGES = 2048n;
const ADD_REACTIONS = 64n;
const EMBED_LINKS = 16384n;
const ATTACH_FILES = 32768n;
const READ_HISTORY = 65536n;

const ALLOW_PRO = String(
  VIEW_CHANNEL |
    SEND_MESSAGES |
    ADD_REACTIONS |
    EMBED_LINKS |
    ATTACH_FILES |
    READ_HISTORY,
);

async function run() {
  console.log("💎 Configuring Pro-only channel + permissions\n");

  const channels = await api("GET", `/guilds/${GUILD_ID}/channels`);
  const roles = await api("GET", `/guilds/${GUILD_ID}/roles`);

  const proRole = roles.find((r) => r.name === "✨ Pro");
  const vipRole = roles.find((r) => r.name === "💎 VIP");
  const everyoneRoleId = GUILD_ID;

  if (!proRole || !vipRole) {
    console.log("⚠ Pro or VIP role missing — run setup-discord.mjs first");
    return;
  }

  const category = channels.find(
    (c) => c.type === 4 && c.name === "💎 VIP LOUNGE",
  );
  if (!category) {
    console.log("⚠ VIP LOUNGE category missing");
    return;
  }

  // Find existing pro-lounge channel or create it
  const existing = channels.find(
    (c) => c.name === "✨-pro-lounge" && c.parent_id === category.id,
  );
  let channel = existing;
  if (!channel) {
    channel = await api("POST", `/guilds/${GUILD_ID}/channels`, {
      name: "✨-pro-lounge",
      type: 0,
      parent_id: category.id,
      topic:
        "Private lounge for iku.gg Pro + VIP members. Early drops, direct founder access.",
    });
    console.log(`+ created ${channel.name}`);
    await sleep(500);
  } else {
    console.log(`= ${channel.name} already exists`);
  }

  // Set permission overrides
  console.log("🔒 Setting permissions");

  // Deny @everyone
  await api("PUT", `/channels/${channel.id}/permissions/${everyoneRoleId}`, {
    id: everyoneRoleId,
    type: 0,
    deny: String(VIEW_CHANNEL),
  });
  console.log("  - @everyone denied VIEW_CHANNEL");
  await sleep(400);

  // Allow Pro
  await api("PUT", `/channels/${channel.id}/permissions/${proRole.id}`, {
    id: proRole.id,
    type: 0,
    allow: ALLOW_PRO,
  });
  console.log("  + ✨ Pro allowed view + send");
  await sleep(400);

  // Allow VIP
  await api("PUT", `/channels/${channel.id}/permissions/${vipRole.id}`, {
    id: vipRole.id,
    type: 0,
    allow: ALLOW_PRO,
  });
  console.log("  + 💎 VIP allowed view + send");
  await sleep(400);

  // Post welcome message once (check if channel is empty)
  const msgs = await api("GET", `/channels/${channel.id}/messages?limit=1`);
  if (!Array.isArray(msgs) || msgs.length === 0) {
    const welcome = `# ✨ Welcome to the Pro Lounge

**You're in the club.** This channel is exclusive to **✨ Pro** and **💎 VIP** members of iku.gg.

## What happens here
- 🔥 **Early drops** — new banger clips posted 48h before everyone else
- 💬 **Direct line to the founder** — ask questions, request features, get answers
- 🎁 **Exclusive perks** — curator picks, beta features, voting on future content
- 🏆 **Pro community** — meet other power users of iku.gg

## Perks you unlocked with Pro
> 🚫 Zero ads forever
> ❤️ Unlimited favorites
> 📚 Extended watch history
> 🎯 Early access to new clips (48h before public)
> 💎 Pro badge on profile + Discord
> 📂 Unlimited private playlists
> ⚡ Priority video loading
> 🎮 Access to this channel

Thanks for supporting iku.gg. Let's make it the best animated hentai library on the internet 💖

— *the iku.gg team*`;

    await api("POST", `/channels/${channel.id}/messages`, { content: welcome });
    console.log("✓ welcome message posted");
  } else {
    console.log("= welcome message already present");
  }

  console.log(`\n✨ Done — #${channel.name} is live`);
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
