import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate } from "@/components/AgeGate";
import { PosterCard } from "@/components/PosterCard";
import { Carousel } from "@/components/Carousel";
import { getPopularTags, getPopularCharacters } from "@/lib/danbooru";
import { getVideos, getThumbnailForTag } from "@/lib/content";
import { SERIES } from "@/data/series";
import Image from "next/image";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description: "Stream 353,000+ free hentai videos on iku.gg. Watch trending animated hentai clips. Browse by character, tag, and score.",
  other: { rating: "adult" },
};

export const revalidate = 3600;

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

function AdZone({ id, size }: { id: string; size: "leaderboard" | "medium-rect" }) {
  return (
    <div className={`hp-ad-zone hp-ad-zone--${size}`} data-ad-slot={id} aria-hidden="true" />
  );
}

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

        {/* ══ HERO — Featured Video + Brand ═══════════════════ */}
        <section
          className="hp-hero"
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
          <div className="hp-hero__overlay" />
          <div className="hp-hero__content">
            <span className="hp-hero__badge">
              <span className="hp-hero__badge-dot" />
              Trending #1
            </span>
            <h1 className="hp-hero__title">
              {heroTitle}<span className="hp-hero__title-dot">.</span>
            </h1>
            <div className="hp-hero__meta">
              <span>{new Date().getFullYear()}</span>
              <span className="hp-hero__meta-sep">·</span>
              <span>HD 1080P</span>
              <span className="hp-hero__meta-sep">·</span>
              {hero && <span className="hp-hero__score">★ {hero.score.toLocaleString()}</span>}
            </div>
            <div className="hp-hero__tags">
              {heroTags.map((tag) => (
                <span key={tag} className="hp-hero__tag">
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            <div className="hp-hero__actions">
              {hero && (
                <Link href={`/watch/${hero.slug}`} className="hp-btn-primary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                  Watch Now
                </Link>
              )}
              <Link href="/trending" className="hp-btn-secondary">
                Trending Now
              </Link>
            </div>
            <p className="hp-hero__sub">
              353,000+ free animated hentai clips · Updated daily
            </p>
          </div>
        </section>

        {/* ══ CONTENT AREA ═══════════════════════════════════════ */}
        <div className="v2-content">

          <AdZone id="hp-leaderboard-1" size="leaderboard" />

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

          {/* ── Popular Series ─────────────────────────────────── */}
          <Carousel title="Popular Series" seeAllHref="/series">
            {SERIES.slice(0, 12).map((series, i) => {
              const gradient = CHAR_GRADIENTS[i % CHAR_GRADIENTS.length];
              const thumb = getThumbnailForTag(series.tags[0] || series.name.toLowerCase());
              return (
                <Link key={series.slug} href={`/series/${series.slug}`} className="v2-char-card">
                  <div className="v2-char-card__avatar" style={{ background: gradient }}>
                    {thumb ? (
                      <Image src={thumb} alt={series.name} fill sizes="120px" style={{ objectFit: "cover" }} unoptimized />
                    ) : (
                      <span className="v2-char-card__initials">{series.name.split(" ").map(w => w[0]?.toUpperCase() ?? "").slice(0,2).join("")}</span>
                    )}
                  </div>
                  <div className="v2-char-card__name">{series.name}</div>
                  <div className="v2-char-card__count">{series.characters.length} characters</div>
                </Link>
              );
            })}
          </Carousel>

          {/* ── Top Rated ──────────────────────────────────────── */}
          <Carousel title="Top Rated All Time" seeAllHref="/explore">
            {topRated.data.map((video, i) => (
              <PosterCard key={video.id} video={video} rank={i + 1} />
            ))}
          </Carousel>

          <AdZone id="hp-medium-1" size="medium-rect" />

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
              const thumb = getThumbnailForTag(char.name);
              return (
                <Link
                  key={char.name}
                  href={`/character/${encodeURIComponent(char.name)}`}
                  className="v2-char-card"
                >
                  <div className="v2-char-card__avatar" style={{ background: gradient }}>
                    {thumb ? (
                      <Image src={thumb} alt={char.name.replace(/_/g, " ")} fill sizes="120px" style={{ objectFit: "cover" }} unoptimized />
                    ) : (
                      <span className="v2-char-card__initials">{char.name.replace(/_/g," ").split(" ").map(w=>w[0]?.toUpperCase()??"").slice(0,2).join("")}</span>
                    )}
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
        <footer className="hp-footer">
          <div className="hp-footer__grid">
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">Browse</h3>
              <Link href="/trending" className="hp-footer__link">Trending</Link>
              <Link href="/new" className="hp-footer__link">New Releases</Link>
              <Link href="/explore" className="hp-footer__link">Explore All</Link>
              <Link href="/tags" className="hp-footer__link">All Tags</Link>
              <Link href="/feed" className="hp-footer__link">Video Feed</Link>
            </div>
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">Characters</h3>
              {characters.slice(0, 6).map((c) => (
                <Link key={c.name} href={`/character/${encodeURIComponent(c.name)}`} className="hp-footer__link">
                  {c.name.replace(/_/g, " ")}
                </Link>
              ))}
            </div>
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">Series</h3>
              {SERIES.slice(0, 6).map((s) => (
                <Link key={s.slug} href={`/series/${s.slug}`} className="hp-footer__link">
                  {s.name}
                </Link>
              ))}
            </div>
            <div className="hp-footer__col">
              <h3 className="hp-footer__heading">About</h3>
              <Link href="/blog" className="hp-footer__link">Blog</Link>
              <Link href="/glossary" className="hp-footer__link">Glossary</Link>
              <a href="/terms" className="hp-footer__link">Terms</a>
              <a href="/privacy" className="hp-footer__link">Privacy</a>
              <a href="/dmca" className="hp-footer__link">DMCA</a>
            </div>
          </div>
          <div className="hp-footer__bottom">
            <span className="hp-footer__logo">iku</span>
            <p className="hp-footer__copy">&copy; {new Date().getFullYear()} iku.gg — All rights reserved. 18+ only.</p>
          </div>
        </footer>

      </main>
    </AgeGate>
  );
}
