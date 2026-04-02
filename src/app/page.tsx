import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate } from "@/components/AgeGate";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { searchPosts, getPopularTags, getPopularCharacters } from "@/lib/danbooru";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description:
    "Stream 65,000+ free hentai videos on iku.gg. Watch trending animated hentai clips. Browse by character, tag, and score.",
  other: { rating: "adult" },
};

export default async function HomePage() {
  const [featured, latest, topRated, popularTags, popularCharacters] =
    await Promise.all([
      searchPosts({ limit: 10, order: "score" }),
      searchPosts({ limit: 10, order: "date" }),
      searchPosts({ limit: 10, order: "favcount" }),
      getPopularTags(24),
      getPopularCharacters(16),
    ]);

  return (
    <AgeGate>
      <main className="shell-content home-page">
        {/* ── FEATURED ──────────────────────────────────────── */}
        <section className="home-section">
          <div className="home-section__header">
            <h2 className="home-section__heading">
              <span className="home-section__bar" aria-hidden="true" />
              Featured Hentai
            </h2>
            <Link href="/trending" className="home-section__link">
              See All
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
          <div className="video-grid">
            {featured.data.map((video, i) => (
              <ThumbnailCard
                key={video.id}
                video={video}
                priority={i < 5}
                lazy={i >= 5}
              />
            ))}
          </div>
        </section>

        <div className="home-divider" role="separator" />

        {/* ── LATEST UPLOADS ────────────────────────────────── */}
        <section className="home-section">
          <div className="home-section__header">
            <h2 className="home-section__heading">
              <span className="home-section__bar" aria-hidden="true" />
              Latest Uploads
            </h2>
            <Link href="/new" className="home-section__link">
              See All
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
          <div className="video-grid">
            {latest.data.map((video) => (
              <ThumbnailCard key={video.id} video={video} />
            ))}
          </div>
        </section>

        <div className="home-divider" role="separator" />

        {/* ── TOP RATED ─────────────────────────────────────── */}
        <section className="home-section">
          <div className="home-section__header">
            <h2 className="home-section__heading">
              <span className="home-section__bar" aria-hidden="true" />
              Top Rated
            </h2>
            <Link href="/explore" className="home-section__link">
              See All
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
          <div className="video-grid">
            {topRated.data.map((video, i) => (
              <ThumbnailCard
                key={video.id}
                video={video}
                rank={i + 1}
              />
            ))}
          </div>
        </section>

        <div className="home-divider" role="separator" />

        {/* ── POPULAR TAGS ──────────────────────────────────── */}
        <section className="home-section home-section--compact">
          <div className="home-section__header">
            <h2 className="home-section__heading">
              <span className="home-section__bar" aria-hidden="true" />
              Popular Tags
            </h2>
            <Link href="/tags" className="home-section__link">
              All Tags
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
          <div className="home-pills">
            {popularTags.map((tag) => (
              <Link
                key={tag.name}
                href={`/tag/${encodeURIComponent(tag.name)}`}
                className="home-pill"
              >
                #{tag.name.replace(/_/g, " ")}
                <span className="home-pill__count">
                  {tag.count >= 1000
                    ? `${(tag.count / 1000).toFixed(1)}k`
                    : tag.count}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="home-divider" role="separator" />

        {/* ── POPULAR CHARACTERS ────────────────────────────── */}
        <section className="home-section home-section--compact">
          <div className="home-section__header">
            <h2 className="home-section__heading">
              <span className="home-section__bar" aria-hidden="true" />
              Popular Characters
            </h2>
          </div>
          <div className="home-pills">
            {popularCharacters.map((char) => (
              <Link
                key={char.name}
                href={`/tag/${encodeURIComponent(char.name)}`}
                className="home-pill home-pill--character"
              >
                {char.name.replace(/_/g, " ")}
                <span className="home-pill__count">
                  {char.count >= 1000
                    ? `${(char.count / 1000).toFixed(1)}k`
                    : char.count}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────── */}
        <footer className="home-footer">
          <div className="home-footer__links">
            <a href="/terms"   className="home-footer__link">Terms</a>
            <a href="/privacy" className="home-footer__link">Privacy</a>
            <a href="/dmca"    className="home-footer__link">DMCA</a>
          </div>
          <p className="home-footer__copy">&copy; {new Date().getFullYear()} iku.gg — All rights reserved. 18+ only.</p>
        </footer>
      </main>
    </AgeGate>
  );
}
