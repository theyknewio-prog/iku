#!/usr/bin/env node
/**
 * SEO Autopilot — Fully automated SEO pipeline for iku.gg
 *
 * Runs 2x/day (8h + 20h Paris time). Does:
 *   1. Pull GSC data (keywords, pages, positions, countries)
 *   2. Google Autocomplete keyword research
 *   3. Detect content gaps & opportunities
 *   4. Generate SEO articles targeting gaps
 *   5. Add to content-queue.json
 *   6. Git commit + push (triggers deploy)
 *
 * Usage:
 *   node scripts/seo-autopilot.mjs              # full run
 *   node scripts/seo-autopilot.mjs --dry-run    # analyze only, don't write
 *   node scripts/seo-autopilot.mjs --research   # keyword research only
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

// ── Logging ─────────────────────────────────────────────────────
const log = (msg) => console.log(`  ${msg}`);
const section = (title) => console.log(`\n── ${title} ${"─".repeat(60 - title.length)}`);

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

// ── 1. Pull GSC Data ────────────────────────────────────────────
async function pullGSC() {
  section("PULLING GSC DATA");
  const auth = getAuth();
  const sc = google.searchconsole({ version: "v1", auth });
  const startDate = daysAgo(7);
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
  writeFileSync(
    resolve(SNAPSHOT_DIR, `gsc-${today}-${hour}h.json`),
    JSON.stringify({ date: today, queries, pages, queryPages }, null, 2)
  );

  return { queries, pages, queryPages };
}

// ── 2. Google Autocomplete Research ─────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    }).on("error", reject);
  });
}

async function googleAutocomplete(query) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
    const data = await fetchJSON(url);
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

async function keywordResearch(gscKeywords) {
  section("KEYWORD RESEARCH");

  // Seed queries based on what's already ranking + expand
  const seeds = [
    "best hentai", "hentai anime", "watch hentai",
    "free hentai", "hentai streaming", "hentai videos",
    "top hentai", "popular hentai", "hentai 2026",
    "hentai recommendations", "hentai genres",
    "best hentai artists", "hentai studios",
    "uncensored hentai", "3d hentai", "vanilla hentai",
    "ntr hentai", "milf hentai", "tentacle hentai",
    "ahegao hentai", "isekai hentai", "yuri hentai",
    "hentai like", "hentai for beginners",
    "best hentai sites", "hentai tier list",
  ];

  // Add top GSC keywords as seeds too
  const gscSeeds = gscKeywords
    .filter((q) => q.imp >= 2)
    .map((q) => q.kw)
    .slice(0, 15);

  const allSeeds = [...new Set([...seeds, ...gscSeeds])];
  const suggestions = new Map();

  log(`Researching ${allSeeds.length} seed keywords...`);

  // Throttle: 200ms between requests
  for (const seed of allSeeds) {
    const results = await googleAutocomplete(seed);
    for (const r of results) {
      if (!suggestions.has(r)) suggestions.set(r, { kw: r, source: "autocomplete", seed });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  log(`Found ${suggestions.size} unique autocomplete suggestions`);

  // Filter: keep only hentai-related, remove duplicates with GSC
  const gscSet = new Set(gscKeywords.map((q) => q.kw.toLowerCase()));
  const newKeywords = [...suggestions.values()]
    .filter((s) => !gscSet.has(s.kw.toLowerCase()))
    .filter((s) => s.kw.includes("hentai") || s.kw.includes("anime") || s.kw.includes("ecchi"));

  log(`${newKeywords.length} NEW keywords not yet in GSC`);

  // Group by topic cluster
  const clusters = {};
  for (const kw of newKeywords) {
    const topic = extractTopic(kw.kw);
    if (!clusters[topic]) clusters[topic] = [];
    clusters[topic].push(kw.kw);
  }

  // Show top clusters
  const sortedClusters = Object.entries(clusters)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);

  for (const [topic, kws] of sortedClusters) {
    log(`  [${topic}] ${kws.length} keywords: ${kws.slice(0, 3).join(", ")}...`);
  }

  return { newKeywords, clusters: sortedClusters };
}

function extractTopic(kw) {
  const lower = kw.toLowerCase();
  if (lower.includes("best") || lower.includes("top")) return "listicle";
  if (lower.includes("what is") || lower.includes("meaning") || lower.includes("guide")) return "guide";
  if (lower.includes("watch") || lower.includes("stream") || lower.includes("free")) return "streaming";
  if (lower.includes("vs") || lower.includes("versus") || lower.includes("difference")) return "comparison";
  if (lower.includes("recommend") || lower.includes("like")) return "recommendation";
  if (lower.includes("site") || lower.includes("app") || lower.includes("platform")) return "platform";
  if (lower.includes("uncensored")) return "uncensored";
  if (lower.includes("genre") || lower.includes("type") || lower.includes("category")) return "genre";
  return "general";
}

// ── 3. Detect Opportunities ─────────────────────────────────────
function detectOpportunities(gsc, research) {
  section("OPPORTUNITIES & CONTENT GAPS");

  const ops = [];

  // A. GSC keywords with high impressions but no dedicated page
  const blogPage = "https://iku.gg/blog/best-hentai-studios";
  for (const q of gsc.queries) {
    if (q.imp < 2) continue;
    const landings = gsc.queryPages.filter((qp) => qp.kw === q.kw);
    const allOnBlog = landings.every((l) => l.page === blogPage);
    if (allOnBlog && q.pos <= 15) {
      ops.push({
        type: "content_gap",
        keyword: q.kw,
        impressions: q.imp,
        position: q.pos,
        reason: `Ranking pos ${q.pos} with ${q.imp} imp but landing on catch-all blog post`,
      });
    }
  }

  // B. High-volume autocomplete keywords we don't rank for at all
  for (const [topic, kws] of research.clusters) {
    if (kws.length >= 3) {
      ops.push({
        type: "cluster_gap",
        topic,
        keywords: kws.slice(0, 8),
        reason: `${kws.length} autocomplete keywords in "${topic}" cluster — no dedicated content`,
      });
    }
  }

  // C. CTR optimization (ranking well but not getting clicks)
  for (const q of gsc.queries) {
    if (q.pos <= 5 && q.ctr === 0 && q.imp >= 3) {
      ops.push({
        type: "ctr_fix",
        keyword: q.kw,
        position: q.pos,
        impressions: q.imp,
        reason: `Position ${q.pos} with ${q.imp} imp but 0% CTR — title/description needs work`,
      });
    }
  }

  log(`Found ${ops.length} opportunities:`);
  for (const op of ops.slice(0, 10)) {
    log(`  [${op.type}] ${op.keyword || op.topic} — ${op.reason}`);
  }

  return ops;
}

// ── 4. Generate Content ─────────────────────────────────────────
function generateArticle(opportunity) {
  const today = new Date().toISOString().split("T")[0];
  const kw = opportunity.keyword || opportunity.keywords?.[0] || "";

  // Determine article type based on keyword
  if (kw.includes("best") || kw.includes("top") || kw.includes("popular")) {
    return generateListicle(kw, today);
  } else if (kw.includes("what is") || kw.includes("guide") || kw.includes("meaning")) {
    return generateGuide(kw, today);
  } else if (kw.includes("vs") || kw.includes("difference")) {
    return generateComparison(kw, today);
  } else {
    return generateListicle(kw, today); // default to listicle
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
}

function titleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractMainTopic(kw) {
  // "best vanilla hentai 2026" -> "vanilla"
  // "popular hentai art styles 2025 2026" -> "art styles"
  return kw
    .replace(/best|top|popular|most|hentai|anime|2025|2026|2024|recommendations?|guide|complete/gi, "")
    .trim()
    .replace(/\s+/g, " ");
}

function generateListicle(kw, date) {
  const topic = extractMainTopic(kw);
  const topicTitle = titleCase(topic) || "Hentai";
  const slug = slugify(`best-${topic}-hentai-${new Date().getFullYear()}-guide`);

  // Check existing slugs to avoid duplicates
  const existingSlugs = getExistingSlugs();
  if (existingSlugs.has(slug)) return null;

  const relatedTags = topic.split(" ").filter(Boolean).slice(0, 3);
  const tagLinks = relatedTags.map((t) => `<a href="/tag/${t}">${t}</a>`).join(", ");
  const charLinks = [
    '<a href="/character/raiden-shogun">Raiden Shogun</a>',
    '<a href="/character/yor-forger">Yor Forger</a>',
    '<a href="/character/tifa-lockhart">Tifa Lockhart</a>',
  ];

  const content = `<h2>What Makes Great ${topicTitle} Hentai?</h2>
<p>The <strong>${topic} hentai</strong> category has exploded in popularity over the past few years. Whether you're a longtime fan or just discovering the genre, finding the best content can be overwhelming with hundreds of thousands of clips available across platforms. This guide curates the absolute best ${topic} hentai available in ${new Date().getFullYear()}, from classic studio OVAs to cutting-edge independent 3D animations.</p>
<p>On <strong>iku.gg</strong>, you can browse ${topic} content directly via the ${tagLinks || `<a href="/tags">${topic} tag</a>`} — every clip is tagged and searchable. Use the <a href="/settings">blacklist feature</a> to filter out anything you don't want to see.</p>

<h2>Top Studio-Produced ${topicTitle} Hentai</h2>
<p>The Japanese hentai OVA industry continues to produce high-quality ${topic} content. Studios like <strong>Pink Pineapple</strong>, <strong>PoRO</strong>, and <strong>Bunnywalker</strong> lead the way with professional voice acting, fluid animation, and compelling storylines. Check our <a href="/blog/best-hentai-studios">complete studio guide</a> for detailed profiles of every major producer.</p>

<h3>Classic Titles Worth Watching</h3>
<p>Several titles have defined the ${topic} subgenre and remain essential viewing. These productions set the standard for animation quality, pacing, and character design that modern creators still reference. Browse our <a href="/trending">trending section</a> to see what the community is watching right now — ${topic} content frequently appears in the top rankings.</p>

<h3>Recent Releases (${new Date().getFullYear()})</h3>
<p>The current season has delivered several outstanding ${topic} releases. Studio production schedules typically yield 8-12 new OVA episodes per quarter, and the ${topic} genre consistently receives strong representation. New episodes often debut with impressive view counts, reflecting sustained community interest.</p>

<h2>Independent ${topicTitle} Creators to Follow</h2>
<p>The independent 3D animation scene has transformed ${topic} hentai. Tools like <strong>Blender</strong>, <strong>Koikatsu</strong>, and <strong>Honey Select</strong> enable solo creators to produce content that rivals professional studios. The result is an explosion of creative diversity within the ${topic} space.</p>
<p>Many independent creators specialize in ${topic} content featuring popular characters from mainstream anime and gaming franchises — ${charLinks.join(", ")}, and many others. The combination of beloved characters with ${topic} scenarios drives enormous engagement. Explore character-specific content on our <a href="/character">character index</a>.</p>

<h2>How to Find the Best ${topicTitle} Content on iku.gg</h2>
<p>With over <strong>353,000 hentai clips</strong> in our library, finding exactly what you want requires knowing the right tools:</p>
<ul>
<li><strong>Tag search</strong>: Use the <a href="/tags">tag browser</a> to find ${topic}-specific tags and combine them for precise results</li>
<li><strong>Sort by score</strong>: Our <a href="/trending">trending page</a> ranks content by community score — the cream rises to the top</li>
<li><strong>Character pages</strong>: Visit <a href="/character">character pages</a> to find ${topic} content featuring your favorite characters</li>
<li><strong>Series filter</strong>: Browse by <a href="/series">anime series</a> to find ${topic} content from specific franchises</li>
<li><strong>Shorts feed</strong>: Try our <a href="/feed">Shorts feed</a> for quick, swipeable ${topic} clips</li>
</ul>

<h2>${topicTitle} Hentai: Genre Variations</h2>
<p>The ${topic} category intersects with numerous other genres, creating rich subgenres worth exploring:</p>
<ul>
<li><strong><a href="/glossary/vanilla">Vanilla</a> + ${topicTitle}</strong> — Romantic, consensual ${topic} content. The most popular combination.</li>
<li><strong><a href="/glossary/ntr">NTR</a> + ${topicTitle}</strong> — ${topicTitle} scenarios with infidelity drama. Polarizing but heavily searched.</li>
<li><strong>3D + ${topicTitle}</strong> — Computer-generated ${topic} animations, often featuring game characters</li>
<li><strong><a href="/glossary/uncensored">Uncensored</a> + ${topicTitle}</strong> — ${topicTitle} content without mosaic censoring</li>
</ul>
<p>Read our <a href="/blog/understanding-hentai-tags">complete tag guide</a> to master the tagging system and discover content efficiently.</p>

<h2>Community Favorites and Recommendations</h2>
<p>The iku.gg community collectively curates the best ${topic} content through the scoring system. Videos with the highest community scores represent the consensus best-of-the-best. Visit <a href="/explore">Explore</a> and sort by top-rated to see the all-time community favorites in every category including ${topic}.</p>
<p>For personalized recommendations, save your favorites and build your watch history — the more you engage, the better the platform understands your preferences across the ${topic} genre and beyond.</p>`;

  return {
    slug,
    title: `Best ${topicTitle} Hentai ${new Date().getFullYear()} — Top Picks, Artists & Recommendations`,
    excerpt: `The definitive guide to ${topic} hentai in ${new Date().getFullYear()}. Studio OVAs, independent creators, top-rated clips, and how to find the best ${topic} content.`,
    content,
    tags: [...relatedTags, "recommendations", "guide", topic].filter(Boolean),
    publishedAt: date,
    readingTime: 8,
    glossaryLinks: ["vanilla", "ntr", "uncensored"],
    seoTitle: `Best ${topicTitle} Hentai ${new Date().getFullYear()} — Top Picks & Recommendations | iku.gg`,
    seoDescription: `Discover the best ${topic} hentai of ${new Date().getFullYear()}. Studio OVAs, indie creators, trending clips, and expert recommendations. 353,000+ free clips on iku.gg.`,
  };
}

function generateGuide(kw, date) {
  const topic = extractMainTopic(kw);
  return generateListicle(kw, date); // Reuse listicle template for now
}

function generateComparison(kw, date) {
  return generateListicle(kw, date); // Reuse listicle template for now
}

function getExistingSlugs() {
  const slugs = new Set();
  // Read existing blog files
  for (const file of ["blog.ts", "blog-new.ts", "blog-seo-push.ts"]) {
    const path = resolve(ROOT, "src/data", file);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8");
      const matches = content.matchAll(/slug:\s*"([^"]+)"/g);
      for (const m of matches) slugs.add(m[1]);
    }
  }
  // Read content queue
  if (existsSync(QUEUE_PATH)) {
    const queue = JSON.parse(readFileSync(QUEUE_PATH, "utf8"));
    for (const item of queue) {
      if (item.data?.slug) slugs.add(item.data.slug);
    }
  }
  return slugs;
}

// ── 5. Write to content queue ───────────────────────────────────
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

  // Skip past dates that already have articles
  const scheduledDates = new Set(queue.filter((q) => q.status === "pending").map((q) => q.publishDate));

  for (const article of articles) {
    if (!article || existingSlugs.has(article.slug)) continue;

    // Find next available date
    while (scheduledDates.has(scheduleDate.toISOString().split("T")[0])) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    const publishDate = scheduleDate.toISOString().split("T")[0];
    scheduledDates.add(publishDate);

    queue.push({
      type: "blog",
      publishDate,
      status: "pending",
      generatedBy: "seo-autopilot",
      keyword: article.seoTitle,
      data: article,
    });

    added++;
    log(`+ "${article.slug}" scheduled for ${publishDate}`);

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

// ── 6. Git commit + push ────────────────────────────────────────
function gitCommitAndPush(articlesAdded) {
  if (DRY_RUN || articlesAdded === 0) return;

  section("GIT COMMIT & PUSH");
  try {
    execSync("git add src/data/content-queue.json data/gsc-snapshots/", { cwd: ROOT, stdio: "pipe" });
    const msg = `chore(seo): autopilot — ${articlesAdded} article(s) + GSC snapshot\n\nGenerated by scripts/seo-autopilot.mjs based on GSC data analysis.\nKeyword gaps detected and content scheduled for publishing.`;
    execSync(`git commit -m "${msg}"`, { cwd: ROOT, stdio: "pipe" });
    log("Committed to git");

    // Try push (may fail if GH Actions flag is still active)
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

// ── Main Pipeline ───────────────────────────────────────────────
async function main() {
  console.log("\n====================================================");
  console.log("  SEO AUTOPILOT — iku.gg");
  console.log(`  ${new Date().toISOString()} ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log("====================================================");

  // 1. Pull GSC
  const gsc = await pullGSC();

  // 2. Keyword research
  const research = await keywordResearch(gsc.queries);

  if (RESEARCH_ONLY) {
    console.log("\n  Research complete (--research mode). Exiting.\n");
    return;
  }

  // 3. Detect opportunities
  const opportunities = detectOpportunities(gsc, research);

  // 4. Generate articles for content gaps
  const contentGaps = opportunities.filter((o) => o.type === "content_gap" || o.type === "cluster_gap");
  const articles = contentGaps
    .slice(0, 3) // Max 3 articles per run (1/day pace)
    .map((op) => {
      try {
        return generateArticle(op);
      } catch (e) {
        log(`Error generating article for "${op.keyword}": ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);

  log(`Generated ${articles.length} articles`);

  // 5. Add to queue
  const added = addToQueue(articles);

  // 6. Commit & push
  gitCommitAndPush(added);

  // Summary
  section("SUMMARY");
  log(`GSC Keywords: ${gsc.queries.length}`);
  log(`New autocomplete keywords: ${research.newKeywords.length}`);
  log(`Opportunities found: ${opportunities.length}`);
  log(`Articles generated: ${articles.length}`);
  log(`Articles added to queue: ${added}`);
  log(`Next run: ${DRY_RUN ? "N/A (dry run)" : "automatic (cron)"}\n`);
}

main().catch((err) => {
  console.error("AUTOPILOT FATAL:", err);
  process.exit(1);
});
