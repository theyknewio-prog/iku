/**
 * scripts/discord-import-stickers.mjs
 *
 * Uploads 5 anime/hentai stickers to the iku.gg Discord server.
 * Stickers use a different API than emojis:
 *   POST /guilds/{guild.id}/stickers
 *   multipart/form-data with fields: name, description, tags, file
 *
 * Free servers allow 5 stickers. Max 512 KB per file. PNG/APNG preferred.
 * GIF stickers require boost level 2. Lottie (JSON) also accepted.
 *
 * We pick 5 high-quality PNG emojis from emoji.gg that work well at
 * sticker-sized resolution (most popular anime-themed PNGs).
 */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
if (!BOT_TOKEN || !GUILD_ID) { console.error("Missing env"); process.exit(1); }

const API = "https://discord.com/api/v10";

async function api(method, path, body, extraHeaders = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bot ${BOT_TOKEN}`, ...extraHeaders },
    body,
  });
  if (res.status === 429) {
    const r = await res.json();
    await new Promise((x) => setTimeout(x, (r.retry_after + 0.5) * 1000));
    return api(method, path, body, extraHeaders);
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

// ────────────────────────────────────────────────────────────────
// Curated sticker picks — 5 distinct flavors
// Each entry: search keywords to match on emoji.gg + metadata
// ────────────────────────────────────────────────────────────────

const STICKER_PICKS = [
  {
    searchTerms: ["ahegao"],
    name: "ahegao",
    description: "When the clip hits just right",
    tags: "😵‍💫,lewd,anime",
  },
  {
    searchTerms: ["heart", "cat"],
    name: "cat_hearts",
    description: "Purrfect reaction",
    tags: "❤️,cat,love",
  },
  {
    searchTerms: ["smug", "02"],
    name: "smug_waifu",
    description: "Told you so",
    tags: "😏,smug,anime",
  },
  {
    searchTerms: ["blush"],
    name: "blush",
    description: "Stop it you're making me blush",
    tags: "😳,blush,shy",
  },
  {
    searchTerms: ["kiss"],
    name: "kiss",
    description: "Mwah",
    tags: "😘,kiss,love",
  },
];

async function downloadImage(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 iku-sticker-importer" } });
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/png";
  return { buf: Buffer.from(await res.arrayBuffer()), contentType };
}

function pickBestMatch(catalog, searchTerms, usedIds) {
  const scored = catalog
    .map((e) => {
      if (usedIds.has(e.id)) return null;
      if (e.image?.endsWith(".gif")) return null; // prefer static for free tier
      const haystack = `${e.title || ""} ${e.slug || ""} ${e.description || ""}`.toLowerCase();
      // Exclude banned
      if (/\bloli\b|\bshota\b|child|minor|underage/.test(haystack)) return null;
      let score = 0;
      for (const term of searchTerms) {
        if (haystack.includes(term.toLowerCase())) score += 100;
      }
      if (score === 0) return null;
      // Prefer popular
      score += (e.faves || 0);
      return { emoji: e, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.emoji || null;
}

async function run() {
  console.log("🏷️  Fetching emoji.gg catalog for sticker picks…");
  const res = await fetch("https://emoji.gg/api/", { headers: { "User-Agent": "Mozilla/5.0" } });
  const all = await res.json();

  console.log("\n📦 Loading existing stickers…");
  const existing = await api("GET", `/guilds/${GUILD_ID}/stickers`);
  const existingNames = new Set(existing.map((s) => s.name));
  console.log(`  ${existing.length} stickers already on the server`);

  const slotsLeft = Math.max(0, 5 - existing.length);
  console.log(`  ${slotsLeft} free sticker slots available`);

  if (slotsLeft === 0) {
    console.log("\n⚠ No free sticker slots.");
    return;
  }

  const usedIds = new Set();
  let uploaded = 0;

  for (const pick of STICKER_PICKS) {
    if (uploaded >= slotsLeft) break;
    if (existingNames.has(pick.name)) {
      console.log(`  = ${pick.name} (already exists)`);
      continue;
    }

    const match = pickBestMatch(all, pick.searchTerms, usedIds);
    if (!match) {
      console.log(`  ⚠ no match for '${pick.name}' (searched: ${pick.searchTerms.join(", ")})`);
      continue;
    }
    usedIds.add(match.id);

    try {
      const { buf, contentType } = await downloadImage(match.image);
      if (buf.length > 512 * 1024) {
        console.log(`  ⚠ ${pick.name}: ${(buf.length / 1024).toFixed(0)}KB > 512KB, skipping`);
        continue;
      }

      // Build multipart/form-data body using native FormData + Blob
      const fd = new FormData();
      fd.append("name", pick.name);
      fd.append("description", pick.description);
      fd.append("tags", pick.tags);
      fd.append("file", new Blob([buf], { type: contentType }), `${pick.name}.png`);

      const uploadRes = await fetch(`${API}/guilds/${GUILD_ID}/stickers`, {
        method: "POST",
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
        body: fd,
      });

      if (uploadRes.status === 429) {
        const r = await uploadRes.json();
        console.log(`  ⏱  rate limited, waiting ${r.retry_after}s`);
        await sleep((r.retry_after + 0.5) * 1000);
        continue;
      }

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        console.log(`  ❌ ${pick.name}: ${err.slice(0, 200)}`);
        continue;
      }

      uploaded++;
      console.log(`  ✓ sticker "${pick.name}" (${(buf.length / 1024).toFixed(0)}KB) — from emoji :${match.slug}:`);
      await sleep(800);
    } catch (err) {
      console.log(`  ❌ ${pick.name}: ${(err.message || "").slice(0, 150)}`);
    }
  }

  console.log(`\n✨ Done: ${uploaded} sticker(s) uploaded`);
}

run().catch((err) => { console.error("❌", err); process.exit(1); });
