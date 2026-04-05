/**
 * Delete the stale "react to get roles" message in #🎭-roles-and-tags
 * and replace it with a message that points to the native Onboarding.
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

const NEW_MESSAGE = `# 🎭 Your Roles — Self-Serve

**There's no "react here" thing. Discord has a much better native system.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚀 How to pick / change your roles

**Method 1 — Onboarding (for new members)**
When you join the server, Discord automatically walks you through 3 prompts:
1. 🔞 **Age verification** → grants the **18+ Verified** role (required for NSFW channels)
2. 🎨 **Main genres** → Vanilla, 3D, Futa, Monster, Fantasy, Uncensored, MILF
3. 🎨 **Specific kinks** → Schoolgirl, Maid, Elf, Catgirl, Tentacles, Ahegao, Creampie, Group

**Method 2 — Channels & Roles (any time)**
At the top of the channel list on the left, click **✨ Channels & Roles**. You can pick/unpick any taste role whenever you want.

*(If you don't see "Channels & Roles", your Discord might be outdated — refresh or update the app.)*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🌟 Earned roles (not self-serve)

> 🌟 **OG** — Joined before the public launch (auto-assigned)
> 📣 **Contributor** — Active helpers (bug reports, suggestions, feedback)
> 🏆 **Top Contributor** — Top 10 most active members each month
> 🎨 **Verified Creator** — Animators / artists (DM a mod with your portfolio)
> 💎 **VIP** — Patreon supporters (linked on signup)
> ✨ **Pro** — iku.gg Pro subscribers (coming soon)
> 🚀 **Server Booster** — Boost the server and get the role automatically

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Privacy note:** Your taste roles are visible to other members. If you want to stay private, just skip the taste prompts — you'll still have access to everything, the genre forums are open to all 18+ Verified members.`;

async function run() {
  const channels = await api("GET", `/guilds/${GUILD_ID}/channels`);
  const target = channels.find((c) => c.name === "🎭-roles-and-tags");
  if (!target) {
    console.log("❌ channel #🎭-roles-and-tags not found");
    return;
  }
  console.log(`Found channel: ${target.id}`);

  // Fetch last 50 messages (likely only 1 from the bot, but be safe)
  const messages = await api("GET", `/channels/${target.id}/messages?limit=50`);
  console.log(`Found ${messages.length} existing messages`);

  // Delete all existing messages posted by our bot
  const me = await api("GET", "/users/@me");
  const mine = messages.filter((m) => m.author?.id === me.id);
  console.log(`${mine.length} of those are from our bot — deleting`);
  for (const msg of mine) {
    await api("DELETE", `/channels/${target.id}/messages/${msg.id}`);
    await new Promise((r) => setTimeout(r, 400));
  }

  // Post new message
  console.log("Posting new message…");
  await api("POST", `/channels/${target.id}/messages`, { content: NEW_MESSAGE });
  console.log("✅ done");
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
