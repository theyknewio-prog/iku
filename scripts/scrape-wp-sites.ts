/**
 * scrape-wp-sites.ts
 *
 * Generic WordPress sitemap scraper for multiple hentai sites.
 * All these sites use standard WordPress sitemaps with <loc> + <lastmod>.
 *
 * Sites scraped:
 * - hentaimama.io (~4,700 episodes)
 * - hentai.tv (~1,520 hentai)
 * - animeidhentai.com (~5,000+ episodes + hentai)
 * - watchhentai.net (~3,720 episodes)
 * - hentaiworld.tv (~1,226 posts)
 * - hentaigasm.com (~500 posts)
 *
 * Usage: npx tsx scripts/scrape-wp-sites.ts
 */

import { hasBannedTitle } from "./banned-tags";
import { pool, upsertVideos } from "./db";

const DELAY = 800;
const USER_AGENT = "Mozilla/5.0 (compatible; IkuBot/1.0)";

interface WPEntry {
  id: number;
  slug: string;
  title: string;
  pageUrl: string;
  site: string;
  date: string;
}

interface SiteConfig {
  domain: string;
  prefix: string; // slug prefix
  sitemaps: string[];
}

const SITES: SiteConfig[] = [
  {
    domain: "hentaimama.io",
    prefix: "hmm",
    sitemaps: [
      "https://hentaimama.io/episodes-sitemap1.xml",
      "https://hentaimama.io/episodes-sitemap2.xml",
      "https://hentaimama.io/tvshows-sitemap.xml",
    ],
  },
  {
    domain: "hentai.tv",
    prefix: "htv",
    sitemaps: Array.from(
      { length: 8 },
      (_, i) => `https://hentai.tv/hentai-sitemap${i + 1}.xml`,
    ),
  },
  {
    domain: "animeidhentai.com",
    prefix: "aid",
    sitemaps: [
      ...Array.from(
        { length: 4 },
        (_, i) => `https://animeidhentai.com/hentai-sitemap${i + 1}.xml`,
      ),
      ...Array.from(
        { length: 4 },
        (_, i) => `https://animeidhentai.com/episodes-sitemap${i + 1}.xml`,
      ),
    ],
  },
  {
    domain: "watchhentai.net",
    prefix: "wh",
    sitemaps: [
      "https://watchhentai.net/episodes-sitemap.xml",
      "https://watchhentai.net/episodes-sitemap2.xml",
      "https://watchhentai.net/episodes-sitemap3.xml",
      "https://watchhentai.net/episodes-sitemap4.xml",
    ],
  },
  {
    domain: "hentaiworld.tv",
    prefix: "hw",
    sitemaps: Array.from(
      { length: 7 },
      (_, i) => `https://hentaiworld.tv/post-sitemap${i + 1}.xml`,
    ),
  },
  {
    domain: "hentaigasm.com",
    prefix: "hg",
    sitemaps: [
      "https://hentaigasm.com/wp-sitemap-posts-post-1.xml",
      "https://hentaigasm.com/wp-sitemap-posts-post-2.xml",
    ],
  },
];

let globalId = 1;

function sanitizeSlug(url: string): string {
  // Extract the last path segment as slug
  const parts = url.replace(/\/$/, "").split("/");
  const last = parts[parts.length - 1] || parts[parts.length - 2] || "";
  return last
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractTitle(url: string): string {
  const slug = sanitizeSlug(url);
  return slug.replace(/-/g, " ");
}

function parseSitemap(xml: string, site: SiteConfig): WPEntry[] {
  const entries: WPEntry[] = [];
  const urlBlocks = xml.split("<url>");

  for (let i = 1; i < urlBlocks.length; i++) {
    const block = urlBlocks[i];
    const endIdx = block.indexOf("</url>");
    const content = block.slice(0, endIdx > 0 ? endIdx : undefined);

    const locMatch = content.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const pageUrl = locMatch[1].trim();

    // Skip non-content pages
    if (
      pageUrl.endsWith("/portal/") ||
      pageUrl.endsWith(".io/") ||
      pageUrl.endsWith(".tv/") ||
      pageUrl.endsWith(".com/") ||
      pageUrl.endsWith(".net/") ||
      pageUrl.includes("/page/") ||
      pageUrl.includes("/genre") ||
      pageUrl.includes("/category") ||
      pageUrl.includes("/tag/")
    )
      continue;

    let date = "";
    const dateMatch = content.match(/<lastmod>([^<]+)<\/lastmod>/);
    if (dateMatch) date = dateMatch[1].trim();

    const urlSlug = sanitizeSlug(pageUrl);
    if (!urlSlug || urlSlug.length < 3) continue;

    const slug = `${site.prefix}-${globalId}-${urlSlug}`;
    const title = extractTitle(pageUrl);

    // Skip banned content
    if (hasBannedTitle(title) || hasBannedTitle(urlSlug)) continue;

    entries.push({
      id: globalId++,
      slug,
      title,
      pageUrl,
      site: site.domain,
      date,
    });
  }

  return entries;
}

async function fetchSitemap(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return null;
      }
      return await res.text();
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function scrapeSite(site: SiteConfig): Promise<WPEntry[]> {
  const results: WPEntry[] = [];
  console.log(`\n  ${site.domain} (${site.sitemaps.length} sitemaps)`);

  for (const sitemapUrl of site.sitemaps) {
    const xml = await fetchSitemap(sitemapUrl);
    if (!xml) {
      console.log(`    SKIP: ${sitemapUrl.split("/").pop()}`);
      continue;
    }

    const entries = parseSitemap(xml, site);
    results.push(...entries);
    console.log(
      `    ${sitemapUrl.split("/").pop()}: +${entries.length} (subtotal: ${results.length})`,
    );

    await new Promise((r) => setTimeout(r, DELAY));
  }

  console.log(`    Total: ${results.length}`);
  return results;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  WordPress Hentai Sites Scraper");
  console.log(`  ${SITES.length} sites to scrape`);
  console.log("═══════════════════════════════════════════");

  const allEntries: WPEntry[] = [];

  for (const site of SITES) {
    const entries = await scrapeSite(site);
    allEntries.push(...entries);
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Total videos across all sites: ${allEntries.length}`);

  // Per-site breakdown
  const bySite = new Map<string, number>();
  for (const e of allEntries) {
    bySite.set(e.site, (bySite.get(e.site) || 0) + 1);
  }
  for (const [site, count] of bySite) {
    console.log(`    ${site}: ${count}`);
  }
  console.log("═══════════════════════════════════════════");

  console.log(`\n  Upserting ${allEntries.length} videos to PostgreSQL...`);
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < allEntries.length; i += BATCH) {
    const batch = allEntries.slice(i, i + BATCH).map((v) => ({
      source: "wp",
      source_id: v.id,
      slug: v.slug,
      title: v.title,
      page_url: v.pageUrl,
      site: v.site,
      created_at: v.date,
      tags: v.title
        ? v.title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter((w: string) => w.length > 2)
            .slice(0, 15)
        : [],
    }));
    upserted += await upsertVideos(batch);
    process.stdout.write(
      `  ${Math.min(i + BATCH, allEntries.length)}/${allEntries.length} upserted\r`,
    );
  }
  console.log(`\n  ${upserted} videos upserted`);
  await pool.end();
}

main().catch(console.error);
