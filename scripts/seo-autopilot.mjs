#!/usr/bin/env node
/**
 * SEO Autopilot v2 — Semrush-driven content generation for iku.gg
 *
 * Runs 2x/day (8h + 20h Paris time). Does:
 *   1. Pull GSC data (3-day window, excluding today)
 *   2. Pick next 2 unhit keywords from Semrush priority list (sorted by KD asc)
 *   3. Generate SEO articles with dense internal links
 *   4. Add to content-queue.json
 *   5. Git commit + push (triggers deploy)
 *   6. Telegram notification with keyword targets + GSC stats
 *
 * Usage:
 *   node scripts/seo-autopilot.mjs              # full run
 *   node scripts/seo-autopilot.mjs --dry-run    # analyze only, don't write
 *   node scripts/seo-autopilot.mjs --research   # show keyword status only
 *
 * Requires: gsc-service-account.json at project root
 */

import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const KEY_PATH = resolve(ROOT, "gsc-service-account.json");
const QUEUE_PATH = resolve(ROOT, "src/data/content-queue.json");
const SNAPSHOT_DIR = resolve(ROOT, "data/gsc-snapshots");
const SITE_URL = "sc-domain:iku.gg";

const DRY_RUN = process.argv.includes("--dry-run");
const RESEARCH_ONLY = process.argv.includes("--research");
const YEAR = new Date().getFullYear();

// ── Logging ─────────────────────────────────────────────────────
const log = (msg) => console.log(`  ${msg}`);
const section = (title) => console.log(`\n── ${title} ${"─".repeat(60 - title.length)}`);

// ── Semrush Priority Keywords ───────────────────────────────────
// Real data from Semrush keyword research. Sorted by KD ascending.
// type = "blog" | "character" — determines article template + internal links.
const PRIORITY_KEYWORDS = [
  // KD < 15
  { kw: "hentai release calendar", volume: 5400, kd: 4, type: "blog" },
  { kw: "hypnosis hentai", volume: 5400, kd: 9, type: "blog" },
  { kw: "body swap hentai", volume: 14800, kd: 11, type: "blog" },
  { kw: "attack on titan hentai", volume: 4400, kd: 13, type: "blog" },
  { kw: "boa hancock hentai", volume: 12100, kd: 14, type: "character" },
  { kw: "evangelion hentai", volume: 4400, kd: 14, type: "blog" },
  { kw: "danmachi hentai", volume: 4400, kd: 14, type: "blog" },
  { kw: "femdom hentai", volume: 8100, kd: 16, type: "blog" },
  { kw: "horse hentai", volume: 14800, kd: 17, type: "blog" },
  { kw: "makima hentai", volume: 4400, kd: 15, type: "character" },
  { kw: "yor forger hentai", volume: 4400, kd: 18, type: "character" },
  { kw: "bondage hentai", volume: 9900, kd: 19, type: "blog" },
  { kw: "ntr hentai", volume: 8100, kd: 19, type: "blog" },

  // KD 20-30
  { kw: "goblin hentai", volume: 8100, kd: 21, type: "blog" },
  { kw: "cowgirl hentai", volume: 8100, kd: 21, type: "blog" },
  { kw: "dragon ball hentai", volume: 9900, kd: 21, type: "blog" },
  { kw: "dbz hentai", volume: 14800, kd: 21, type: "blog" },
  { kw: "high school dxd hentai", volume: 14800, kd: 21, type: "blog" },
  { kw: "2b hentai", volume: 5400, kd: 21, type: "character" },
  { kw: "mikasa hentai", volume: 5400, kd: 21, type: "character" },
  { kw: "elf hentai", volume: 14800, kd: 22, type: "blog" },
  { kw: "ai generated hentai", volume: 5400, kd: 22, type: "blog" },
  { kw: "starfire hentai", volume: 12100, kd: 22, type: "character" },
  { kw: "raven hentai", volume: 12100, kd: 23, type: "character" },
  { kw: "breast expansion hentai", volume: 14800, kd: 24, type: "blog" },
  { kw: "demon hentai", volume: 8100, kd: 25, type: "blog" },
  { kw: "nami hentai", volume: 14800, kd: 25, type: "character" },
  { kw: "tsunade hentai", volume: 14800, kd: 26, type: "character" },
  { kw: "overwatch hentai", volume: 12100, kd: 26, type: "blog" },
  { kw: "my hero academia hentai", volume: 14800, kd: 26, type: "blog" },
  { kw: "tatsumaki hentai", volume: 14800, kd: 27, type: "character" },
  { kw: "hentai anal", volume: 14800, kd: 27, type: "blog" },
  { kw: "hinata hentai", volume: 14800, kd: 29, type: "character" },
  { kw: "milf hentai", volume: 8100, kd: 29, type: "blog" },

  // KD 30-35
  { kw: "tentacle hentai", volume: 18100, kd: 33, type: "blog" },
  { kw: "hentai animation", volume: 14800, kd: 31, type: "blog" },
  { kw: "zelda hentai", volume: 12100, kd: 31, type: "blog" },
  { kw: "big tits hentai", volume: 12100, kd: 31, type: "blog" },
  { kw: "fairy tail hentai", volume: 12100, kd: 33, type: "blog" },
  { kw: "uncensored hentai", volume: 27100, kd: 34, type: "blog" },
  { kw: "bleach hentai", volume: 14800, kd: 34, type: "blog" },
];

// ── Internal link maps ──────────────────────────────────────────
// Character slug → iku.gg character page slug
const CHAR_SLUGS = {
  "boa hancock": "boa-hancock",
  "makima": "makima",
  "yor forger": "yor-forger",
  "2b": "2b",
  "mikasa": "mikasa-ackerman",
  "starfire": "starfire",
  "raven": "raven",
  "nami": "nami",
  "tsunade": "tsunade",
  "tatsumaki": "tatsumaki",
  "hinata": "hinata-hyuga",
  "zero two": "zero-two",
  "rem": "rem",
  "android 18": "android-18",
  "asuka": "asuka-langley",
  "erza": "erza-scarlet",
  "lucy": "lucy-heartfilia",
  "aqua": "aqua",
  "megumin": "megumin",
  "raiden shogun": "raiden-shogun",
  "ganyu": "ganyu",
  "robin": "nico-robin",
  "bulma": "bulma",
  "ochako": "ochako-uraraka",
  "mirko": "mirko",
  "ryuko": "ryuko-matoi",
  "tohru": "tohru",
  "albedo": "albedo",
};

// Series slug → iku.gg series page slug
const SERIES_SLUGS = {
  "attack on titan": "demon-slayer",   // closest, or use tag
  "evangelion": "evangelion",
  "danmachi": "sword-art-online",      // closest isekai
  "dragon ball": "dragon-ball",
  "dbz": "dragon-ball",
  "high school dxd": "fairy-tail",     // ecchi series
  "one piece": "one-piece",
  "naruto": "naruto",
  "bleach": "fairy-tail",
  "overwatch": "overwatch",
  "my hero academia": "my-hero-academia",
  "fairy tail": "fairy-tail",
  "zelda": "final-fantasy",            // gaming
  "nier automata": "nier-automata",
  "final fantasy": "final-fantasy",
  "genshin impact": "genshin-impact",
  "jujutsu kaisen": "jujutsu-kaisen",
  "chainsaw man": "chainsaw-man",
  "spy x family": "spy-x-family",
  "konosuba": "konosuba",
  "re zero": "re-zero",
  "demon slayer": "demon-slayer",
  "fate": "fate",
  "kill la kill": "kill-la-kill",
  "sword art online": "sword-art-online",
};

// Related blog articles for dense internal linking
const BLOG_LINKS = {
  genres: [
    { slug: "best-vanilla-hentai-2026", label: "vanilla hentai" },
    { slug: "best-ntr-netorare-hentai-2026", label: "NTR hentai" },
    { slug: "best-milf-hentai-2026", label: "MILF hentai" },
    { slug: "best-tentacle-hentai-2026", label: "tentacle hentai" },
    { slug: "best-bondage-hentai-2026", label: "bondage hentai" },
    { slug: "best-ahegao-hentai-2026", label: "ahegao hentai" },
    { slug: "best-isekai-hentai-2026", label: "isekai hentai" },
    { slug: "best-schoolgirl-hentai-2026", label: "schoolgirl hentai" },
    { slug: "best-succubus-hentai-2026", label: "succubus hentai" },
    { slug: "best-maid-hentai-2026", label: "maid hentai" },
  ],
  franchises: [
    { slug: "best-naruto-hentai", label: "Naruto hentai" },
    { slug: "best-bleach-hentai", label: "Bleach hentai" },
    { slug: "best-one-piece-hentai", label: "One Piece hentai" },
    { slug: "best-dragon-ball-hentai", label: "Dragon Ball hentai" },
    { slug: "best-my-hero-academia-hentai", label: "My Hero Academia hentai" },
    { slug: "best-league-of-legends-hentai", label: "League of Legends hentai" },
    { slug: "best-final-fantasy-hentai", label: "Final Fantasy hentai" },
    { slug: "best-nier-automata-2b-hentai", label: "Nier Automata 2B hentai" },
    { slug: "best-chainsaw-man-hentai", label: "Chainsaw Man hentai" },
    { slug: "best-jujutsu-kaisen-hentai", label: "Jujutsu Kaisen hentai" },
  ],
  guides: [
    { slug: "what-is-hentai", label: "what hentai actually is" },
    { slug: "understanding-hentai-tags", label: "hentai tag system" },
    { slug: "best-hentai-studios", label: "best hentai studios" },
    { slug: "hentai-vs-ecchi", label: "hentai vs ecchi" },
    { slug: "what-is-uncensored-hentai-explained", label: "uncensored hentai" },
    { slug: "hentai-for-beginners-guide", label: "hentai beginner's guide" },
    { slug: "best-hentai-anime-2025", label: "best hentai anime" },
    { slug: "popular-hentai-characters", label: "popular hentai characters" },
    { slug: "hentai-art-styles-explained", label: "hentai art styles" },
    { slug: "3d-vs-2d-hentai", label: "3D vs 2D hentai" },
  ],
};

// ── GSC Auth ────────────────────────────────────────────────────
function getAuth() {
  if (!existsSync(KEY_PATH)) {
    console.error("gsc-service-account.json not found");
    process.exit(1);
  }
  const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ── 1. Pull GSC Data (3-day window) ────────────────────────────
async function pullGSC() {
  section("PULLING GSC DATA (3-day window)");
  const auth = getAuth();
  const sc = google.searchconsole({ version: "v1", auth });
  const startDate = daysAgo(4);
  const endDate = daysAgo(1);
  log(`Period: ${startDate} -> ${endDate}`);

  const [queriesRes, pagesRes, queryPageRes] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate, endDate, dimensions: ["query"], rowLimit: 1000, dataState: "all" },
    }),
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate, endDate, dimensions: ["page"], rowLimit: 200, dataState: "all" },
    }),
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate, endDate, dimensions: ["query", "page"], rowLimit: 1000, dataState: "all" },
    }),
  ]);

  const queries = (queriesRes.data.rows || []).map((r) => ({
    kw: r.keys[0], clicks: r.clicks, imp: r.impressions,
    ctr: +(r.ctr * 100).toFixed(1), pos: +r.position.toFixed(1),
  }));
  const pages = (pagesRes.data.rows || []).map((r) => ({
    page: r.keys[0], clicks: r.clicks, imp: r.impressions, pos: +r.position.toFixed(1),
  }));
  const queryPages = (queryPageRes.data.rows || []).map((r) => ({
    kw: r.keys[0], page: r.keys[1], clicks: r.clicks, imp: r.impressions, pos: +r.position.toFixed(1),
  }));

  log(`${queries.length} keywords | ${pages.length} pages indexed`);

  // Save snapshot
  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const today = new Date().toISOString().split("T")[0];
  const hour = new Date().getHours().toString().padStart(2, "0");
  const snapshotPath = resolve(SNAPSHOT_DIR, `gsc-${today}-${hour}h.json`);
  writeFileSync(
    snapshotPath,
    JSON.stringify({ date: today, startDate, endDate, queries, pages, queryPages }, null, 2)
  );
  log(`Snapshot saved: gsc-${today}-${hour}h.json`);

  return { queries, pages, queryPages };
}

// ── 2. Load previous snapshot for position comparison ───────────
function loadPreviousSnapshot() {
  if (!existsSync(SNAPSHOT_DIR)) return null;
  try {
    const files = require("fs").readdirSync(SNAPSHOT_DIR)
      .filter((f) => f.startsWith("gsc-") && f.endsWith(".json"))
      .sort()
      .reverse();
    // Skip first (current), take the most recent previous
    if (files.length < 2) return null;
    const prev = JSON.parse(readFileSync(resolve(SNAPSHOT_DIR, files[1]), "utf8"));
    return prev;
  } catch {
    return null;
  }
}

function getPositionChanges(current, previous) {
  if (!previous) return [];
  const prevMap = new Map(previous.queries.map((q) => [q.kw, q.pos]));
  const changes = [];
  for (const q of current) {
    const prevPos = prevMap.get(q.kw);
    if (prevPos !== undefined) {
      const delta = prevPos - q.pos; // positive = improved
      if (Math.abs(delta) >= 0.5) {
        changes.push({ kw: q.kw, from: prevPos, to: q.pos, delta });
      }
    }
  }
  return changes.sort((a, b) => b.delta - a.delta); // biggest improvements first
}

// ── 3. Get existing slugs from all blog sources ─────────────────
function getExistingSlugs() {
  const slugs = new Set();
  for (const file of ["blog.ts", "blog-new.ts", "blog-seo-push.ts"]) {
    const path = resolve(ROOT, "src/data", file);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8");
      const matches = content.matchAll(/slug:\s*"([^"]+)"/g);
      for (const m of matches) slugs.add(m[1]);
    }
  }
  // Content queue
  if (existsSync(QUEUE_PATH)) {
    try {
      const queue = JSON.parse(readFileSync(QUEUE_PATH, "utf8"));
      for (const item of queue) {
        if (item.data?.slug) slugs.add(item.data.slug);
      }
    } catch { /* ignore parse errors */ }
  }
  return slugs;
}

// Check if a keyword is already covered by an existing article
function isKeywordCovered(kw, existingSlugs) {
  const slug = slugify(kw);
  // Direct slug match
  if (existingSlugs.has(slug)) return true;
  // Check common slug variations
  const variations = [
    slug,
    `best-${slug}`,
    `best-${slug}-${YEAR}`,
    `${slug}-guide`,
    `${slug}-${YEAR}`,
    `best-${slug}-${YEAR}-guide`,
  ];
  return variations.some((v) => existingSlugs.has(v));
}

// ── 4. Pick next keywords to target ─────────────────────────────
function pickNextKeywords(existingSlugs, maxCount = 2) {
  section("KEYWORD SELECTION");
  // Already sorted by KD ascending in the array
  const candidates = [];
  const skipped = [];

  for (const entry of PRIORITY_KEYWORDS) {
    if (isKeywordCovered(entry.kw, existingSlugs)) {
      skipped.push(entry.kw);
      continue;
    }
    candidates.push(entry);
    if (candidates.length >= maxCount) break;
  }

  log(`Skipped (already covered): ${skipped.length} keywords`);
  if (skipped.length > 0) {
    log(`  ${skipped.slice(0, 10).join(", ")}${skipped.length > 10 ? "..." : ""}`);
  }
  log(`Selected: ${candidates.length} keywords to write`);
  for (const c of candidates) {
    log(`  -> "${c.kw}" (vol: ${c.volume}, KD: ${c.kd}, type: ${c.type})`);
  }

  return candidates;
}

// ── 5. Article generation ───────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
}

function titleCase(str) {
  const small = new Set(["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "vs"]);
  return str.split(" ").map((w, i) =>
    i === 0 || !small.has(w.toLowerCase())
      ? w.charAt(0).toUpperCase() + w.slice(1)
      : w.toLowerCase()
  ).join(" ");
}

// Pick 5 random blog links from a category, excluding self
function pickBlogLinks(category, selfSlug, count = 5) {
  const pool = BLOG_LINKS[category].filter((l) => l.slug !== selfSlug);
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Pick related characters for a keyword context
function pickRelatedCharacters(kw, count = 4) {
  const lower = kw.toLowerCase();
  // Prefer characters from the same franchise
  const franchiseChars = {
    "naruto": ["tsunade", "hinata", "ino-yamanaka", "sakura-haruno", "temari", "kushina-uzumaki"],
    "one piece": ["nami", "nico-robin", "boa-hancock"],
    "dragon ball": ["android-18", "bulma", "chi-chi"],
    "dbz": ["android-18", "bulma", "chi-chi"],
    "my hero academia": ["ochako-uraraka", "momo-yaoyorozu", "mina-ashido", "mirko", "midnight"],
    "fairy tail": ["erza-scarlet", "lucy-heartfilia", "mirajane-strauss"],
    "evangelion": ["rei-ayanami", "asuka-langley"],
    "genshin": ["raiden-shogun", "ganyu", "hu-tao"],
    "overwatch": ["starfire", "raven"], // no OW chars in data, use popular
    "re zero": ["rem", "emilia-re-zero", "ram"],
    "konosuba": ["aqua", "darkness-konosuba", "megumin"],
    "attack on titan": ["mikasa-ackerman"],
    "nier": ["2b"],
    "chainsaw man": ["makima"],
    "spy x family": ["yor-forger"],
    "kill la kill": ["ryuko-matoi", "satsuki-kiryuin"],
    "sword art online": ["asuna-yuuki", "sinon"],
    "overlord": ["albedo", "shalltear-bloodfallen"],
    "dragon maid": ["tohru", "lucoa"],
  };

  // Find matching franchise chars
  for (const [franchise, chars] of Object.entries(franchiseChars)) {
    if (lower.includes(franchise)) {
      return chars.slice(0, count).map((c) => ({
        slug: c,
        name: titleCase(c.replace(/-/g, " ")),
      }));
    }
  }

  // Default: popular characters
  const defaults = [
    { slug: "tsunade", name: "Tsunade" },
    { slug: "boa-hancock", name: "Boa Hancock" },
    { slug: "zero-two", name: "Zero Two" },
    { slug: "raiden-shogun", name: "Raiden Shogun" },
    { slug: "rem", name: "Rem" },
    { slug: "ryuko-matoi", name: "Ryuko Matoi" },
    { slug: "android-18", name: "Android 18" },
    { slug: "yor-forger", name: "Yor Forger" },
  ];
  return defaults.sort(() => Math.random() - 0.5).slice(0, count);
}

// Find the series slug closest to a keyword
function findSeriesSlug(kw) {
  const lower = kw.toLowerCase();
  for (const [name, slug] of Object.entries(SERIES_SLUGS)) {
    if (lower.includes(name)) return { slug, name: titleCase(name) };
  }
  return null;
}

function generateArticle(entry) {
  if (entry.type === "character") {
    return generateCharacterArticle(entry);
  }
  return generateGenreArticle(entry);
}

function generateGenreArticle(entry) {
  const { kw, volume, kd } = entry;
  const today = new Date().toISOString().split("T")[0];

  // Extract the core topic: "bondage hentai" -> "bondage", "hentai anal" -> "anal"
  const topic = kw.replace(/\bhentai\b/gi, "").trim();
  const topicTitle = titleCase(topic);
  const slug = slugify(`${kw}-guide-${YEAR}`);
  const tagSlug = slugify(topic);

  const chars = pickRelatedCharacters(kw, 4);
  const charLinks = chars.map((c) => `<a href="/character/${c.slug}">${c.name}</a>`).join(", ");
  const charTagLinks = chars.slice(0, 2).map((c) =>
    `<a href="/tag/${c.slug.replace(/-/g, "_")}">${c.name}</a>`
  ).join(" and ");

  const series = findSeriesSlug(kw);
  const seriesLink = series
    ? `<a href="/series/${series.slug}">${series.name}</a>`
    : `<a href="/series">popular anime franchises</a>`;

  // Pick 5+ blog internal links from mixed categories
  const genreLinks = pickBlogLinks("genres", slug, 3);
  const guideLinks = pickBlogLinks("guides", slug, 3);
  const franchiseLinks = pickBlogLinks("franchises", slug, 2);
  const allBlogLinks = [...genreLinks, ...guideLinks, ...franchiseLinks];

  const blogLinksHtml = allBlogLinks
    .slice(0, 6)
    .map((l) => `<a href="/blog/${l.slug}">${l.label}</a>`)
    .join(", ");

  const content = `<h2>What Is ${topicTitle} Hentai?</h2>
<p><strong>${topicTitle} hentai</strong> is one of the most searched categories in the animated adult content world, with over <strong>${volume.toLocaleString()} monthly searches</strong> globally. The genre encompasses a wide range of content featuring ${topic} themes, from classic studio OVAs to modern independent 3D animations. Whether you're a veteran fan or exploring this category for the first time, this guide covers everything you need to know about ${topic} hentai in ${YEAR}.</p>
<p>If you're new to hentai in general, our <a href="/blog/hentai-for-beginners-guide">beginner's guide</a> is a great starting point. For a deep dive into the tagging system, see our <a href="/blog/understanding-hentai-tags">complete tag guide</a>.</p>

<h2>Why ${topicTitle} Hentai Is So Popular</h2>
<p>The appeal of ${topic} hentai lies in its ability to explore fantasies that live-action content simply cannot replicate. Animation removes all physical limitations, allowing creators to push ${topic} scenarios to their most imaginative extremes. The result is a genre that consistently ranks among the top searched hentai categories on every major platform.</p>
<p>On <strong>iku.gg</strong>, ${topic} content is tagged and fully searchable. Browse the <a href="/tag/${tagSlug}">${topic} tag</a> to see all available clips, or combine it with other tags for more specific results. With over <strong>353,000 clips</strong> in our library, the ${topic} selection alone spans thousands of entries from professional studios and independent creators alike.</p>

<h2>Best ${topicTitle} Hentai Studios and Creators</h2>
<p>The Japanese OVA industry has produced some legendary ${topic} hentai titles. Studios like <strong>Pink Pineapple</strong>, <strong>PoRO</strong>, <strong>Bunnywalker</strong>, and <strong>T-Rex</strong> have each released memorable entries in the ${topic} space. For comprehensive profiles of every major studio, read our <a href="/blog/best-hentai-studios">studio ranking guide</a>.</p>
<p>The independent 3D animation scene has also transformed ${topic} hentai. Tools like <strong>Blender</strong>, <strong>Koikatsu</strong>, and <strong>Honey Select</strong> empower solo creators to produce content rivaling studio output. Many specialize in ${topic} scenarios featuring characters from ${seriesLink} and other popular franchises.</p>

<h3>Landmark ${topicTitle} Titles</h3>
<p>Several ${topic} hentai titles have achieved legendary status in the community. These aren't just popular — they've defined what great ${topic} content looks like, from animation quality and pacing to character design and scenario creativity. The best titles in this category tend to combine compelling storytelling with production values that hold up years after release.</p>
<p>Check our <a href="/trending">trending page</a> to see which ${topic} titles the community is watching right now. High-scoring ${topic} clips surface regularly in the top rankings.</p>

<h2>Popular Characters in ${topicTitle} Hentai</h2>
<p>Fan-created ${topic} hentai featuring beloved anime and gaming characters drives enormous engagement. The most popular characters in this category include ${charLinks}. Each of these characters brings unique appeal to ${topic} scenarios, whether through their canonical personality traits or distinctive character designs.</p>
<p>Browse character-specific content on our <a href="/character">character index</a>. For deeper dives into specific characters, visit their dedicated pages — for example, ${charTagLinks} each have hundreds of clips tagged on iku.gg.</p>

<h2>How to Find the Best ${topicTitle} Content on iku.gg</h2>
<p>With over 353,000 hentai clips, finding the perfect ${topic} content requires knowing the right tools:</p>
<ul>
<li><strong>Direct tag search</strong>: Visit <a href="/tag/${tagSlug}">/tag/${tagSlug}</a> for all ${topic}-tagged content, sorted by relevance</li>
<li><strong>Combined tags</strong>: Use the <a href="/tags">tag browser</a> to combine ${topic} with other tags like <a href="/tag/uncensored">uncensored</a>, <a href="/tag/3d">3D</a>, or specific character names</li>
<li><strong>Sort by score</strong>: The <a href="/trending">trending page</a> ranks by community score — the highest-rated ${topic} clips rise to the top</li>
<li><strong>Shorts feed</strong>: Try the <a href="/feed">Shorts feed</a> for quick, swipeable ${topic} clips — perfect for discovery</li>
<li><strong>Character pages</strong>: Browse by <a href="/character">character</a> to find ${topic} content featuring your favorites</li>
<li><strong>Series filter</strong>: Visit <a href="/series">series pages</a> for franchise-specific ${topic} content</li>
</ul>
<p>Pro tip: use the <a href="/settings">blacklist feature</a> to filter out any tags you don't want to see. This works across all pages and feeds.</p>

<h2>${topicTitle} Hentai Subgenres and Variations</h2>
<p>The ${topic} category intersects with numerous other genres, creating rich subgenres worth exploring:</p>
<ul>
<li><strong>${topicTitle} + <a href="/glossary/vanilla">Vanilla</a></strong> — Romantic, consensual ${topic} scenarios. The most approachable combination for newcomers.</li>
<li><strong>${topicTitle} + <a href="/tag/3d">3D Animation</a></strong> — Computer-generated ${topic} content, often featuring characters from games and anime. Read our <a href="/blog/3d-vs-2d-hentai">3D vs 2D comparison</a>.</li>
<li><strong>${topicTitle} + <a href="/glossary/uncensored">Uncensored</a></strong> — ${topicTitle} content without mosaic censoring, available from Western-produced and select Japanese releases. See our <a href="/blog/what-is-uncensored-hentai-explained">uncensored hentai guide</a>.</li>
<li><strong>${topicTitle} + MILF</strong> — A very popular combination. Check our <a href="/blog/best-milf-hentai-2026">MILF hentai guide</a> for curated picks.</li>
</ul>

<h2>${topicTitle} Hentai in ${YEAR}: What's New</h2>
<p>${YEAR} has been a strong year for ${topic} hentai content. Multiple new OVA episodes have dropped with impressive production quality, and independent creators continue to push the boundaries of what's possible with modern animation tools. The volume of new ${topic} content released monthly continues to grow, driven by both professional studios and a thriving indie scene.</p>
<p>Stay up to date by checking our <a href="/new">new releases page</a>, which updates daily with fresh content across all genres including ${topic}. You can also browse the <a href="/explore">Explore page</a> for curated collections and discovery tools.</p>

<h2>Related Guides and Resources</h2>
<p>If you enjoyed this guide, you'll find these related articles valuable:</p>
<ul>
${allBlogLinks.slice(0, 6).map((l) => `<li><a href="/blog/${l.slug}">Best ${l.label}</a> — Our curated guide to the best ${l.label} content</li>`).join("\n")}
<li><a href="/blog/popular-hentai-characters">Most popular hentai characters</a> — The community's all-time favorite characters</li>
<li><a href="/blog/hentai-art-styles-explained">Hentai art styles explained</a> — From classic 2D to modern 3D animation</li>
</ul>

<h2>Watch ${topicTitle} Hentai Free on iku.gg</h2>
<p>Ready to explore? <strong>iku.gg</strong> hosts over <strong>353,000 free animated hentai clips</strong> — the largest curated library on the web. Browse <a href="/tag/${tagSlug}">${topic} hentai</a> right now, completely free, no account required. Use the tag system to find exactly what you want, sort by community score to see the best first, and try the <a href="/feed">Shorts feed</a> for a quick, swipeable experience.</p>`;

  return {
    slug,
    title: `${topicTitle} Hentai — The Complete Guide (${YEAR})`,
    excerpt: `Everything you need to know about ${topic} hentai in ${YEAR}. Best studios, trending clips, popular characters, subgenres, and how to find the best ${topic} content on iku.gg.`,
    content,
    tags: [tagSlug, "guide", "recommendations", topic.split(" ")[0]].filter(Boolean),
    publishedAt: today,
    readingTime: 10,
    glossaryLinks: ["vanilla", "uncensored", tagSlug].filter(Boolean),
    seoTitle: `${topicTitle} Hentai — Best Clips, Characters & Guide (${YEAR}) | iku.gg`,
    seoDescription: `The definitive guide to ${topic} hentai in ${YEAR}. ${volume.toLocaleString()} monthly searches — find the best ${topic} hentai clips, studios, characters, and subgenres. 353,000+ free clips on iku.gg.`,
    targetKeyword: kw,
    semrushVolume: volume,
    semrushKD: kd,
  };
}

function generateCharacterArticle(entry) {
  const { kw, volume, kd } = entry;
  const today = new Date().toISOString().split("T")[0];

  // "boa hancock hentai" -> "boa hancock"
  const charName = kw.replace(/\bhentai\b/gi, "").trim();
  const charTitle = titleCase(charName);
  const slug = slugify(`${kw}-guide-${YEAR}`);
  const charSlug = CHAR_SLUGS[charName.toLowerCase()] || slugify(charName);
  const tagSlug = charSlug.replace(/-/g, "_");

  // Find the character's franchise
  const series = findSeriesSlug(kw) || findSeriesSlug(charName);
  const seriesLink = series
    ? `<a href="/series/${series.slug}">${series.name}</a>`
    : "their franchise";

  // Other characters from the same franchise
  const relatedChars = pickRelatedCharacters(charName, 5)
    .filter((c) => c.slug !== charSlug);
  const relatedCharLinks = relatedChars
    .slice(0, 4)
    .map((c) => `<a href="/character/${c.slug}">${c.name}</a>`)
    .join(", ");

  // Blog links
  const genreLinks = pickBlogLinks("genres", slug, 3);
  const guideLinks = pickBlogLinks("guides", slug, 3);
  const franchiseLinks = pickBlogLinks("franchises", slug, 2);
  const allBlogLinks = [...genreLinks, ...guideLinks, ...franchiseLinks];

  const content = `<h2>${charTitle} Hentai — Why Fans Can't Get Enough</h2>
<p><strong>${charTitle}</strong> is one of the most searched characters in hentai, with over <strong>${volume.toLocaleString()} monthly searches</strong> for "${kw}" alone. From professional studio OVAs to independent 3D animations and fan art, ${charTitle} has inspired an enormous volume of adult content that spans every style, genre, and quality tier imaginable. This guide covers the best ${charTitle} hentai available in ${YEAR}, where to find it, and what makes this character so enduringly popular in the adult animation community.</p>
<p>New to hentai? Start with our <a href="/blog/hentai-for-beginners-guide">beginner's guide</a> before diving in.</p>

<h2>Who Is ${charTitle}?</h2>
<p>${charTitle} originates from ${seriesLink}, one of anime's most popular franchises. The character's distinctive design, personality, and role in the series have made them a favorite subject for fan-created content of all kinds — including hentai. Character appeal in hentai often comes down to a combination of visual design, personality archetypes, and narrative context, and ${charTitle} scores high on all three dimensions.</p>
<p>For more context on character popularity trends, read our <a href="/blog/popular-hentai-characters">most popular hentai characters guide</a> and our <a href="/blog/most-popular-hentai-characters-2026">${YEAR} character rankings</a>.</p>

<h2>Best ${charTitle} Hentai Content</h2>
<p>The ${charTitle} hentai library on iku.gg spans hundreds of clips across multiple sources and quality tiers.</p>

<h3>Studio-Produced Content</h3>
<p>Professional Japanese studios occasionally feature ${charTitle} or characters inspired by ${charTitle} in their OVA releases. These productions offer the highest animation quality — fluid movement, professional voice acting, and polished scenarios. Check our <a href="/blog/best-hentai-studios">complete studio guide</a> for profiles of every major hentai producer.</p>

<h3>Independent 3D Animations</h3>
<p>The indie scene is where ${charTitle} hentai truly thrives. Creators using <strong>Blender</strong>, <strong>Koikatsu</strong>, and <strong>Honey Select</strong> produce stunningly detailed ${charTitle} content — often with character models that rival professional game assets. The 3D animation community has made ${charTitle} one of its most frequently rendered subjects. Read our <a href="/blog/3d-vs-2d-hentai">3D vs 2D comparison</a> to understand the different styles.</p>

<h3>SFM and Source Filmmaker</h3>
<p>Source Filmmaker (SFM) and its successors have produced a significant volume of ${charTitle} content, particularly from the gaming crossover community. These shorter clips focus on high-fidelity character rendering and creative camera work.</p>

<h2>Finding ${charTitle} Hentai on iku.gg</h2>
<p>iku.gg makes finding ${charTitle} content simple:</p>
<ul>
<li><strong>Character page</strong>: Visit <a href="/character/${charSlug}">${charTitle}'s character page</a> for a curated collection sorted by community score</li>
<li><strong>Tag search</strong>: Search <a href="/tag/${tagSlug}">${charTitle}</a> in the tag system for comprehensive results</li>
<li><strong>Sort by top</strong>: Use the <a href="/trending">trending page</a> and filter for ${charTitle} to see the highest-rated clips</li>
<li><strong>Shorts feed</strong>: Try the <a href="/feed">Shorts feed</a> for quick ${charTitle} clips you can swipe through</li>
<li><strong>New releases</strong>: Check <a href="/new">new releases</a> regularly — fresh ${charTitle} content drops frequently</li>
<li><strong>Explore</strong>: Use the <a href="/explore">Explore page</a> for broader discovery across genres</li>
</ul>

<h2>${charTitle} Across Hentai Genres</h2>
<p>${charTitle} appears across virtually every hentai genre, each offering a different take on the character:</p>
<ul>
<li><strong><a href="/glossary/vanilla">Vanilla</a></strong> — Romantic, consensual scenarios. The most popular pairing for ${charTitle} content. See our <a href="/blog/best-vanilla-hentai-2026">vanilla hentai guide</a>.</li>
<li><strong><a href="/tag/3d">3D Animation</a></strong> — High-fidelity character models in rendered scenes. A staple of the ${charTitle} library.</li>
<li><strong><a href="/glossary/uncensored">Uncensored</a></strong> — Western-produced or decensored versions without mosaic. See our <a href="/blog/what-is-uncensored-hentai-explained">uncensored guide</a>.</li>
<li><strong>Cosplay / Parody</strong> — ${charTitle} in alternative outfits, crossover scenarios, or "what if" situations</li>
</ul>

<h2>Related Characters You Might Enjoy</h2>
<p>Fans of ${charTitle} hentai often enjoy content featuring similar characters. If ${charTitle} appeals to you, explore these related characters: ${relatedCharLinks}. Each has an extensive collection on iku.gg with their own <a href="/character">dedicated character pages</a>.</p>
<p>Browse the full <a href="/character">character index</a> to discover more — our library covers hundreds of characters from dozens of franchises.</p>

<h2>${charTitle} Hentai in ${YEAR}: Current Trends</h2>
<p>${YEAR} has seen continued strong output for ${charTitle} hentai content. Independent creators release new clips regularly, and the community's appetite for high-quality ${charTitle} content shows no signs of declining. The character consistently ranks among the top searched names on hentai platforms globally.</p>
<p>New ${charTitle} content appears on iku.gg daily thanks to our comprehensive aggregation pipeline that surfaces the best from across the web. Check the <a href="/new">new releases</a> page to stay current.</p>

<h2>Related Guides</h2>
<ul>
${allBlogLinks.slice(0, 6).map((l) => `<li><a href="/blog/${l.slug}">Best ${l.label}</a></li>`).join("\n")}
<li><a href="/blog/hentai-art-styles-explained">Hentai art styles explained</a></li>
<li><a href="/blog/best-hentai-studios">Best hentai studios</a></li>
</ul>

<h2>Watch ${charTitle} Hentai Free on iku.gg</h2>
<p>Ready to explore? Browse <a href="/character/${charSlug}">${charTitle} hentai</a> right now on iku.gg — completely free, no account required. Over <strong>353,000 animated hentai clips</strong> in our library, with ${charTitle} featured in hundreds. Sort by score to find the best, or dive into the <a href="/feed">Shorts feed</a> for quick discovery.</p>`;

  return {
    slug,
    title: `${charTitle} Hentai — Best Content, Clips & Guide (${YEAR})`,
    excerpt: `The definitive guide to ${charTitle} hentai in ${YEAR}. Best clips, studios, 3D animations, related characters, and where to find top-rated ${charTitle} content free on iku.gg.`,
    content,
    tags: [charSlug, charName.split(" ")[0], "character", "guide"].filter(Boolean),
    publishedAt: today,
    readingTime: 10,
    glossaryLinks: ["vanilla", "uncensored"],
    seoTitle: `${charTitle} Hentai — Best Clips & Guide (${YEAR}) | iku.gg`,
    seoDescription: `Find the best ${charTitle} hentai of ${YEAR}. ${volume.toLocaleString()} monthly searches — studio OVAs, 3D animations, trending clips. 353,000+ free clips on iku.gg.`,
    targetKeyword: kw,
    semrushVolume: volume,
    semrushKD: kd,
  };
}

// ── 6. Write to content queue ───────────────────────────────────
function addToQueue(articles) {
  section("UPDATING CONTENT QUEUE");

  const queue = existsSync(QUEUE_PATH)
    ? JSON.parse(readFileSync(QUEUE_PATH, "utf8"))
    : [];

  const existingSlugs = new Set(queue.map((q) => q.data?.slug));
  let added = 0;

  // Schedule articles 1 per day starting tomorrow
  let scheduleDate = new Date();
  scheduleDate.setDate(scheduleDate.getDate() + 1);

  const scheduledDates = new Set(queue.filter((q) => q.status === "pending").map((q) => q.publishDate));

  for (const article of articles) {
    if (!article || existingSlugs.has(article.slug)) continue;

    while (scheduledDates.has(scheduleDate.toISOString().split("T")[0])) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    const publishDate = scheduleDate.toISOString().split("T")[0];
    scheduledDates.add(publishDate);

    queue.push({
      type: "blog",
      publishDate,
      status: "pending",
      generatedBy: "seo-autopilot-v2",
      keyword: article.targetKeyword,
      semrushVolume: article.semrushVolume,
      semrushKD: article.semrushKD,
      data: article,
    });

    added++;
    log(`+ "${article.slug}" targeting "${article.targetKeyword}" (vol: ${article.semrushVolume}, KD: ${article.semrushKD}) -> ${publishDate}`);

    scheduleDate.setDate(scheduleDate.getDate() + 1);
  }

  if (added > 0 && !DRY_RUN) {
    writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
    log(`Wrote ${added} new articles to content-queue.json`);
  } else if (added === 0) {
    log("No new articles to add (all keywords already covered)");
  } else {
    log(`DRY RUN: would add ${added} articles`);
  }

  return added;
}

// ── 7. Git commit + push ────────────────────────────────────────
function gitCommitAndPush(articlesAdded) {
  if (DRY_RUN || articlesAdded === 0) return;

  section("GIT COMMIT & PUSH");
  try {
    execSync("git add src/data/content-queue.json data/gsc-snapshots/", { cwd: ROOT, stdio: "pipe" });
    const msg = `chore(seo): autopilot v2 — ${articlesAdded} article(s) + GSC snapshot

Generated by scripts/seo-autopilot.mjs targeting Semrush keywords.`;
    execSync(`git commit -m "${msg}"`, { cwd: ROOT, stdio: "pipe" });
    log("Committed to git");

    try {
      execSync("git push origin master", { cwd: ROOT, stdio: "pipe", timeout: 30000 });
      log("Pushed to origin/master");
    } catch {
      log("Push failed (GH flag?) — commit is local, push manually with: git push");
    }
  } catch (e) {
    log(`Git error: ${e.message}`);
  }
}

// ── 8. Telegram notification ───────────────────────────────────
function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = "5617056258";
  if (!token) { log("TELEGRAM_BOT_TOKEN not set — skipping notification"); return Promise.resolve(); }

  const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" });
  return new Promise((resolve) => {
    const req = https.request(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { res.on("data", () => {}); res.on("end", resolve); }
    );
    req.on("error", () => resolve());
    req.write(payload);
    req.end();
  });
}

// ── Main Pipeline ───────────────────────────────────────────────
async function main() {
  console.log("\n====================================================");
  console.log("  SEO AUTOPILOT v2 — iku.gg (Semrush-driven)");
  console.log(`  ${new Date().toISOString()} ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log("====================================================");

  // 1. Pull GSC (3-day window)
  const gsc = await pullGSC();

  // 2. Load previous snapshot for position deltas
  const prevSnapshot = loadPreviousSnapshot();
  const posChanges = getPositionChanges(gsc.queries, prevSnapshot);

  // 3. Get existing slugs
  const existingSlugs = getExistingSlugs();
  log(`\n  Existing blog slugs: ${existingSlugs.size}`);

  // 4. Pick next keywords
  const targets = pickNextKeywords(existingSlugs, 2);

  if (RESEARCH_ONLY) {
    section("KEYWORD STATUS");
    let covered = 0;
    let remaining = 0;
    for (const entry of PRIORITY_KEYWORDS) {
      const isCovered = isKeywordCovered(entry.kw, existingSlugs);
      const marker = isCovered ? "DONE" : `TODO (KD ${entry.kd})`;
      log(`  [${marker}] "${entry.kw}" — vol ${entry.volume}`);
      if (isCovered) covered++;
      else remaining++;
    }
    log(`\n  Covered: ${covered}/${PRIORITY_KEYWORDS.length} | Remaining: ${remaining}`);

    // Show position changes
    if (posChanges.length > 0) {
      section("POSITION CHANGES");
      for (const c of posChanges.slice(0, 15)) {
        const arrow = c.delta > 0 ? "UP" : "DOWN";
        log(`  ${arrow} ${Math.abs(c.delta).toFixed(1)} — "${c.kw}" (${c.from} -> ${c.to})`);
      }
    }

    console.log("\n  Research complete (--research mode). Exiting.\n");
    return;
  }

  // 5. Generate articles
  const articles = targets
    .map((entry) => {
      try {
        return generateArticle(entry);
      } catch (e) {
        log(`Error generating article for "${entry.kw}": ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);

  log(`Generated ${articles.length} articles`);

  // 6. Add to queue
  const added = addToQueue(articles);

  // 7. Commit & push
  gitCommitAndPush(added);

  // 8. Summary
  section("SUMMARY");
  const totalClicks = gsc.queries.reduce((s, q) => s + q.clicks, 0);
  const totalImp = gsc.queries.reduce((s, q) => s + q.imp, 0);
  const pagesIndexed = gsc.pages.length;
  log(`GSC (3-day): ${totalClicks} clicks | ${totalImp} impressions | ${gsc.queries.length} keywords | ${pagesIndexed} pages`);
  log(`Articles generated: ${articles.length}`);
  log(`Articles added to queue: ${added}`);
  log(`Semrush keywords covered: ${PRIORITY_KEYWORDS.filter((e) => isKeywordCovered(e.kw, getExistingSlugs())).length}/${PRIORITY_KEYWORDS.length}`);

  // 9. Telegram recap
  const topKw = gsc.queries
    .slice(0, 5)
    .map((q) => `  ${q.kw} — pos ${q.pos}, ${q.imp} imp, ${q.clicks} clics`)
    .join("\n");

  const articleList = articles.length > 0
    ? articles.map((a) => `  - "${a.targetKeyword}" (vol ${a.semrushVolume}, KD ${a.semrushKD})\n    -> ${a.slug}`).join("\n")
    : "  (aucun — tous les keywords easy deja couverts)";

  const posChangesText = posChanges.length > 0
    ? posChanges.slice(0, 5).map((c) => {
        const arrow = c.delta > 0 ? "+" : "";
        return `  ${arrow}${c.delta.toFixed(1)} "${c.kw}" (${c.from} -> ${c.to})`;
      }).join("\n")
    : "  (pas de donnees precedentes)";

  const coveredCount = PRIORITY_KEYWORDS.filter((e) => isKeywordCovered(e.kw, getExistingSlugs())).length;

  const msg = `<b>SEO Autopilot v2 — iku.gg</b>
${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}

<b>GSC 3 jours:</b>
  ${totalClicks} clics | ${totalImp} impressions
  ${gsc.queries.length} keywords | ${pagesIndexed} pages indexees

<b>Top 5 keywords:</b>
${topKw || "  (aucun)"}

<b>Position changes:</b>
${posChangesText}

<b>Articles generes:</b>
${articleList}

<b>Semrush pipeline:</b> ${coveredCount}/${PRIORITY_KEYWORDS.length} keywords couverts
${added > 0 ? "Git commit OK" : "Rien a publier"}`;

  await sendTelegram(msg);
}

main().catch(async (err) => {
  console.error("AUTOPILOT FATAL:", err);
  await sendTelegram(`<b>SEO Autopilot v2 CRASH</b>\n${err.message}`).catch(() => {});
  process.exit(1);
});
