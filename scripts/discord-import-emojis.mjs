/**
 * scripts/discord-import-emojis.mjs
 *
 * Imports up to 50 anime/hentai/kawaii emojis from emoji.gg into the iku.gg Discord.
 * - Fetches the full emoji.gg catalog
 * - Filters by anime/kawaii/lewd keywords, skips anything suggesting minors
 * - Sorts by faves desc, takes top 50
 * - Downloads each PNG, validates size < 256 KB
 * - Uploads via POST /guilds/{id}/emojis
 * - Idempotent: skips any emoji with a name already taken on the server
 *
 * Free Discord servers allow 50 static + 50 animated custom emojis.
 * Boost level 1 = 100/100, level 2 = 150/150, level 3 = 250/250.
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
  if (!res.ok) {
    const e = new Error(`${method} ${path}: ${JSON.stringify(data)}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ────────────────────────────────────────────────────────────────
// Keywords
// ────────────────────────────────────────────────────────────────

// Keep if title or description matches ANY of these
const INCLUDE_KEYWORDS = [
  // anime themed
  "anime",
  "ahegao",
  "waifu",
  "kawaii",
  "senpai",
  "uwu",
  "owo",
  "chan",
  "tsundere",
  "yandere",
  "yuri",
  "baka",
  "nani",
  // reactions
  "lewd",
  "horny",
  "blush",
  "smug",
  "pout",
  "moan",
  "wink",
  "tongue",
  "lick",
  "kiss",
  "heart",
  "sparkle",
  // characters / tropes
  "catgirl",
  "nekomimi",
  "maid",
  "miko",
  "loli_queen", // FILTERED BELOW
  "demon_girl",
  "angel",
  "goddess",
  "princess",
  "hinata",
  "asuna",
  "rem",
  "nezuko",
  "zelda",
  "marin",
  "mikasa",
  "hatsune",
  "miku",
  "ochako",
  "zero_two",
];

// NEVER include anything matching these (opsec + legal)
const EXCLUDE_KEYWORDS = [
  "loli",
  "shota",
  "child",
  "kid",
  "minor",
  "underage",
  "infant",
  "toddler",
  "baby",
  "young_girl",
  "cub",
  "nazi",
  "hitler",
  "swastika",
  "slur",
];

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

function sanitizeName(raw) {
  // Discord emoji names: [a-zA-Z0-9_], 2-32 chars
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  if (cleaned.length < 2) return "emoji_" + cleaned;
  return cleaned;
}

function matchesInclude(text) {
  const lower = text.toLowerCase();
  return INCLUDE_KEYWORDS.some((k) => lower.includes(k));
}

function matchesExclude(text) {
  const lower = text.toLowerCase();
  return EXCLUDE_KEYWORDS.some((k) => lower.includes(k));
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 iku-emoji-importer" },
  });
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/png";
  return { buf, contentType };
}

async function run() {
  console.log("🎭 Fetching emoji.gg catalog…");
  const res = await fetch("https://emoji.gg/api/", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const all = await res.json();
  console.log(`  got ${all.length} emojis total`);

  console.log("\n🔍 Filtering for anime/hentai-themed (opsec-safe)…");
  const candidates = all
    .filter((e) => {
      const haystack = `${e.title || ""} ${e.description || ""} ${e.slug || ""}`;
      if (matchesExclude(haystack)) return false;
      if (!matchesInclude(haystack)) return false;
      // Skip animated GIFs — we'll focus on static PNGs for the free slots
      if (e.image?.endsWith(".gif")) return false;
      return true;
    })
    .sort((a, b) => (b.faves || 0) - (a.faves || 0));

  console.log(`  ${candidates.length} matched`);

  console.log("\n📦 Loading existing server emojis (to dedup)…");
  const existing = await api("GET", `/guilds/${GUILD_ID}/emojis`);
  const existingNames = new Set(existing.map((e) => e.name));
  console.log(`  ${existing.length} already on the server`);

  const slotsLeft = Math.max(0, 50 - existing.length);
  console.log(`  ${slotsLeft} free slots available`);

  if (slotsLeft === 0) {
    console.log("\n⚠ No free slots. Server is already at the cap.");
    return;
  }

  // Take more than slots, to have fallbacks if downloads / names clash
  const pool = candidates.slice(0, slotsLeft * 3);

  console.log(`\n⬇️  Downloading + uploading up to ${slotsLeft}…`);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const e of pool) {
    if (uploaded >= slotsLeft) break;

    const name = sanitizeName(e.title || e.slug || `emoji_${e.id}`);
    if (existingNames.has(name)) {
      skipped++;
      continue;
    }

    try {
      const { buf, contentType } = await downloadImage(e.image);
      if (buf.length > 256 * 1024) {
        console.log(
          `  ⚠ ${name}: ${(buf.length / 1024).toFixed(0)}KB > 256KB, skipping`,
        );
        failed++;
        continue;
      }
      const b64 = buf.toString("base64");
      const dataUri = `data:${contentType};base64,${b64}`;

      await api("POST", `/guilds/${GUILD_ID}/emojis`, {
        name,
        image: dataUri,
      });
      existingNames.add(name);
      uploaded++;
      console.log(
        `  ✓ :${name}: (${(buf.length / 1024).toFixed(0)}KB) — faves: ${e.faves || 0}`,
      );
      await sleep(500); // Discord rate limit
    } catch (err) {
      failed++;
      console.log(`  ❌ ${name}: ${err.message?.slice(0, 100)}`);
      if (err.status === 429) {
        await sleep(5000);
      }
    }
  }

  console.log(
    `\n✨ Done: ${uploaded} uploaded, ${skipped} skipped (already exist), ${failed} failed`,
  );
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
