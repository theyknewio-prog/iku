import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate } from "@/components/AgeGate";
import { PosterCard } from "@/components/PosterCard";
import { Carousel } from "@/components/Carousel";
import { searchPosts, getPopularTags, getPopularCharacters } from "@/lib/danbooru";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description: "Stream 65,000+ free hentai videos on iku.gg. Watch trending animated hentai clips. Browse by character, tag, and score.",
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
  const [trending, newest, topRated, tags, characters] = await Promise.all([
    searchPosts({ limit: 20, order: "score" }),
    searchPosts({ limit: 20, order: "date" }),
    searchPosts({ limit: 20, order: "favcount" }),
    getPopularTags(30),
    getPopularCharacters(20),
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

        {/* ══ HERO SECTION ══════════════════════════════════════ */}
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
          {/* Background layers */}
          <div className="v2-hero__bg" style={hero?.thumbnail ? { background: "none" } : undefined} />
          <div className="v2-hero__gradient" />

          {/* Left content */}
          <div className="v2-hero__content">
            <span className="v2-hero__badge">Trending #1</span>

            <div className="v2-hero__meta">
              <span>{new Date().getFullYear()}</span>
              <span className="v2-hero__meta-dot" />
              <span>HD 1080p</span>
              <span className="v2-hero__meta-dot" />
              {hero && <span className="v2-hero__meta-score">★ {hero.score > 0 ? hero.score : "9.4"}</span>}
            </div>

            <h1 className="v2-hero__title">
              {heroTitle}<span>.</span>
            </h1>

            <div className="v2-hero__tags">
              {heroTags.map((tag) => (
                <span key={tag} className="v2-hero__tag">
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>

            <p className="v2-hero__desc">
              Discover the most-watched animated clips, featuring top-scored characters and iconic scenes from fan-favorite series. Updated daily.
            </p>

            <div className="v2-hero__actions">
              {hero && (
                <Link href={`/watch/${hero.slug}`} className="v2-btn-play">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                  Watch Now
                </Link>
              )}
              <Link href="/trending" className="v2-btn-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Details
              </Link>
            </div>
          </div>

          {/* Right side — thumbnail of the trending video */}
          {hero && (
            <div className="v2-hero__poster">
              <img
                src={hero.preview}
                alt={heroTitle}
                className="v2-hero__poster-img"
              />
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
