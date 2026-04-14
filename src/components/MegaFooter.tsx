/**
 * MegaFooter — SEO-heavy footer with 300+ internal links.
 *
 * Inspired by PornHub/xVideos footer patterns (per 2026-04-12 competitor
 * audit): the mega-footer is the #1 SEO lever for a tube site. It:
 *   1. Distributes PageRank from the homepage to deep category pages
 *   2. Signals topical relevance to Google (tag clusters, character clusters)
 *   3. Helps crawlers discover long-tail pages that aren't in the sitemap
 *
 * Sections:
 *   - Top Games (franchises — games dominate our 3D catalogue)
 *   - Top Characters (48 most-filmed characters)
 *   - Top Tags (48 most-used content tags)
 *   - Categories (vertical hubs: Hentai, 3D, Shorts, etc.)
 *   - Legal / About
 *
 * All counts are pulled live from PG but memoized 1h so the footer adds
 * near-zero cost to every page render.
 *
 * Used as a Server Component on every non-feed route via AppShell.
 */

import Link from "next/link";
import pool from "@/lib/db";
import { memoize } from "@/lib/memo";
import { BANNED_TAGS_ARRAY } from "@/lib/content";

interface TopEntry {
  name: string;
  count: number;
}

async function _getTopGames(): Promise<TopEntry[]> {
  try {
    const { rows } = await pool.query(
      `SELECT copy AS name, COUNT(*)::int AS count
       FROM (
         SELECT unnest(copyrights) AS copy
         FROM videos
         WHERE NOT (tags && $1::text[])
           AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
           AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
           AND array_length(copyrights, 1) > 0
       ) t
       WHERE copy <> '' AND copy NOT IN ('original')
       GROUP BY copy
       ORDER BY count DESC
       LIMIT 48`,
      [BANNED_TAGS_ARRAY]
    );
    return rows as TopEntry[];
  } catch (err) {
    console.error("getTopGames error:", err);
    return [];
  }
}
const getTopGames = memoize("footer-top-games", _getTopGames, 60 * 60 * 1000);

async function _getTopCharacters(): Promise<TopEntry[]> {
  try {
    const { rows } = await pool.query(
      `SELECT ch AS name, COUNT(*)::int AS count
       FROM (
         SELECT unnest(characters) AS ch
         FROM videos
         WHERE NOT (tags && $1::text[])
           AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
           AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
           AND array_length(characters, 1) > 0
       ) t
       WHERE ch <> ''
       GROUP BY ch
       ORDER BY count DESC
       LIMIT 48`,
      [BANNED_TAGS_ARRAY]
    );
    return rows as TopEntry[];
  } catch (err) {
    console.error("getTopCharacters error:", err);
    return [];
  }
}
const getTopCharacters = memoize("footer-top-chars", _getTopCharacters, 60 * 60 * 1000);

// Curated tag list — we skip boring/utility tags that aren't useful SEO anchors
const FOOTER_TAG_BLACKLIST = new Set([
  "animated", "sound", "1girl", "1boy", "solo", "hetero", "video",
  "tagme", "highres", "absurdres", "long_hair", "short_hair",
  "breasts", "small_breasts", "commentary", "english_commentary",
  "japanese_text", "artist_name", "signature", "with", "the", "and",
  "1girls", "2girls", "multiple_girls", "looking_at_viewer", "nipples",
  "pussy", "penis", "completely_nude", "nude", "naked",
]);

async function _getTopTags(): Promise<TopEntry[]> {
  try {
    const { rows } = await pool.query(
      `SELECT tag AS name, COUNT(*)::int AS count
       FROM (
         SELECT unnest(tags) AS tag
         FROM videos
         WHERE NOT (tags && $1::text[])
           AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
           AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
       ) t
       WHERE tag <> ''
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 120`,
      [BANNED_TAGS_ARRAY]
    );
    return (rows as TopEntry[])
      .filter((r) => !FOOTER_TAG_BLACKLIST.has(r.name.toLowerCase()))
      .slice(0, 48);
  } catch (err) {
    console.error("getTopTags error:", err);
    return [];
  }
}
const getTopTags = memoize("footer-top-tags", _getTopTags, 60 * 60 * 1000);

function formatName(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\(([^)]+)\)/g, "")
    .replace(/:/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export async function MegaFooter() {
  const [games, characters, tags] = await Promise.all([
    getTopGames(),
    getTopCharacters(),
    getTopTags(),
  ]);

  return (
    <footer className="mega-footer" role="contentinfo">
      <div className="mega-footer__inner">

        {/* ── Categories / Hubs ─────────────────────────────── */}
        <section className="mega-footer__section">
          <h3 className="mega-footer__title">Categories</h3>
          <ul className="mega-footer__links">
            <li><Link href="/hentai">Hentai (2D)</Link></li>
            <li><Link href="/3d">3D Hentai</Link></li>
            <li><Link href="/feed">Shorts Feed</Link></li>
            <li><Link href="/trending">Trending</Link></li>
            <li><Link href="/new">New Releases</Link></li>
            <li><Link href="/explore">Explore All</Link></li>
            <li><Link href="/tags">All Tags</Link></li>
            <li><Link href="/character">Characters</Link></li>
            <li><Link href="/series">Series &amp; Games</Link></li>
            <li><Link href="/blog">Blog Articles</Link></li>
            <li><Link href="/glossary">Glossary</Link></li>
          </ul>
        </section>

        {/* ── Top Games / Franchises ────────────────────────── */}
        <section className="mega-footer__section mega-footer__section--wide">
          <h3 className="mega-footer__title">Popular Games &amp; Series</h3>
          <ul className="mega-footer__links mega-footer__links--grid">
            {games.map((g) => (
              <li key={g.name}>
                <Link href={`/series/${encodeURIComponent(g.name)}`}>
                  {formatName(g.name)}
                  <span className="mega-footer__count">({formatCount(g.count)})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Top Characters ────────────────────────────────── */}
        <section className="mega-footer__section mega-footer__section--wide">
          <h3 className="mega-footer__title">Popular Characters</h3>
          <ul className="mega-footer__links mega-footer__links--grid">
            {characters.map((c) => (
              <li key={c.name}>
                <Link href={`/character/${encodeURIComponent(c.name)}`}>
                  {formatName(c.name)}
                  <span className="mega-footer__count">({formatCount(c.count)})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Top Tags ──────────────────────────────────────── */}
        <section className="mega-footer__section mega-footer__section--wide">
          <h3 className="mega-footer__title">Popular Tags</h3>
          <ul className="mega-footer__links mega-footer__links--grid">
            {tags.map((t) => (
              <li key={t.name}>
                <Link href={`/tag/${encodeURIComponent(t.name)}`}>
                  {formatName(t.name)}
                  <span className="mega-footer__count">({formatCount(t.count)})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Community / Account ───────────────────────────── */}
        <section className="mega-footer__section">
          <h3 className="mega-footer__title">Community</h3>
          <ul className="mega-footer__links">
            <li><a href="https://discord.gg/cQZc8trq8N" target="_blank" rel="noopener noreferrer">Discord</a></li>
            <li><a href="https://t.me/ikudotgg" target="_blank" rel="noopener noreferrer">Telegram</a></li>
            <li><a href="https://twitter.com/ikudotgg" target="_blank" rel="noopener noreferrer">Twitter / X</a></li>
            <li><a href="https://reddit.com/u/ikudotgg" target="_blank" rel="noopener noreferrer">Reddit</a></li>
          </ul>
        </section>

        {/* ── Account ───────────────────────────────────────── */}
        <section className="mega-footer__section">
          <h3 className="mega-footer__title">Account</h3>
          <ul className="mega-footer__links">
            <li><Link href="/login">Sign In</Link></li>
            <li><Link href="/signup">Sign Up</Link></li>
            <li><Link href="/pricing">Go Premium</Link></li>
            <li><Link href="/favorites">My Favorites</Link></li>
            <li><Link href="/history">Watch History</Link></li>
            <li><Link href="/settings">Settings</Link></li>
          </ul>
        </section>

        {/* ── Legal ─────────────────────────────────────────── */}
        <section className="mega-footer__section">
          <h3 className="mega-footer__title">Legal</h3>
          <ul className="mega-footer__links">
            <li><Link href="/dmca">DMCA / Copyright</Link></li>
            <li><Link href="/terms">Terms of Service</Link></li>
            <li><Link href="/privacy">Privacy Policy</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </section>

        {/* ── Friends / Partner Sites ──────────────────────── */}
        <section className="mega-footer__section">
          <h3 className="mega-footer__title">Friends</h3>
          <ul className="mega-footer__links">
            <li><a href="https://mypornadviser.com" target="_blank" rel="noopener">My Porn Adviser</a></li>
          </ul>
        </section>
      </div>

      <div className="mega-footer__bottom">
        <p>
          © 2026 iku.gg — All models depicted are 18+ years old. Strict zero-tolerance
          policy on any content involving minors.
        </p>
        <p className="mega-footer__tagline">
          The largest free animated hentai &amp; 3D cartoon porn tube online.
        </p>
      </div>
    </footer>
  );
}
