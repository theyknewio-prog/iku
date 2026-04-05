import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AgeGate } from "@/components/AgeGate";
import { PosterCard } from "@/components/PosterCard";
import { Carousel } from "@/components/Carousel";
import { getPopularCharacters } from "@/lib/danbooru";
import { getVideos, getCuratedGenreCounts, getVideoOfTheDay } from "@/lib/content";
import { buildTitle, pickGenreTag } from "@/lib/video-display";
import { SERIES } from "@/data/series";
import { OnlineCounter } from "@/components/OnlineCounter";
import { JoinDiscordCTA } from "@/components/JoinDiscordCTA";

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description: "Stream 353,000+ free hentai videos on iku.gg. Watch trending animated hentai clips. Browse by character, tag, and score.",
  other: { rating: "adult" },
  alternates: { canonical: "https://iku.gg" },
};

export const revalidate = 3600;
export const dynamic = "force-dynamic";

/* ── Genre tag color classes — round-robin ─────────────── */
const TAG_COLORS = [
  "hp-gt-pink",
  "hp-gt-purple",
  "hp-gt-cyan",
  "hp-gt-gold",
  "hp-gt-green",
  "hp-gt-red",
  "hp-gt-orange",
  "hp-gt-blue",
];

/* ── Character fallback emojis (when no thumbnail) ───────── */
const CHAR_EMOJIS = ["⚔️", "🌸", "🧙", "🐉", "🏹", "😈", "👹", "🌙", "🤖", "🌿", "⚗️", "🐱"];

/* ── Character gradient ring classes — round-robin ─────── */
const CHAR_RING_CLASSES = [
  "hp-grad-pink",
  "hp-grad-cyan",
  "hp-grad-purple",
  "hp-grad-gold",
  "hp-grad-green",
  "hp-grad-red",
  "hp-grad-rainbow",
];

/* ── Grid card category color classes ──────────────────── */
const GRID_CATEGORY_COLORS = [
  "hp-gt-purple",
  "hp-gt-gold",
  "hp-gt-cyan",
  "hp-gt-green",
  "hp-gt-red",
  "hp-gt-pink",
  "hp-gt-orange",
  "hp-gt-blue",
];

function AdZone({ id, size }: { id: string; size: "leaderboard" | "medium-rect" }) {
  return (
    <div className={`hp-ad-zone hp-ad-zone--${size}`} data-ad-slot={id} aria-hidden="true" />
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scoreToRating(score: number): number {
  // Map score to 1-5 rating scale
  if (score >= 500) return 5;
  if (score >= 200) return 4.8;
  if (score >= 100) return 4.5;
  if (score >= 50) return 4.2;
  if (score >= 20) return 4.0;
  return 3.8;
}

function formatViews(score: number): string {
  if (score >= 10000) return `${(score / 1000).toFixed(0)}K`;
  if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
  return String(score);
}

export default async function HomePage() {
  const trending = await getVideos({ limit: 20, order: "score", source: "all", requireThumbnail: true });
  // Random offset (pages 1–5) so "New Releases" shows different content on each load.
  const newReleasesPage = Math.floor(Math.random() * 5) + 1;
  const newest = await getVideos({ limit: 10, page: newReleasesPage, order: "date", source: "all", requireThumbnail: true });
  const topRated = await getVideos({ limit: 8, order: "favcount", source: "all", requireThumbnail: true });
  const [genres, characters, vod] = await Promise.all([
    getCuratedGenreCounts(),
    getPopularCharacters(12),
    getVideoOfTheDay(),
  ]);

  const hero = trending.data[0];

  return (
    <AgeGate>
      <main className="v2-page">
        <div className="v2-content">

          {/* ── Mobile stats bar — visible only when hero-right is hidden (<960px) ── */}
          <div className="hp-hero-mobile-stats" aria-label="Live stats">
            <div className="hp-hero-mobile-stats__item hp-hero-mobile-stats__item--live">
              <OnlineCounter />
            </div>
            <div className="hp-hero-mobile-stats__item">
              <span className="hp-hero-mobile-stats__rating">&#9733; 4.8 rating</span>
            </div>
            <div className="hp-hero-mobile-stats__item">
              <span className="hp-hero-mobile-stats__new">+847 today</span>
            </div>
          </div>

          {/* ================================================================
              HERO -- Split layout (left text + right gradient orbs)
          ================================================================ */}
          <section className="hp-hero" aria-label="Featured content">
            <div className="hp-hero-left">
              <div className="hp-hero-eyebrow">
                <span className="hp-hero-eyebrow__dot" />
                #1 Anime Hentai Platform
              </div>

              <h1 className="hp-hero-title">
                The largest<br />
                <span className="hp-hero-gradient-text">free hentai</span><br />
                collection online
              </h1>

              <p className="hp-hero-sub">
                <strong>353,000+</strong> animated clips from your favourite series,
                characters and artists — updated daily. No account needed.
              </p>

              <div className="hp-hero-ctas">
                <Link href="/explore" className="hp-btn-primary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                  Browse Now
                </Link>
                <Link href="/feed" className="hp-btn-secondary">
                  <span>⚡</span> Try Shorts
                </Link>
              </div>

              <div style={{ marginTop: "20px" }}>
                <JoinDiscordCTA variant="hero" />
              </div>

              <div className="hp-hero-stats">
                <div className="hp-hero-stat">
                  <span className="hp-hero-stat__num">353K+</span>
                  <span className="hp-hero-stat__label">Videos</span>
                </div>
                <div className="hp-hero-stat">
                  <span className="hp-hero-stat__num">12K+</span>
                  <span className="hp-hero-stat__label">Characters</span>
                </div>
                <div className="hp-hero-stat">
                  <span className="hp-hero-stat__num">Free</span>
                  <span className="hp-hero-stat__label">Always</span>
                </div>
              </div>
            </div>

            <div className="hp-hero-right">
              <div className="hp-hero-illustration">
                {/* Animated orbs */}
                <div className="hp-hero-orb hp-hero-orb--1" />
                <div className="hp-hero-orb hp-hero-orb--2" />
                <div className="hp-hero-orb hp-hero-orb--3" />

                {/* Floating badges */}
                <div className="hp-hero-badge-float hp-hero-badge-float--1">
                  <OnlineCounter />
                </div>
                <div className="hp-hero-badge-float hp-hero-badge-float--2">
                  4.8 avg rating
                </div>
                <div className="hp-hero-badge-float hp-hero-badge-float--3">
                  +847 today
                </div>

                {/* Preview card */}
                {hero && (
                  <Link href={`/watch/${hero.slug}`} className="hp-hero-play-card">
                    <div className="hp-hero-play-card__thumb">
                      {hero.preview ? (
                        <Image
                          src={hero.preview}
                          alt="Trending now"
                          fill
                          sizes="160px"
                          style={{ objectFit: "cover" }}
                          unoptimized
                        />
                      ) : (
                        <span style={{ fontSize: 36 }}>&#9654;</span>
                      )}
                    </div>
                    <div className="hp-hero-play-card__title">Trending right now</div>
                    <div className="hp-hero-play-card__meta">
                      <span className="hp-hero-play-card__stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                      <span>{formatViews(hero.score)} views</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* ── Ad zone — Leaderboard ──────────────────────────── */}
          <AdZone id="hp-leaderboard-1" size="leaderboard" />

          {/* ================================================================
              TRENDING NOW -- Horizontal poster scroll
          ================================================================ */}
          <Carousel title="🔥 Trending Now" badge="HOT" seeAllHref="/trending">
            {trending.data.map((video, i) => (
              <PosterCard key={video.id} video={video} rank={i < 8 ? i + 1 : undefined} priority={i < 5} />
            ))}
          </Carousel>

          {/* ================================================================
              VIDEO OF THE DAY — deterministic daily pick
          ================================================================ */}
          {vod && (
            <section aria-label="Video of the Day" className="hp-vod">
              <div className="hp-vod__badge">✨ Video of the Day · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}</div>
              <Link href={`/watch/${vod.slug}`} className="hp-vod__card">
                <div className="hp-vod__thumb">
                  {vod.thumbnail && (
                    <Image
                      src={vod.thumbnail}
                      alt={vod.title || vod.characters[0] || "Video of the Day"}
                      fill
                      sizes="(max-width: 960px) 100vw, 600px"
                      style={{ objectFit: "cover" }}
                      unoptimized
                      priority
                    />
                  )}
                  <div className="hp-vod__overlay" />
                  <div className="hp-vod__play">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                  </div>
                </div>
                <div className="hp-vod__info">
                  <div className="hp-vod__eyebrow">🎯 Today's hand-picked banger</div>
                  <h2 className="hp-vod__title">
                    {vod.title
                      ? vod.title.replace(/_/g, " ")
                      : vod.characters[0]?.replace(/_/g, " ") || "Featured clip"}
                  </h2>
                  {vod.characters[0] && (
                    <div className="hp-vod__char">👤 {vod.characters[0].replace(/_/g, " ")}</div>
                  )}
                  <p className="hp-vod__desc">
                    Curated pick of the day. Watch before midnight UTC to earn <strong>+20 bonus points</strong>.
                    A new pick drops every day at 00:00 UTC.
                  </p>
                  <div className="hp-vod__cta">Watch now →</div>
                </div>
              </Link>
            </section>
          )}

          {/* ================================================================
              TOP RATED THIS WEEK -- 4-column grid
          ================================================================ */}
          <section aria-label="Top Rated This Week">
            <div className="hp-section-header">
              <h2 className="hp-section-title">⭐ Top Rated This Week</h2>
              <Link href="/explore" className="hp-section-link">See all &#8594;</Link>
            </div>

            <div className="hp-video-grid" role="list">
              {topRated.data.map((video, i) => {
                const charName = video.characters[0]
                  ? video.characters[0].replace(/_/g, " ")
                  : null;
                const categoryColor = GRID_CATEGORY_COLORS[i % GRID_CATEGORY_COLORS.length];
                const genre = pickGenreTag(video);
                const title = buildTitle(video);
                const rating = scoreToRating(video.score);
                const isHot = video.score >= 200;
                const isNew = (Date.now() - new Date(video.createdAt).getTime()) < 72 * 60 * 60 * 1000;

                return (
                  <Link
                    key={video.id}
                    href={`/watch/${video.slug}`}
                    className="hp-grid-card"
                    role="listitem"
                  >
                    <div className="hp-grid-card__thumb">
                      <div className="hp-grid-card__thumb-inner">
                        {video.preview ? (
                          <Image
                            src={video.preview}
                            alt={title}
                            fill
                            sizes="(max-width: 600px) 50vw, (max-width: 960px) 33vw, 25vw"
                            style={{ objectFit: "cover" }}
                            unoptimized
                          />
                        ) : (
                          <div className={`hp-thumb-grad hp-thumb-grad--${(i % 12) + 1}`} />
                        )}
                      </div>
                      {isHot && <span className="hp-hot-badge">🔥 Hot</span>}
                      {!isHot && isNew && <span className="hp-new-badge">New</span>}
                      {video.duration && (
                        <span className="hp-duration-badge">{formatDuration(video.duration)}</span>
                      )}
                    </div>
                    <div className="hp-grid-card__info">
                      <span className={`hp-grid-card__category ${categoryColor}`}>{genre}</span>
                      <div className="hp-grid-card__title">{title}</div>
                      {charName && (
                        <div className="hp-grid-card__char">👤 {charName}</div>
                      )}
                      <div className="hp-grid-card__foot">
                        <div className="hp-rating-row">
                          <span className="hp-star-filled">&#9733;</span>
                          <span className="hp-rating-num">{rating.toFixed(1)}</span>
                          <span>({formatViews(video.favorites)})</span>
                        </div>
                        <span className="hp-views-count">{formatViews(video.score)} views</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── Ad zone — Medium rect ──────────────────────────── */}
          <AdZone id="hp-medium-1" size="medium-rect" />

          {/* ================================================================
              POPULAR CHARACTERS -- Circular avatars with gradient rings
          ================================================================ */}
          <section aria-label="Popular Characters">
            <div className="hp-section-header">
              <h2 className="hp-section-title">💖 Popular Characters</h2>
              <Link href="/tags" className="hp-section-link">See all &#8594;</Link>
            </div>

            <div className="hp-chars-scroll" role="list">
              {characters.map((char, i) => {
                const ringClass = CHAR_RING_CLASSES[i % CHAR_RING_CLASSES.length];
                const displayName = char.name.replace(/_/g, " ");
                const count = char.count >= 1000 ? `${(char.count / 1000).toFixed(1)}k` : String(char.count);

                return (
                  <Link
                    key={char.name}
                    href={`/character/${encodeURIComponent(char.name)}`}
                    className="hp-char-item"
                    role="listitem"
                  >
                    <div className={`hp-char-avatar-wrap ${ringClass}`}>
                      <div className="hp-char-avatar">
                        <span className="hp-char-avatar__emoji" style={{ fontSize: "28px", lineHeight: 1 }}>
                          {CHAR_EMOJIS[i % CHAR_EMOJIS.length]}
                        </span>
                      </div>
                    </div>
                    <span className="hp-char-name">{displayName}</span>
                    <span className="hp-char-count">{count} clips</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ================================================================
              BROWSE BY GENRE -- Colorful pastel pill tags
          ================================================================ */}
          <section aria-label="Browse by Genre">
            <div className="hp-section-header">
              <h2 className="hp-section-title">🏷️ Browse by Genre</h2>
              <Link href="/tags" className="hp-section-link">See all &#8594;</Link>
            </div>

            <div className="hp-tags-cloud" role="list">
              {genres.map((genre, i) => {
                const colorClass = TAG_COLORS[i % TAG_COLORS.length];
                const count = genre.count >= 1000 ? `${(genre.count / 1000).toFixed(1)}k` : String(genre.count);
                return (
                  <Link
                    key={genre.name}
                    href={`/tag/${encodeURIComponent(genre.name)}`}
                    className={`hp-genre-tag ${colorClass}`}
                    role="listitem"
                  >
                    {genre.emoji} {genre.name.charAt(0).toUpperCase() + genre.name.slice(1)}
                    <span className="hp-genre-tag__count">{count}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ================================================================
              NEW RELEASES -- Horizontal poster scroll
          ================================================================ */}
          <Carousel title="🆕 New Releases" badge="NEW" seeAllHref="/new">
            {newest.data.map((video) => (
              <PosterCard key={video.id} video={video} badge="NEW" />
            ))}
          </Carousel>

          {/* ================================================================
              GO PRO CTA — prominent, animated, above the footer
          ================================================================ */}
          <section className="hp-go-pro" aria-label="Upgrade to Pro">
            <div className="hp-go-pro__bg" aria-hidden="true">
              <div className="hp-go-pro__orb hp-go-pro__orb--1" />
              <div className="hp-go-pro__orb hp-go-pro__orb--2" />
              <div className="hp-go-pro__orb hp-go-pro__orb--3" />
            </div>
            <div className="hp-go-pro__content">
              <div className="hp-go-pro__eyebrow">✨ iku.gg Pro</div>
              <h2 className="hp-go-pro__title">
                Remove ads. <span className="hp-go-pro__title-accent">Forever.</span>
              </h2>
              <p className="hp-go-pro__sub">
                Zero ads, unlimited favorites, 48h early access, Discord Pro lounge,
                and more. From <strong>4.99€/month</strong> — cancel anytime.
              </p>
              <div className="hp-go-pro__features">
                <span>🚫 Zero ads</span>
                <span>❤️ Unlimited favorites</span>
                <span>🎯 Early access 48h</span>
                <span>💎 Pro badge</span>
                <span>🎮 Discord Pro channel</span>
                <span>⚡ Priority loading</span>
              </div>
              <div className="hp-go-pro__ctas">
                <Link href="/pricing" className="hp-go-pro__btn hp-go-pro__btn--primary">
                  See plans ✨
                </Link>
                <Link href="/pricing" className="hp-go-pro__btn hp-go-pro__btn--ghost">
                  Lifetime 69.99€
                  <span className="hp-go-pro__btn-sub">Limited 500 spots</span>
                </Link>
              </div>
            </div>
          </section>

        </div>

        {/* ================================================================
            FOOTER
        ================================================================ */}
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
