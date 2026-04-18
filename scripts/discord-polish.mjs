/**
 * scripts/discord-polish.mjs — apply server-wide settings + generate assets
 *
 * What it does (idempotent):
 *   1. Render a 512x512 PNG icon from the iku logo SVG → upload as server icon
 *   2. Render a 960x540 PNG banner with iku branding → try to upload (only works if boost level 2+)
 *   3. Update server description
 *   4. Enable Community features (requires rules + public_updates channels)
 *   5. Set up welcome screen
 *   6. Create a permanent invite link in #👋-welcome
 *   7. Configure native Discord Onboarding (role prompts) as a replacement for Carl-bot reaction roles
 */

import sharp from "sharp";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
if (!BOT_TOKEN || !GUILD_ID) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
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
  if (!res.ok) {
    const err = new Error(`${method} ${path}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ────────────────────────────────────────────────────────────────
// Render assets
// ────────────────────────────────────────────────────────────────

async function renderIcon() {
  // 512x512 gradient square with "iku" + sparkle — bigger and bolder than the 32px favicon
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6b9d"/>
      <stop offset="50%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <circle cx="128" cy="128" r="80" fill="#ffffff" opacity="0.15" filter="url(#blur)"/>
  <circle cx="400" cy="400" r="100" fill="#ffffff" opacity="0.12" filter="url(#blur)"/>
  <text x="256" y="340" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="240"
        fill="#ffffff"
        letter-spacing="-8">iku</text>
  <text x="420" y="170" font-size="80" fill="#ffffff" opacity="0.9">✨</text>
</svg>`.trim();

  return sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
}

async function renderBanner() {
  // 960x540 banner (Discord recommends 960×540, 16:9)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0b2e"/>
      <stop offset="50%" stop-color="#2d1b4e"/>
      <stop offset="100%" stop-color="#1a0b2e"/>
    </linearGradient>
    <linearGradient id="gpink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6b9d"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="blur2">
      <feGaussianBlur stdDeviation="60"/>
    </filter>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/>
  <circle cx="200" cy="150" r="180" fill="#ff6b9d" opacity="0.35" filter="url(#blur2)"/>
  <circle cx="800" cy="400" r="200" fill="#c084fc" opacity="0.35" filter="url(#blur2)"/>
  <circle cx="600" cy="100" r="120" fill="#818cf8" opacity="0.30" filter="url(#blur2)"/>

  <text x="480" y="260" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900" font-size="140" fill="url(#gpink)"
        letter-spacing="-4">iku.gg</text>
  <text x="480" y="330" text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="700" font-size="32" fill="#ffffff" opacity="0.9">
    353,000+ animated hentai · free forever
  </text>
  <text x="480" y="400" text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="600" font-size="22" fill="#ff6b9d" opacity="0.85">
    ✨ the biggest community-driven hentai library ✨
  </text>
</svg>`.trim();

  return sharp(Buffer.from(svg)).resize(960, 540).png().toBuffer();
}

function toDataURI(buf) {
  return "data:image/png;base64," + buf.toString("base64");
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

async function run() {
  console.log("🎨 iku.gg Discord — polish pass\n");

  // 1. Channels (need ids for rules/updates channels + invite creation)
  console.log("▸ Loading channels");
  const channels = await api("GET", `/guilds/${GUILD_ID}/channels`);
  const byName = Object.fromEntries(channels.map((c) => [c.name, c]));
  const welcome = byName["👋-welcome"];
  const rules = byName["📜-rules"];
  const announcements = byName["📣-announcements"];
  if (!welcome || !rules || !announcements) {
    throw new Error("Required channels missing — run setup-discord.mjs first");
  }

  // 2. Render + upload icon
  console.log("\n▸ Rendering server icon (512×512)");
  const iconBuf = await renderIcon();
  console.log(`  ${iconBuf.length} bytes`);

  console.log("▸ Uploading server icon + description");
  await api("PATCH", `/guilds/${GUILD_ID}`, {
    icon: toDataURI(iconBuf),
    description:
      "353,000+ free animated hentai clips. Community, curation, creators. 18+ only.",
  });
  console.log("  ✓ icon + description updated");
  await sleep(500);

  // 3. Try banner (requires boost tier 2 — will fail gracefully)
  console.log("\n▸ Rendering banner (960×540)");
  const bannerBuf = await renderBanner();
  try {
    await api("PATCH", `/guilds/${GUILD_ID}`, {
      banner: toDataURI(bannerBuf),
    });
    console.log("  ✓ banner uploaded");
  } catch (err) {
    console.log(`  ⚠ banner skipped — requires boost level 2+ (${err.status})`);
  }

  // 4. Enable Community
  console.log("\n▸ Enabling Community features");
  try {
    await api("PATCH", `/guilds/${GUILD_ID}`, {
      features: ["COMMUNITY"],
      rules_channel_id: rules.id,
      public_updates_channel_id: announcements.id,
      verification_level: 1, // LOW — must have a verified email
      default_message_notifications: 1, // ONLY_MENTIONS
      explicit_content_filter: 2, // ALL_MEMBERS
      preferred_locale: "en-US",
    });
    console.log("  ✓ Community enabled");
  } catch (err) {
    console.log(`  ⚠ community enable failed: ${err.message}`);
  }
  await sleep(1000);

  // 5. Welcome screen
  console.log("\n▸ Setting welcome screen");
  const rolesAndTags = byName["🎭-roles-and-tags"];
  const generalChat = byName["💬-general-chat"];
  const introductions = byName["👋-introductions"];
  try {
    await api("PATCH", `/guilds/${GUILD_ID}/welcome-screen`, {
      enabled: true,
      description:
        "The biggest animated hentai community. 353K+ clips, forums, creators, watch parties. 18+ only.",
      welcome_channels: [
        {
          channel_id: rules.id,
          description: "Read the rules first",
          emoji_name: "📜",
        },
        {
          channel_id: rolesAndTags?.id || rules.id,
          description: "Pick your taste & verify 18+",
          emoji_name: "🎭",
        },
        {
          channel_id: introductions?.id || rules.id,
          description: "Say hi to the community",
          emoji_name: "👋",
        },
        {
          channel_id: generalChat?.id || rules.id,
          description: "Jump in the chat",
          emoji_name: "💬",
        },
      ].slice(0, 5),
    });
    console.log("  ✓ welcome screen configured");
  } catch (err) {
    console.log(`  ⚠ welcome screen failed: ${err.message}`);
  }

  // 6. Native Onboarding (Discord's built-in role selection)
  console.log("\n▸ Configuring native Onboarding (role prompts)");

  const roles = await api("GET", `/guilds/${GUILD_ID}/roles`);
  const rolesByName = Object.fromEntries(roles.map((r) => [r.name, r]));

  const ageRole = rolesByName["🔞 18+ Verified"];
  const tasteRoleNames = [
    "💗 Vanilla",
    "🎮 3D",
    "✨ Futa",
    "👹 Monster",
    "🧚 Fantasy",
    "🎒 Schoolgirl",
    "🎀 Maid",
    "🧝 Elf",
    "🐱 Catgirl",
    "🐙 Tentacles",
    "🔥 Uncensored",
    "💋 MILF",
    "😵 Ahegao",
    "🍦 Creampie",
    "👥 Group",
  ];
  const tasteEmojis = {
    "💗 Vanilla": "💗",
    "🎮 3D": "🎮",
    "✨ Futa": "✨",
    "👹 Monster": "👹",
    "🧚 Fantasy": "🧚",
    "🎒 Schoolgirl": "🎒",
    "🎀 Maid": "🎀",
    "🧝 Elf": "🧝",
    "🐱 Catgirl": "🐱",
    "🐙 Tentacles": "🐙",
    "🔥 Uncensored": "🔥",
    "💋 MILF": "💋",
    "😵 Ahegao": "😵",
    "🍦 Creampie": "🍦",
    "👥 Group": "👥",
  };

  // Channels a new user should always see before role selection
  const defaultChannelIds = [
    welcome.id,
    rules.id,
    introductions?.id,
    generalChat?.id,
  ].filter(Boolean);

  const prompts = [];

  // Prompt 1: Age verification (single select, required)
  if (ageRole) {
    prompts.push({
      id: "0",
      type: 0, // MULTIPLE_CHOICE
      title: "Are you 18 or older?",
      single_select: true,
      required: true,
      in_onboarding: true,
      options: [
        {
          id: "0",
          title: "Yes, I am 18+",
          description: "This unlocks all NSFW content channels.",
          emoji: { name: "🔞" },
          role_ids: [ageRole.id],
          channel_ids: [],
        },
      ],
    });
  }

  // Prompt 2+: Taste roles (multi-select, max 7 options per prompt)
  const toOption = (n, i) => ({
    id: String(i),
    title: n.replace(/^[^\s]+\s/, ""),
    description: "",
    emoji: { name: tasteEmojis[n] },
    role_ids: [rolesByName[n].id],
    channel_ids: [],
  });

  const mainTastes = [
    "💗 Vanilla",
    "🎮 3D",
    "✨ Futa",
    "👹 Monster",
    "🧚 Fantasy",
    "🔥 Uncensored",
    "💋 MILF",
  ].filter((n) => rolesByName[n]);
  const kinkTastes = [
    "🎒 Schoolgirl",
    "🎀 Maid",
    "🧝 Elf",
    "🐱 Catgirl",
    "🐙 Tentacles",
    "😵 Ahegao",
    "🍦 Creampie",
    "👥 Group",
  ].filter((n) => rolesByName[n]);

  if (mainTastes.length > 0) {
    prompts.push({
      id: "1",
      type: 0,
      title: "What genres do you like?",
      single_select: false,
      required: false,
      in_onboarding: true,
      options: mainTastes.map(toOption),
    });
  }
  if (kinkTastes.length > 0) {
    prompts.push({
      id: "2",
      type: 0,
      title: "Any specific kinks or aesthetics?",
      single_select: false,
      required: false,
      in_onboarding: true,
      options: kinkTastes.map(toOption),
    });
  }

  try {
    await api("PUT", `/guilds/${GUILD_ID}/onboarding`, {
      prompts,
      default_channel_ids: defaultChannelIds,
      enabled: true,
      mode: 0, // ONBOARDING_DEFAULT
    });
    console.log(`  ✓ onboarding configured with ${prompts.length} prompts`);
  } catch (err) {
    console.log(`  ⚠ onboarding failed: ${err.message}`);
  }

  // 7. Create a permanent vanity-ish invite
  console.log("\n▸ Creating permanent invite link");
  try {
    const invite = await api("POST", `/channels/${welcome.id}/invites`, {
      max_age: 0, // never expires
      max_uses: 0, // unlimited
      temporary: false,
      unique: true,
    });
    console.log(`  ✓ invite: https://discord.gg/${invite.code}`);
  } catch (err) {
    console.log(`  ⚠ invite creation failed: ${err.message}`);
  }

  console.log("\n✨ Polish done!");
}

run().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
