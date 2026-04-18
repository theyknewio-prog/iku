/**
 * Rewrite public-facing Discord messages to remove source names + backend details.
 * Deletes all bot messages in each target channel and posts the clean version.
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

// ────────────────────────────────────────────────────────────────
// New message content — NO source names, NO backend references.
// Frames iku.gg as a curated library, describes user-facing features only.
// ────────────────────────────────────────────────────────────────

const MESSAGES = {
  "👋-welcome": `# Welcome to iku.gg 🌸

**You just walked into the biggest animated hentai community on Discord.**

## 🎬 What is iku.gg?
A curated library of **353,000+ animated hentai clips** — 100% free, no signup, no BS. Browse by character, tag, series, or artist. New clips added daily.

## ✨ Why this Discord?
iku.gg isn't just a site — it's a community that **treats animated hentai like art**.
> 🔥 **Daily Drop** — one hand-picked banger posted every day
> 🆕 **New releases** — fresh clips posted to the server regularly
> 💬 **Genre forums** — dedicated threads for every taste and kink
> 🎯 **Personal recs** — describe what you're into, we match you with clips
> 🎨 **Creators corner** — animators and artists share their WIPs
> 🎙️ **Watch parties** — voice channels to co-view clips with friends
> 💎 **Early access** — Pro members get new features first

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

  "📣-announcements": `# 🚀 iku.gg is LIVE

**353,000+ animated hentai clips. Free. No account. No BS.**

iku.gg is officially open to the public — the biggest curated library of animated hentai on the web.

## 📦 What's inside
- **353K+ clips** organized by character, tag, series, and artist
- **Custom video player** — double-tap seek, picture-in-picture, theater mode, heart burst, progress scrub
- **Swipe feed** — TikTok-style shorts at https://iku.gg/feed
- **Smart search** — find clips by character, tag, or series
- **20 curated genre collections** — Vanilla, 3D, Futa, Monster, Fantasy, Uncensored, and more
- **User accounts** — sync favorites and history across devices
- **Sign in with Discord** — link your Discord account

## 🔮 Coming soon
- 🤖 **Auto-post bot** — new releases pushed to **#🆕-new-releases**
- 💎 **Pro membership** — no ads, early access, exclusive 4K clips, custom badge
- ⭐ **Rating system** — stars and reviews
- 🎨 **Creator program** — verified animator accounts with custom pages
- 🎙️ **Watch-together** — synchronized playback in voice channels

Welcome home. 💖`,

  "📰-changelog": `# Changelog — latest updates

## 2026-04-05
- 🔐 **User accounts shipped** — email + password signup, sign in with Discord
- 💎 Profile page with avatar picker, password change, sync across devices
- ❤️ Favorites + history sync automatically once you're signed in
- 🎨 Homepage redesign — better card layouts, genre tag pills, rank badges, duration indicators
- 🏷️ Browse by Genre section with 20 curated genres
- 📝 Better titles everywhere

## 2026-04-04
- ⚡ Faster page loads across the site
- 🎬 Playback improvements on the video player
- 🔍 Search autocomplete fixes

## 2026-04-03
- 🛡️ Site reliability and speed improvements
- 🚀 CDN + DDoS protection enabled
- 🧹 Content moderation improvements`,

  "❓-faq": `# ❓ Frequently Asked Questions

## 🎬 About the site

**Q: Is iku.gg really free?**
Yes. 100% free, forever. Core library stays free. A Pro tier (no ads + early access + 4K clips) is launching soon — everything else stays unlocked for everyone.

**Q: Do I need an account?**
No. All 353K+ clips are accessible without signup. Accounts just let you sync favorites and history across devices, and give you a profile in the community.

**Q: How is content moderated?**
**Zero tolerance** for anything involving minors. We run content filters at multiple layers. Report anything suspicious in **#🐛-bug-reports** — it's gone within hours.

**Q: Why do some clips take a second to start?**
First playback of a clip may take 1–2 seconds. After that, it's instant.

**Q: Can I download clips?**
Not via a download button for now. We focus on streaming quality.

## 🔐 Account & privacy

**Q: Is my data safe?**
We store: email, username (your choice), hashed password, and date of birth (for 18+ verification). That's it. No third-party tracking. Payments (when Pro launches) go through Stripe.

**Q: Can I delete my account?**
Yes — DM a mod for now, a self-serve delete button is coming.

**Q: Why do you need my date of birth?**
Legal requirement for 18+ verification (US 2257, EU AVMSD). Never shown publicly, never shared.

## 🎭 Community

**Q: Can I submit my own art or animations?**
The **Creator Program** is coming. If you're an animator/artist, DM a mod with your portfolio to get the **🎨 Verified Creator** role early.

**Q: How do I become OG?**
You already are, if you joined before the public launch. The role is auto-assigned to early members.

**Q: Can I advertise my Patreon / Fanbox?**
Only in **#💼-commissions** and **#🖌️-artist-showcase**. No self-promo in general chat.

**Q: I want to help moderate.**
DM the founder. We onboard trusted members over time.`,
};

async function run() {
  console.log("🧹 Rewriting public-facing Discord messages\n");
  const channels = await api("GET", `/guilds/${GUILD_ID}/channels`);
  const me = await api("GET", "/users/@me");
  const byName = Object.fromEntries(channels.map((c) => [c.name, c]));

  for (const [chName, content] of Object.entries(MESSAGES)) {
    const ch = byName[chName];
    if (!ch) {
      console.log(`⚠ ${chName} not found`);
      continue;
    }

    // Delete all bot messages in the channel
    const msgs = await api("GET", `/channels/${ch.id}/messages?limit=50`);
    const mine = msgs.filter((m) => m.author?.id === me.id);
    for (const m of mine) {
      await api("DELETE", `/channels/${ch.id}/messages/${m.id}`);
      await sleep(400);
    }
    console.log(`  ${chName}: deleted ${mine.length} old messages`);

    // Post new content (may need split if > 2000 chars)
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
      await api("POST", `/channels/${ch.id}/messages`, { content: chunk });
      await sleep(600);
    }
    console.log(`  ${chName}: posted ${chunks.length} new chunk(s)`);
  }

  console.log("\n✅ Done");
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
