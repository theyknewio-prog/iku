import Link from "next/link";
import type { Metadata } from "next";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { AgeGate } from "@/components/AgeGate";
import { searchPosts, getPopularTags, getPopularCharacters } from "@/lib/danbooru";

export const metadata: Metadata = {
  title: "Free Hentai Videos — Animated Hentai Clips | iku.gg",
  description: "Browse 65,000+ free hentai videos. Watch the best animated hentai clips sorted by score, character, and tag. Stream hentai anime online.",
  other: { rating: "adult" },
};

export default async function HomePage() {
  const [trending, newest, popularTags, popularCharacters] = await Promise.all([
    searchPosts({ limit: 20, order: "score" }),
    searchPosts({ limit: 20, order: "date" }),
    getPopularTags(16),
    getPopularCharacters(12),
  ]);

  return (
    <AgeGate>
      <main className="shell-content">
        {/* ── Content tabs ─────────────────────────────────── */}
        <div className="content-tabs-bar">
          <div className="content-tabs">
            <button className="content-tab content-tab--active">Trending</button>
            <button className="content-tab">Newest</button>
          </div>
        </div>

        <div className="page-container">
          {/* ── Trending grid ────────────────────────────────── */}
          <section className="page-section" id="trending">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Trending Hentai
              </h2>
              <Link href="/trending" className="section-link">
                See all
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="video-grid">
              {trending.data.map((video, i) => (
                <ThumbnailCard key={video.id} video={video} rank={i + 1} priority={i < 4} lazy={i >= 4} />
              ))}
            </div>
          </section>

          <div className="divider" />

          {/* ── Newest grid ──────────────────────────────────── */}
          <section className="page-section" id="newest">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                New Hentai Videos
              </h2>
              <Link href="/new" className="section-link">
                See all
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="video-grid">
              {newest.data.map((video) => (
                <ThumbnailCard key={video.id} video={video} />
              ))}
            </div>
          </section>

          <div className="divider" />

          {/* ── Popular tags ─────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Popular Hentai Tags
              </h2>
              <Link href="/tags" className="section-link">
                All tags
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
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

          {/* ── Popular characters ───────────────────────────── */}
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

        {/* ── Page footer ──────────────────────────────────── */}
        <footer className="site-footer">
          <div className="page-container">
            <div className="site-footer__links">
              <a href="/terms"   className="site-footer__link">Terms</a>
              <a href="/privacy" className="site-footer__link">Privacy</a>
              <a href="/dmca"    className="site-footer__link">DMCA</a>
            </div>
            <p className="site-footer__copy">
              &copy; {new Date().getFullYear()} iku.gg &mdash; For adults 18+ only.
            </p>
          </div>
        </footer>
      </main>
    </AgeGate>
  );
}
