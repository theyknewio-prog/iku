import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate } from "@/components/AgeGate";
import { PosterCard } from "@/components/PosterCard";
import { Carousel } from "@/components/Carousel";
import { getPopularTags, getPopularCharacters } from "@/lib/danbooru";
import { getVideos } from "@/lib/content";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description: "Stream 57,000+ free hentai videos on iku.gg. Watch trending animated hentai clips. Browse by character, tag, and score.",
  other: { rating: "adult" },
};

/* ── Tag chip colours — round-robin ────────────────────────── */
const TAG_GRADIENTS = [
  "linear-gradient(160deg, #1a0a2e 0%, #e8467c 100%)",
  "linear-gradient(160deg, #0d1a2e 0%, #7b2ff7 100%)",
  "linear-gradient(160deg, #2e0d0d 0%, #e8467c 60%, #ff9a44 100%)",
  "linear-gradient(160deg, #0a2e1a 0%, #22c55e 100%)",
  "linear-gradient(160deg, #2e1a0a 0%, #f59e0b 100%)",
  "linear-gradient(160deg, #1a0a2e 0%, #06b6d4 100%)",
  "linear-gradient(160deg, #2e0a1a 0%, #f43f5e 100%)",
  "linear-gradient(160deg, #0a1a2e 0%, #3b82f6 100%)",
];

const CHAR_GRADIENTS = [
  "radial-gradient(circle at 40% 30%, #e8467c 0%, #7b2ff7 100%)",
  "radial-gradient(circle at 40% 30%, #7b2ff7 0%, #06b6d4 100%)",
  "radial-gradient(circle at 40% 30%, #f59e0b 0%, #e8467c 100%)",
  "radial-gradient(circle at 40% 30%, #22c55e 0%, #06b6d4 100%)",
  "radial-gradient(circle at 40% 30%, #e8467c 0%, #fb923c 100%)",
  "radial-gradient(circle at 40% 30%, #3b82f6 0%, #e879f9 100%)",
];

export default async function HomePage() {
  // Fetch sequentially to respect rate limits across both sources
  // Both sources — Gelbooru videos proxied through /api/proxy
  const trending = await getVideos({ limit: 20, order: "score", source: "all" });
  const newest = await getVideos({ limit: 10, order: "date", source: "all" });
  const topRated = await getVideos({ limit: 10, order: "favcount", source: "all" });
  const [tags, characters] = await Promise.all([
    getPopularTags(20),
    getPopularCharacters(12),
  ]);

  /* Hero video — pick highest scored */
  const hero = trending.data[0];
  const heroTitle = hero
    ? (hero.characters[0]
        ? hero.characters[0].replace(/_/g, " ")
        : hero.copyrights[0]
          ? hero.copyrights[0].replace(/_/g, " ")
          : "Trending Now")
    : "Trending Now";
  const heroTags = hero ? hero.tags.slice(0, 4) : [];

  return (
    <AgeGate>
      <main className="v2-page">

        {/* ══ SITE HERO — Brand + Value Prop ═══════════════════ */}
        <section className="v2-site-hero">
          <div className="v2-site-hero__bg" />
          <div className="v2-site-hero__content">
            <h1 className="v2-site-hero__h1">
              The largest free <span className="v2-site-hero__accent">animated hentai</span> library
            </h1>
            <p className="v2-site-hero__sub">
              57,000+ animated clips updated daily.
              Stream by character, tag, or trending score. Free, no account needed.
            </p>
            <div className="v2-site-hero__stats">
              <div className="v2-site-hero__stat">
                <span className="v2-site-hero__stat-num">57K+</span>
                <span className="v2-site-hero__stat-label">Videos</span>
              </div>
              <div className="v2-site-hero__stat">
                <span className="v2-site-hero__stat-num">50+</span>
                <span className="v2-site-hero__stat-label">Characters</span>
              </div>
              <div className="v2-site-hero__stat">
                <span className="v2-site-hero__stat-num">Daily</span>
                <span className="v2-site-hero__stat-label">Updates</span>
              </div>
              <div className="v2-site-hero__stat">
                <span className="v2-site-hero__stat-num">Free</span>
                <span className="v2-site-hero__stat-label">Forever</span>
              </div>
            </div>
            <div className="v2-site-hero__actions">
              <Link href="/explore" className="v2-btn-play">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                Start Watching
              </Link>
              <Link href="/trending" className="v2-btn-info">
                Trending Now
              </Link>
            </div>
          </div>
        </section>

        {/* ══ TRENDING HERO — Featured video ══════════════════ */}
        <section
          className="v2-hero"
          style={
            hero?.preview
              ? {
                  backgroundImage: `url(${hero.preview})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center 30%",
                }
              : undefined
          }
        >
          <div className="v2-hero__bg" style={hero?.thumbnail ? { background: "none" } : undefined} />
          <div className="v2-hero__gradient" />

          <div className="v2-hero__content">
            <span className="v2-hero__badge">Trending #1</span>

            <div className="v2-hero__meta">
              <span>{new Date().getFullYear()}</span>
              <span className="v2-hero__meta-dot" />
              <span>HD 1080p</span>
              <span className="v2-hero__meta-dot" />
              {hero && <span className="v2-hero__meta-score">★ {hero.score.toLocaleString()}</span>}
            </div>

            <h2 className="v2-hero__title">
              {heroTitle}<span>.</span>
            </h2>

            <div className="v2-hero__tags">
              {heroTags.map((tag) => (
                <span key={tag} className="v2-hero__tag">
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>

            <div className="v2-hero__actions">
              {hero && (
                <Link href={`/watch/${hero.slug}`} className="v2-btn-play">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                  Watch Now
                </Link>
              )}
            </div>
          </div>

          {hero && (
            <div className="v2-hero__poster">
              <img src={hero.preview} alt={heroTitle} className="v2-hero__poster-img" />
              <div className="v2-hero__poster-glow" />
            </div>
          )}
        </section>

        {/* ══ CONTENT AREA ═══════════════════════════════════════ */}
        <div className="v2-content">

          {/* Tags filter row */}
          <div className="v2-tags-row" role="list" aria-label="Browse by tag">
            <Link href="/explore" className="v2-tag-chip v2-tag-chip--active">All</Link>
            {tags.slice(0, 14).map((tag) => (
              <Link
                key={tag.name}
                href={`/tag/${encodeURIComponent(tag.name)}`}
                className="v2-tag-chip"
              >
                {tag.name.replace(/_/g, " ")}
              </Link>
            ))}
          </div>

          {/* ── Trending This Week ──────────────────────────────── */}
          <Carousel title="Trending This Week" badge="HOT" seeAllHref="/trending">
            {trending.data.map((video, i) => (
              <PosterCard key={video.id} video={video} priority={i < 5} />
            ))}
          </Carousel>

          {/* ── Top Rated ──────────────────────────────────────── */}
          <Carousel title="Top Rated All Time" seeAllHref="/explore">
            {topRated.data.map((video, i) => (
              <PosterCard key={video.id} video={video} rank={i + 1} />
            ))}
          </Carousel>

          {/* ── New Releases ───────────────────────────────────── */}
          <Carousel title="New Releases" badge="NEW" seeAllHref="/new">
            {newest.data.map((video) => (
              <PosterCard key={video.id} video={video} badge="NEW" />
            ))}
          </Carousel>

          {/* ── Popular Characters ─────────────────────────────── */}
          <Carousel title="Popular Characters" seeAllHref="/tags">
            {characters.map((char, i) => {
              const gradient = CHAR_GRADIENTS[i % CHAR_GRADIENTS.length];
              const initials = char.name
                .replace(/_/g, " ")
                .split(" ")
                .map((w) => w[0]?.toUpperCase() ?? "")
                .slice(0, 2)
                .join("");
              return (
                <Link
                  key={char.name}
                  href={`/tag/${encodeURIComponent(char.name)}`}
                  className="v2-char-card"
                >
                  <div className="v2-char-card__avatar" style={{ background: gradient }}>
                    <span className="v2-char-card__initials">{initials}</span>
                  </div>
                  <div className="v2-char-card__name">
                    {char.name.replace(/_/g, " ")}
                  </div>
                  <div className="v2-char-card__count">
                    {char.count >= 1000 ? `${(char.count / 1000).toFixed(1)}k` : char.count}
                  </div>
                </Link>
              );
            })}
          </Carousel>

          {/* ── Popular Tags ───────────────────────────────────── */}
          <section className="v2-tags-section">
            <div className="v2-tags-section__header">
              <h2 className="v2-tags-section__title">Popular Tags</h2>
              <Link href="/tags" className="v2-tags-section__link">See all</Link>
            </div>
            <div className="v2-tags-cloud">
              {tags.map((tag, i) => (
                <Link
                  key={tag.name}
                  href={`/tag/${encodeURIComponent(tag.name)}`}
                  className="v2-tag-pill"
                  style={{ background: TAG_GRADIENTS[i % TAG_GRADIENTS.length] }}
                >
                  #{tag.name.replace(/_/g, " ")}
                  <span className="v2-tag-pill__count">
                    {tag.count >= 1000 ? `${(tag.count / 1000).toFixed(1)}k` : tag.count}
                  </span>
                </Link>
              ))}
            </div>
          </section>

        </div>

        {/* ══ LEARN SECTION ═════════════════════════════════════ */}
        <section className="v2-learn-section">
          <div className="v2-learn-header">
            <h2 className="v2-tags-section__title">Learn About Hentai</h2>
            <Link href="/blog" className="v2-tags-section__link">All guides</Link>
          </div>
          <div className="v2-learn-grid">
            <Link href="/blog/what-is-hentai" className="v2-learn-card">
              <span className="v2-learn-card__icon">?</span>
              <div className="v2-learn-card__title">What is Hentai?</div>
              <div className="v2-learn-card__sub">History, genres &amp; culture</div>
            </Link>
            <Link href="/blog/understanding-hentai-tags" className="v2-learn-card">
              <span className="v2-learn-card__icon">#</span>
              <div className="v2-learn-card__title">Understanding Tags</div>
              <div className="v2-learn-card__sub">How the tag system works</div>
            </Link>
            <Link href="/blog/best-hentai-anime-2025" className="v2-learn-card">
              <span className="v2-learn-card__icon">★</span>
              <div className="v2-learn-card__title">Best of 2025-2026</div>
              <div className="v2-learn-card__sub">Top rated series to watch</div>
            </Link>
            <Link href="/glossary" className="v2-learn-card">
              <span className="v2-learn-card__icon">A</span>
              <div className="v2-learn-card__title">Hentai Glossary</div>
              <div className="v2-learn-card__sub">20+ terms explained</div>
            </Link>
          </div>
        </section>

        {/* ══ FOOTER ════════════════════════════════════════════ */}
        <footer className="v2-footer">
          <div className="v2-footer__links">
            <a href="/terms"   className="v2-footer__link">Terms</a>
            <a href="/privacy" className="v2-footer__link">Privacy</a>
            <a href="/dmca"    className="v2-footer__link">DMCA</a>
          </div>
          <p className="v2-footer__copy">&copy; {new Date().getFullYear()} iku.gg — All rights reserved. 18+ only.</p>
        </footer>

      </main>
    </AgeGate>
  );
}
