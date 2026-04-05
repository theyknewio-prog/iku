/**
 * scripts/discord-import-animated-emojis.mjs
 *
 * Imports up to 50 animated anime/hentai GIF emojis from emoji.gg.
 * Same logic as discord-import-emojis.mjs but filters FOR .gif files.
 * Animated emojis use the same POST /guilds/{id}/emojis endpoint — Discord
 * auto-detects they're animated from the GIF content.
 *
 * Free Discord servers allow 50 animated slots in addition to 50 static.
 */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
if (!BOT_TOKEN || !GUILD_ID) { console.error("Missing env"); process.exit(1); }

const API = "https://discord.com/api/v10";
const headers = { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" };

async function api(method, path, body) {
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 429) {
    const r = await res.json();
    await new Promise((x) => setTimeout(x, (r.retry_after + 0.5) * 1000));
    return api(method, path, body);
  }
  if (res.status === 204) return {};
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const e = new Error(`${method} ${path}: ${JSON.stringify(data)}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INCLUDE_KEYWORDS = [
  "anime", "ahegao", "waifu", "kawaii", "senpai", "uwu", "owo",
  "chan", "tsundere", "yandere", "yuri", "baka", "nani",
  "lewd", "horny", "blush", "smug", "pout", "moan", "wink",
  "tongue", "lick", "kiss", "heart", "sparkle", "dance",
  "catgirl", "nekomimi", "maid", "miko", "demon_girl", "angel",
  "goddess", "princess", "hinata", "asuna", "rem", "nezuko",
  "zelda", "marin", "mikasa", "hatsune", "miku", "ochako",
  "zero_two", "neko", "bunny", "catboy", "hype", "sparkles",
  "love", "cute", "peek", "spin",
];

const EXCLUDE_KEYWORDS = [
  "loli", "shota", "child", "kid", "minor", "underage", "infant",
  "toddler", "baby", "young_girl", "cub",
  "nazi", "hitler", "swastika", "slur",
];

function sanitizeName(raw) {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  if (cleaned.length < 2) return "emoji_" + cleaned;
  return cleaned;
}

function matchesAny(text, list) {
  const lower = text.toLowerCase();
  return list.some((k) => lower.includes(k));
}

async function downloadImage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000); // 10s timeout
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 iku-emoji-importer" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

function log(msg) {
  process.stdout.write(msg + "\n");
}

async function run() {
  log("🎬 Fetching emoji.gg catalog…");
  const res = await fetch("https://emoji.gg/api/", { headers: { "User-Agent": "Mozilla/5.0" } });
  const all = await res.json();
  log(`  got ${all.length} emojis total`);

  log("\n🔍 Filtering for animated (.gif) anime/hentai-themed…");
  const candidates = all
    .filter((e) => {
      const haystack = `${e.title || ""} ${e.description || ""} ${e.slug || ""}`;
      if (matchesAny(haystack, EXCLUDE_KEYWORDS)) return false;
      if (!matchesAny(haystack, INCLUDE_KEYWORDS)) return false;
      // ONLY animated GIFs
      if (!e.image?.endsWith(".gif")) return false;
      return true;
    })
    .sort((a, b) => (b.faves || 0) - (a.faves || 0));

  log(`  ${candidates.length} matched`);

  if (candidates.length === 0) {
    log("\n⚠ No animated GIFs matched the filters.");
    return;
  }

  log("\n📦 Loading existing server emojis (to count animated + dedup)…");
  const existing = await api("GET", `/guilds/${GUILD_ID}/emojis`);
  const existingNames = new Set(existing.map((e) => e.name));
  const animatedCount = existing.filter((e) => e.animated).length;
  log(`  ${existing.length} total, ${animatedCount} animated`);

  const slotsLeft = Math.max(0, 50 - animatedCount);
  log(`  ${slotsLeft} animated slots available`);

  if (slotsLeft === 0) {
    log("\n⚠ No free animated slots. Server is already at the cap.");
    return;
  }

  const pool = candidates.slice(0, slotsLeft * 3);

  log(`\n⬇️  Downloading + uploading up to ${slotsLeft} animated emojis…`);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const e of pool) {
    if (uploaded >= slotsLeft) break;

    const name = sanitizeName(e.title || e.slug || `emoji_${e.id}`);
    if (existingNames.has(name)) { skipped++; continue; }

    try {
      const buf = await downloadImage(e.image);
      if (buf.length > 256 * 1024) {
        log(`  ⚠ ${name}: ${(buf.length / 1024).toFixed(0)}KB > 256KB, skipping`);
        failed++;
        continue;
      }
      const dataUri = `data:image/gif;base64,${buf.toString("base64")}`;
      await api("POST", `/guilds/${GUILD_ID}/emojis`, { name, image: dataUri });
      existingNames.add(name);
      uploaded++;
      log(`  ✓ :${name}: (${(buf.length / 1024).toFixed(0)}KB) — faves: ${e.faves || 0}`);
      await sleep(600);
    } catch (err) {
      failed++;
      log(`  ❌ ${name}: ${(err.message || "").slice(0, 100)}`);
      if (err.status === 429) await sleep(5000);
    }
  }

  log(`\n✨ Done: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
}

run().catch((err) => { console.error("❌", err); process.exit(1); });
