/**
 * scripts/setup-discord.mjs — iku.gg Discord server bootstrap (BANGER edition)
 *
 * Creates categories, text/forum/voice channels, roles, permissions, and populates
 * welcome/rules/FAQ messages for the iku.gg community. Idempotent.
 *
 * Usage:
 *   DISCORD_BOT_TOKEN=<token> DISCORD_GUILD_ID=<guild> node scripts/setup-discord.mjs
 */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!BOT_TOKEN || !GUILD_ID) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID env var.");
  process.exit(1);
}

const API = "https://discord.com/api/v10";
const headers = {
  Authorization: `Bot ${BOT_TOKEN}`,
  "Content-Type": "application/json",
};

// Discord channel types
const CHANNEL_TYPE = {
  TEXT: 0,
  VOICE: 2,
  CATEGORY: 4,
  ANNOUNCEMENT: 5,
  FORUM: 15,
};

// Discord permission flags (BigInt strings)
const PERMS = {
  VIEW_CHANNEL: 1024n,
  SEND_MESSAGES: 2048n,
  CONNECT: 1048576n,
  SPEAK: 2097152n,
};

// ────────────────────────────────────────────────────────────────
// HTTP helper with rate-limit handling
// ────────────────────────────────────────────────────────────────
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
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════════
//                        BLUEPRINT
// ════════════════════════════════════════════════════════════════

/** Category display order (category name → emoji prefix for display) */
const CATEGORIES_ORDER = [
  "✦ START HERE",
  "💬 COMMUNITY",
  "🔥 TRENDING & DROPS",
  "🎭 BY GENRE",
  "💖 CHARACTERS & SERIES",
  "🎨 CREATORS CORNER",
  "🎙️ VOICE & WATCH PARTIES",
  "🛠️ SUPPORT",
  "💎 VIP LOUNGE",
  "🤖 BOT ZONE",
];

/**
 * Channels per category.
 *  - type: "text" | "forum" | "voice" (default "text")
 *  - locked: @everyone cannot send
 *  - nsfw: Discord NSFW flag
 *  - topic: channel topic
 */
const CHANNELS = {
  "✦ START HERE": [
    { name: "👋-welcome",          locked: true,  topic: "Start here. Everything you need to know." },
    { name: "📜-rules",            locked: true,  topic: "Read before posting. 18+ only." },
    { name: "📣-announcements",    locked: true,  topic: "Site updates, new features, milestones." },
    { name: "📰-changelog",        locked: true,  topic: "Every deploy. What shipped, when." },
    { name: "🎭-roles-and-tags",   locked: true,  topic: "React to pick your taste roles + age-verify." },
    { name: "❓-faq",              locked: true,  topic: "Answers to common questions." },
  ],
  "💬 COMMUNITY": [
    { name: "💬-general-chat",     topic: "Open chat. Be nice. 18+ vibes, SFW posts." },
    { name: "👋-introductions",    topic: "Say hi. Where you from? What's your taste?" },
    { name: "🎌-anime-weeb-talk",  topic: "Anime, manga, seasonal shows. No iku-only." },
    { name: "💭-off-topic",        topic: "Games, music, life, random stuff." },
    { name: "😂-memes",            topic: "Memes, shitposts, anime reactions." },
    { name: "💡-suggestions",      topic: "Ideas to make iku.gg better. React 👍 to support." },
  ],
  "🔥 TRENDING & DROPS": [
    { name: "🔥-daily-drop",       nsfw: true,  locked: true, topic: "One hand-picked banger every day. Posted by staff." },
    { name: "⭐-weekly-top",       nsfw: true,  locked: true, topic: "The 10 best clips of the week. Curated." },
    { name: "🆕-new-releases",     nsfw: true,  locked: true, topic: "Fresh scrapes auto-posted by the bot (5000+ / week)." },
    { name: "💎-hidden-gems",      nsfw: true,                topic: "Underrated clips you want people to see." },
    { name: "🎯-recommend-me",     nsfw: true,  type: "forum", topic: "Describe your taste — get matched. One request per thread." },
    { name: "🏷️-request-by-tag",   nsfw: true,  type: "forum", topic: "Looking for a specific tag/character/series? Ask here." },
  ],
  "🎭 BY GENRE": [
    { name: "💗-vanilla",           nsfw: true, type: "forum", topic: "Sweet, romantic, wholesome lewds." },
    { name: "🎮-3d-blender-koikatsu", nsfw: true, type: "forum", topic: "3D animations — Blender, Koikatsu, MMD, Honey Select." },
    { name: "✨-futa",              nsfw: true, type: "forum", topic: "Futanari everything." },
    { name: "👹-monster-fantasy",    nsfw: true, type: "forum", topic: "Orcs, demons, beasts, elves, all things fantastical." },
    { name: "🎒-schoolgirl-uniform", nsfw: true, type: "forum", topic: "Uniforms, schoolgirl aesthetic. All characters 18+." },
    { name: "🧝-elf-maid-catgirl",   nsfw: true, type: "forum", topic: "Fantasy races + service class kinks." },
    { name: "🐙-tentacles-kinky",    nsfw: true, type: "forum", topic: "Tentacles, monster girls, kinky stuff." },
    { name: "💋-milf-older",         nsfw: true, type: "forum", topic: "MILFs, older women, mature." },
    { name: "😵-ahegao",             nsfw: true, type: "forum", topic: "Face expressions, ahegao, rolling eyes." },
    { name: "🔥-uncensored-only",    nsfw: true, type: "forum", topic: "Uncensored clips only. No mosaics." },
  ],
  "💖 CHARACTERS & SERIES": [
    { name: "👑-character-of-the-week", nsfw: true, locked: true, topic: "Staff pick every Monday. Vote in polls." },
    { name: "💖-character-polls",        nsfw: true, topic: "Vote on the hottest character of the month." },
    { name: "📺-series-discussion",      nsfw: true, topic: "Talk about specific hentai series / doujinshi." },
    { name: "🎭-cosplay-share",          topic: "SFW cosplay pics (no NSFW in this one)." },
  ],
  "🎨 CREATORS CORNER": [
    { name: "🖌️-artist-showcase", topic: "Share your own art / animations. Credit yourself. No reposts." },
    { name: "🎬-animation-wip",    topic: "Work-in-progress clips. Get feedback." },
    { name: "📚-tutorials-tips",   topic: "Blender, Koikatsu, Live2D, MMD tutorials." },
    { name: "💼-commissions",      topic: "Accepting / looking for commissions. Post rates." },
    { name: "🤝-collab-requests",  topic: "Find collaborators. Riggers, animators, voice, writers." },
  ],
  "🎙️ VOICE & WATCH PARTIES": [
    { name: "🔊 General Voice",    type: "voice" },
    { name: "🎬 Watch Party 1",    type: "voice", nsfw: true },
    { name: "🎬 Watch Party 2",    type: "voice", nsfw: true },
    { name: "🎮 Gaming",           type: "voice" },
    { name: "💤 AFK",              type: "voice" },
  ],
  "🛠️ SUPPORT": [
    { name: "🐛-bug-reports",   topic: "Found a bug? Screenshot + URL + what you expected." },
    { name: "💬-help-desk",     topic: "Site issues, account problems, video won't play — ask here." },
    { name: "💭-feedback",      topic: "Honest feedback on the site. Good or bad." },
  ],
  "💎 VIP LOUNGE": [
    { name: "🌟-vip-chat",        topic: "Private chat for VIPs. Direct line to the founder." },
    { name: "🎁-pro-perks",       topic: "Exclusive previews and perks for Pro members." },
    { name: "🔮-early-access",    topic: "Features before anyone else sees them." },
    { name: "🏆-top-fans",        topic: "Monthly leaderboard winners." },
  ],
  "🤖 BOT ZONE": [
    { name: "🤖-bot-commands",   topic: "Slash commands, bot spam, test your commands here." },
    { name: "📊-server-stats",   locked: true, topic: "Auto-updated server stats. Coming soon." },
  ],
};

/** Roles — hoisted = shown separately in member sidebar */
const ROLES = [
  // ─── Staff & VIP (hoisted) ──────────────────────────────────
  { name: "🌸 Founder",        color: 0xff6b9d, hoist: true },
  { name: "⚔️ Moderator",      color: 0xef4444, hoist: true },
  { name: "🛡️ Helper",         color: 0xf97316, hoist: true },
  // ─── Paid tiers (hoisted) ───────────────────────────────────
  { name: "💎 VIP",            color: 0xfbbf24, hoist: true },
  { name: "✨ Pro",            color: 0xc084fc, hoist: true },
  { name: "🚀 Server Booster", color: 0xf472b6, hoist: true },
  // ─── Community tiers (hoisted) ──────────────────────────────
  { name: "🎨 Verified Creator", color: 0x67e8f9, hoist: true },
  { name: "🏆 Top Contributor",  color: 0xa855f7, hoist: true },
  { name: "📣 Contributor",      color: 0x4ade80, hoist: true },
  { name: "🌟 OG",               color: 0xffd700, hoist: true },
  // ─── Gating (hoisted, most important) ───────────────────────
  { name: "🔞 18+ Verified",     color: 0xdc2626, hoist: true },
  // ─── Interest / Taste roles (NOT hoisted, gray) ─────────────
  { name: "💗 Vanilla",         color: 0x64748b },
  { name: "🎮 3D",              color: 0x64748b },
  { name: "✨ Futa",            color: 0x64748b },
  { name: "👹 Monster",         color: 0x64748b },
  { name: "🧚 Fantasy",         color: 0x64748b },
  { name: "🎒 Schoolgirl",      color: 0x64748b },
  { name: "🎀 Maid",            color: 0x64748b },
  { name: "🧝 Elf",             color: 0x64748b },
  { name: "🐱 Catgirl",         color: 0x64748b },
  { name: "🐙 Tentacles",       color: 0x64748b },
  { name: "🔥 Uncensored",      color: 0x64748b },
  { name: "💋 MILF",            color: 0x64748b },
  { name: "😵 Ahegao",          color: 0x64748b },
  { name: "🍦 Creampie",        color: 0x64748b },
  { name: "👥 Group",           color: 0x64748b },
];

/** Populated welcome / rules / FAQ messages */
const MESSAGES = {
  "👋-welcome": `# Welcome to iku.gg 🌸

**You just walked into the biggest animated hentai community on Discord.**

## 🎬 What is iku.gg?
The largest curated library of animated hentai on the web — **353,000+ clips**, 100% free, no account needed, no BS. We aggregate from the best sources (Rule34.xxx, Danbooru, Gelbooru, R34Video, and indie animators) and organize the chaos into something actually watchable.

## ✨ Why this Discord?
iku.gg isn't just another tube site. We're a community that **treats animated hentai like art**.
> 🔥 **Daily Drop** — one hand-picked banger posted every day
> 🆕 **New releases feed** — 5000+ new clips/week auto-posted (bot coming)
> 💬 **Genre forums** — dedicated threads for every kink, tidy and searchable
> 🎯 **Personal recs** — describe your taste, get matched
> 🎨 **Creators corner** — animators and artists share their WIPs
> 🎙️ **Watch parties** — voice channels to co-view clips with friends
> 💎 **Early access** — Pro members see features before anyone else

## 🚀 Your next 4 steps
**1.** 📜 Read **#📜-rules** (2 min, non-negotiable)
**2.** 🔞 Verify you're 18+ in **#🎭-roles-and-tags** → unlocks NSFW channels
**3.** 🎭 Pick your taste roles → auto-subscribes to matching genre channels
**4.** 👋 Say hi in **#👋-introductions**

## 🔗 Quick links
🌐 Main site → https://iku.gg
🔥 Trending → https://iku.gg/trending
⚡ Shorts (swipe feed) → https://iku.gg/feed
❤️ Characters → https://iku.gg/character
📚 Blog + glossary → https://iku.gg/blog

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Stream freely. Discuss openly. Respect creators.** 💖`,

  "📜-rules": `# Community Rules 📜

**TL;DR — Be 18+, don't post anything illegal, don't be a dick.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. You must be 18 or older 🔞
This is an 18+ community. Lying about your age = instant permanent ban + IP ban. **Zero tolerance.**

## 2. Nothing illegal, ever ⚠️
No loli, shota, or any content suggesting minors — **instant perma-ban, no appeal**. No real CSAM. No non-consensual real content. No animal content. We comply with 18 U.S.C. § 2257.

## 3. Keep NSFW in NSFW channels 🎭
SFW avatars and banners only. All explicit content **stays in NSFW-flagged channels** (the 🔞 category and forums). Character portraits in SFW channels must be clearly non-explicit.

## 4. Respect the community 💬
Attack ideas, not people. No personal attacks, doxxing, threats, or witch hunts.

## 5. No hate speech 🚫
Racism, antisemitism, homophobia, transphobia, ableism = instant ban.

## 6. Respect creators 🎨
Credit artists when you share their work. Link to source. Don't re-upload commissioned content without permission. Support artists on Patreon / Fanbox / Gumroad when you can.

## 7. No spam or unsolicited self-promo 📢
No posting your own site/socials in general chat. Use **#🖌️-artist-showcase** or **#💼-commissions** if you're a creator. Unsolicited DMs = ban.

## 8. English primary language 🌍
General chat is English so everyone can participate. Other languages welcome in threads and **#💭-off-topic**.

## 9. No begging for Pro / VIP 💎
The paid tiers exist to support the site. Begging for free VIP gets you kicked.

## 10. Mods have final say ⚔️
Mods can remove content and take action at their discretion. Disagree? DM a mod, don't argue publicly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**By participating in this server you confirm you are 18 or older and accept these rules.**

**Consequences**: Warn → Timeout → Kick → Ban.
**Instant permaban**: CSAM / loli-shota, doxxing, hate speech, ban evasion.`,

  "📣-announcements": `# 🚀 iku.gg is LIVE

**353,000+ animated hentai clips. Free. No account. No BS.**

After months of scraping, filtering, deduping, building, and fixing silent bugs — iku.gg is officially open to the public.

## 📦 What's inside
- **353K+ clips** from 5 curated sources (Danbooru, Gelbooru, Rule34.xxx, Rule34Video, WordPress sites)
- **3-layer content moderation** — nothing illegal reaches the site
- **Custom video player** — double-tap seek, PiP, theater mode, heart burst, progress scrub
- **Swipe feed** — TikTok-style shorts at https://iku.gg/feed
- **Smart search** — by character, tag, series, artist
- **20 curated genre collections** — real genres, not "1girl / solo / long hair"
- **User accounts** — sync favorites and history across devices (shipped today)
- **Discord OAuth** — sign in with your Discord account (shipped today)

## 🔮 Coming soon
- 🤖 **Discord bot** — new releases auto-posted to **#🆕-new-releases**
- 💎 **Pro membership** — no ads, early access, exclusive 4K clips, custom badge
- ⭐ **Rating system** — stars and reviews
- 🎨 **Creator program** — verified animator accounts with custom pages
- 🎙️ **Watch-together** — sync playback in voice channels

Welcome home. 💖`,

  "📰-changelog": `# Changelog

## 2026-04-05 — Auth + pixel-perfect UI 💎
- 🔐 **User accounts shipped** — email + password signup, Discord OAuth, profile page
- 💎 Avatar picker (20 emoji), password change, logout
- ❤️ Favorites + history auto-sync localStorage → PG on first login
- 🎨 Pixel-perfect homepage pass — rank badges, duration pills, genre tag pills, real scraped titles
- 🏷️ Browse by Genre → 20 curated sexy tags (fini "1girl / solo")
- 📝 Title case + dedup on all card titles

## 2026-04-04 — Silent bugs hunt 🐛
- Fixed Rule34Video playback — 78% of catalogue was silently broken (IP-bound tokens → added /api/video-stream proxy)
- Fixed search autocomplete — CSP was blocking the Danbooru API host
- Fixed character page 404s for Danbooru-style slugs
- Player mute race condition fixed
- ISR enabled on /watch pages — massive speed boost

## 2026-04-03 — PostgreSQL migration 🗄️
- 351K videos migrated from JSON files to PostgreSQL
- RAM usage: 800MB → 131MB (-83%)
- Scrapers now write directly to PG
- Build no longer needs 6GB heap

## 2026-04-02 — Security audit 🛡️
- Cloudflare CDN + DDoS + WAF enabled
- All API keys rotated and moved to Coolify env vars
- Rate limiting on all API routes
- CSP headers locked down
- **Purged 1,457 illegal videos** — 3-layer content filter live`,

  "🎭-roles-and-tags": `# 🎭 Pick Your Roles

**Step 1** — React with 🔞 to confirm you're 18+ and unlock NSFW channels.
**Step 2** — React with genre emojis to pick your taste roles (auto-subscribes you to matching forums).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔞 Age verification (required)
React: 🔞 → **I am 18 or older** ⚠️ *Required for NSFW channels*

## 🎨 Taste roles (react for each genre you enjoy)
React: 💗 → **Vanilla**
React: 🎮 → **3D** (Blender / Koikatsu / MMD)
React: ✨ → **Futa**
React: 👹 → **Monster**
React: 🧚 → **Fantasy**
React: 🎒 → **Schoolgirl**
React: 🎀 → **Maid**
React: 🧝 → **Elf**
React: 🐱 → **Catgirl**
React: 🐙 → **Tentacles**
React: 🔥 → **Uncensored**
React: 💋 → **MILF**
React: 😵 → **Ahegao**
React: 🍦 → **Creampie**
React: 👥 → **Group**

## 🌟 Earned roles (not self-serve)
> 🌟 **OG** — Joined before the public launch
> 📣 **Contributor** — Active helpers (bug reports, suggestions, feedback)
> 🏆 **Top Contributor** — Top 10 active members each month
> 🎨 **Verified Creator** — Animators/artists (DM a mod with portfolio)
> 💎 **VIP** — Patreon supporters
> ✨ **Pro** — iku.gg Pro subscribers (coming soon)
> 🚀 **Server Booster** — Boost the server

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Reaction roles are auto-configured by Carl-bot / MEE6. Until the bot is added, DM a mod for manual assignment.*`,

  "❓-faq": `# ❓ Frequently Asked Questions

## 🎬 About the site

**Q: Is iku.gg really free?**
Yes. 100% free, forever. Core library stays free. Optional Pro tier (ads off + early access + 4K) launching soon — everything else stays unlocked for everyone.

**Q: Do I need an account?**
No. All 353K clips are accessible without signup. Accounts just let you sync favorites and history across devices.

**Q: Where do the videos come from?**
We aggregate from 5 public sources: Danbooru, Gelbooru, Rule34.xxx, Rule34Video, and a curated set of WordPress sites. We don't host originals — we stream via a proxy to handle IP-bound tokens.

**Q: How is content moderated?**
3 layers: (1) scrapers filter banned tags at import, (2) server filters at query time, (3) database-level hardcoded block list. We've purged 1,457 illegal videos. **Zero tolerance** for anything involving minors. Report via **#🐛-bug-reports** → gone within hours.

**Q: Some videos don't play. Why?**
Some sources return IP-bound URLs that only work from their server. We resolve them server-side and proxy the bytes. First play can take 1-2 seconds; after that it's cached globally.

**Q: Can I download videos?**
The original sources allow it but we don't add download buttons for now. Focus is streaming.

## 🔐 Account & privacy

**Q: Is my data safe?**
We store: email, username (your choice), hashed password (bcrypt), DOB (for 18+ verification). That's it. No tracking, no third-party ad SDKs until monetization launches. Payments (when Pro launches) will go through Stripe.

**Q: Can I delete my account?**
Yes — DM a mod for now, self-serve delete button is coming.

**Q: Why do you need my date of birth?**
Legal requirement for 18+ verification (US 2257, EU AVMSD). It's never shown publicly, never shared with third parties.

## 🎭 Community

**Q: Can I submit my own videos / art?**
Not yet, but the **Creator Program** is coming. If you're an animator/artist, DM a mod with your portfolio to get **🎨 Verified Creator** early.

**Q: How do I become OG?**
You already are, if you're here before the public launch. OG role is auto-assigned to early members.

**Q: Can I advertise my Patreon / Fanbox?**
Only in **#💼-commissions** and **#🖌️-artist-showcase**. No self-promo in general chat.

**Q: I want to help moderate.**
DM the founder. We onboard trusted members over time.`,
};

// ════════════════════════════════════════════════════════════════
//                        EXECUTION
// ════════════════════════════════════════════════════════════════

let channelsCache = null;
let rolesCache = null;

async function refreshChannels() {
  channelsCache = await api("GET", `/guilds/${GUILD_ID}/channels`);
}

async function refreshRoles() {
  rolesCache = await api("GET", `/guilds/${GUILD_ID}/roles`);
}

async function getOrCreateCategory(name) {
  const existing = channelsCache.find(
    (c) => c.type === CHANNEL_TYPE.CATEGORY && c.name === name
  );
  if (existing) {
    console.log(`  = ${name}`);
    return existing;
  }
  const created = await api("POST", `/guilds/${GUILD_ID}/channels`, {
    name,
    type: CHANNEL_TYPE.CATEGORY,
  });
  console.log(`  + ${name}`);
  channelsCache.push(created);
  await sleep(400);
  return created;
}

async function getOrCreateChannel(name, parentId, opts = {}) {
  const typeKey = (opts.type || "text").toUpperCase();
  const discordType = CHANNEL_TYPE[typeKey] ?? CHANNEL_TYPE.TEXT;

  const existing = channelsCache.find(
    (c) => c.name === name && c.parent_id === parentId
  );
  if (existing) {
    console.log(`    = ${name}`);
    return existing;
  }

  const body = {
    name,
    type: discordType,
    parent_id: parentId,
  };
  if (opts.topic) body.topic = opts.topic;
  if (opts.nsfw) body.nsfw = true;
  if (typeKey === "FORUM") {
    body.default_forum_layout = 1; // List view
    body.default_sort_order = 0;   // Latest activity
  }

  const created = await api("POST", `/guilds/${GUILD_ID}/channels`, body);
  console.log(`    + ${name}`);
  channelsCache.push(created);
  await sleep(450);
  return created;
}

async function lockChannel(channelId, everyoneRoleId) {
  await api("PUT", `/channels/${channelId}/permissions/${everyoneRoleId}`, {
    id: everyoneRoleId,
    type: 0,
    deny: String(PERMS.SEND_MESSAGES),
    allow: String(PERMS.VIEW_CHANNEL),
  });
  await sleep(300);
}

async function ensureRole(def) {
  const existing = rolesCache.find((r) => r.name === def.name);
  if (existing) {
    console.log(`  = ${def.name}`);
    return existing;
  }
  const created = await api("POST", `/guilds/${GUILD_ID}/roles`, {
    name: def.name,
    color: def.color,
    hoist: def.hoist === true,
    mentionable: false,
  });
  console.log(`  + ${def.name}`);
  rolesCache.push(created);
  await sleep(450);
  return created;
}

async function channelHasMessages(channelId) {
  try {
    const msgs = await api("GET", `/channels/${channelId}/messages?limit=1`);
    return Array.isArray(msgs) && msgs.length > 0;
  } catch {
    return false;
  }
}

async function postIfEmpty(channelId, content) {
  const has = await channelHasMessages(channelId);
  if (has) return false;
  // Discord message limit is 2000 chars — split if needed
  const chunks = [];
  let remaining = content;
  while (remaining.length > 0) {
    if (remaining.length <= 1900) {
      chunks.push(remaining);
      break;
    }
    const cut = remaining.lastIndexOf("\n\n", 1900);
    const split = cut > 500 ? cut : 1900;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).replace(/^\n+/, "");
  }
  for (const chunk of chunks) {
    await api("POST", `/channels/${channelId}/messages`, { content: chunk });
    await sleep(800);
  }
  return true;
}

async function run() {
  console.log("🎮 iku.gg Discord — BANGER setup\n");
  console.log("▸ Fetching current state");
  await refreshChannels();
  await refreshRoles();

  // 1. Categories
  console.log("\n▸ Categories");
  const categoryByName = {};
  for (const name of CATEGORIES_ORDER) {
    categoryByName[name] = await getOrCreateCategory(name);
  }

  // 2. Channels
  console.log("\n▸ Channels");
  const channelByName = {};
  for (const [catName, list] of Object.entries(CHANNELS)) {
    console.log(`  ${catName}`);
    const parentId = categoryByName[catName].id;
    for (const ch of list) {
      const created = await getOrCreateChannel(ch.name, parentId, {
        topic: ch.topic,
        nsfw: ch.nsfw,
        type: ch.type,
      });
      channelByName[ch.name] = { ...created, locked: ch.locked };
    }
  }

  // 3. Roles
  console.log("\n▸ Roles");
  for (const r of ROLES) {
    await ensureRole(r);
  }

  // 4. Lock read-only channels
  console.log("\n▸ Locking read-only channels for @everyone");
  const everyoneRoleId = GUILD_ID;
  for (const [name, ch] of Object.entries(channelByName)) {
    if (ch.locked) {
      await lockChannel(ch.id, everyoneRoleId);
      console.log(`  🔒 ${name}`);
    }
  }

  // 5. Populate messages
  console.log("\n▸ Populating messages");
  for (const [chName, content] of Object.entries(MESSAGES)) {
    const ch = channelByName[chName];
    if (!ch) {
      console.log(`  ⚠ ${chName} not found, skipping`);
      continue;
    }
    const posted = await postIfEmpty(ch.id, content);
    console.log(`  ${posted ? "✓" : "="} ${chName}`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Done! Next steps:");
  console.log("  1. Create a server invite (Server Settings → Invites → New)");
  console.log("  2. Add Carl-bot or MEE6 for reaction roles in #🎭-roles-and-tags");
  console.log("  3. Set Iku.gg avatar + server banner");
  console.log("  4. Enable Community server (Server Settings → Enable Community)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
