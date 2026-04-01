import Link from "next/link";
import type { Metadata } from "next";
import { SearchBar } from "@/components/SearchBar";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { AgeGate } from "@/components/AgeGate";
import { Suspense } from "react";
import { searchPosts, getPopularTags, getPopularCharacters } from "@/lib/danbooru";

export const metadata: Metadata = {
  title: "Free Hentai Videos — Animated Hentai Clips | iku.gg",
  description: "Browse 65,000+ free hentai videos. Watch the best animated hentai clips sorted by score, character, and tag. Stream hentai anime online.",
  other: { rating: "adult" },
};

export default async function HomePage() {
  const [trending, newest, popularTags, popularCharacters] = await Promise.all([
    searchPosts({ limit: 12, order: "score" }),
    searchPosts({ limit: 12, order: "date" }),
    getPopularTags(16),
    getPopularCharacters(12),
  ]);

  return (
    <AgeGate>
      <div>
        {/* ── Header ───────────────────────────────────────── */}
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="site-header__logo">iku</Link>
            <div className="site-header__search-wrap">
              <Suspense>
                <SearchBar placeholder="Search tags, characters, artists…" />
              </Suspense>
            </div>
            <nav className="site-header__nav" aria-label="Main navigation">
              <Link href="/feed" className="nav-link">Feed</Link>
              <Link href="/" className="nav-link nav-link--active">Browse</Link>
            </nav>
          </div>
        </header>

        {/* ── Page body ─────────────────────────────────────── */}
        <main>
          {/* ── Hero ───────────────────────────── */}
          <div className="home-hero-bg">
            <div className="page-container" style={{ paddingTop: "48px", paddingBottom: "40px", position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-accent)", marginBottom: "8px" }}>
                Free Hentai Videos
              </p>
              <h1 style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--color-text-primary)", marginBottom: "8px", lineHeight: 1.1 }}>
                Browse Hentai
              </h1>
              <p style={{ fontSize: "var(--text-base)", color: "var(--color-text-tertiary)", maxWidth: "480px", lineHeight: 1.65 }}>
                Stream 65,000+ free hentai videos. The best animated hentai clips sorted by score, character, and tag.
              </p>
            </div>
          </div>

          <div className="page-container">
            {/* ── Trending ──────────────────────────────────── */}
            <section className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  Trending Hentai
                </h2>
              </div>
              <div className="trending-strip">
                {trending.data.map((video, i) => (
                  <div key={video.id} style={{ width: "220px", flexShrink: 0 }}>
                    <ThumbnailCard video={video} rank={i + 1} priority={i < 4} lazy={i >= 4} />
                  </div>
                ))}
              </div>
            </section>

            <div className="divider" />

            {/* ── New uploads ───────────────────────────────── */}
            <section className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  New Hentai Videos
                </h2>
              </div>
              <div className="video-grid">
                {newest.data.map((video) => (
                  <ThumbnailCard key={video.id} video={video} />
                ))}
              </div>
            </section>

            <div className="divider" />

            {/* ── Popular tags ──────────────────────────────── */}
            <section className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  Popular Hentai Tags
                </h2>
              </div>
              <div className="tag-grid-featured">
                {popularTags.map((tag) => (
                  <Link key={tag.name} href={`/tag/${tag.name}`} className="tag-card">
                    <span className="tag-card__name">{tag.name.replace(/_/g, " ")}</span>
                    <span className="tag-card__count">{tag.count.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            </section>

            <div className="divider" />

            {/* ── Popular characters ────────────────────────── */}
            <section className="page-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-title__bar" aria-hidden />
                  Popular Hentai Characters
                </h2>
              </div>
              <div className="tag-grid-featured">
                {popularCharacters.map((char) => (
                  <Link key={char.name} href={`/tag/${char.name}`} className="tag-card">
                    <span className="tag-card__name">{char.name.replace(/_/g, " ")}</span>
                    <span className="tag-card__count">{char.count.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* ── Footer ────────────────────────────────────── */}
          <footer className="site-footer">
            <div className="page-container">
              <div className="site-footer__links">
                <a href="/terms" className="site-footer__link">Terms</a>
                <a href="/privacy" className="site-footer__link">Privacy</a>
                <a href="/dmca" className="site-footer__link">DMCA</a>
              </div>
              <p className="site-footer__copy">
                &copy; {new Date().getFullYear()} iku.gg &mdash; For adults 18+ only.
              </p>
            </div>
          </footer>
        </main>

        {/* ── Mobile bottom nav ─────────────────────────────── */}
        <nav className="bottom-nav" aria-label="Mobile navigation">
          <Link href="/feed" className="bottom-nav__item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Feed
          </Link>
          <Link href="/" className="bottom-nav__item bottom-nav__item--active">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Browse
          </Link>
          <Link href="/tags" className="bottom-nav__item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            Tags
          </Link>
        </nav>
      </div>
    </AgeGate>
  );
}
