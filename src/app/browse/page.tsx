import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { SkeletonGrid } from "@/components/SkeletonGrid";
import { Suspense } from "react";

/* Popular tags (static for now — can be fetched from Danbooru) */
const POPULAR_TAGS = [
  { name: "animated",       count: "12.4k" },
  { name: "solo",           count: "9.8k"  },
  { name: "original",       count: "7.2k"  },
  { name: "bunny_girl",     count: "4.1k"  },
  { name: "maid",           count: "3.9k"  },
  { name: "school_uniform", count: "3.7k"  },
  { name: "elf",            count: "2.8k"  },
  { name: "demon_girl",     count: "2.4k"  },
  { name: "fantasy",        count: "2.1k"  },
  { name: "nurse",          count: "1.9k"  },
  { name: "swimwear",       count: "1.8k"  },
  { name: "catgirl",        count: "1.7k"  },
  { name: "fantasy_armor",  count: "1.5k"  },
  { name: "tentacles",      count: "1.3k"  },
  { name: "pov",            count: "1.1k"  },
  { name: "blindfold",      count: "980"   },
];

const POPULAR_CHARACTERS = [
  { name: "Asuka Langley",  count: "842",  slug: "asuka_langley_soryu"      },
  { name: "Zero Two",       count: "771",  slug: "zero_two"                 },
  { name: "Rem",            count: "654",  slug: "rem_rezero"               },
  { name: "Power",          count: "612",  slug: "power_chainsaw_man"       },
  { name: "Miku",           count: "589",  slug: "hatsune_miku"             },
  { name: "Yor Forger",     count: "534",  slug: "yor_forger"               },
];

export default function BrowsePage() {
  return (
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
            <Link href="/" className="nav-link">
              {/* Home */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Feed
            </Link>
            <Link href="/browse" className="nav-link nav-link--active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Browse
            </Link>
            <Link href="/tags" className="nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              Tags
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Page body ─────────────────────────────────────── */}
      <main>
        {/* ── Hero / headline ───────────────────────────── */}
        <div className="home-hero-bg">
          <div className="page-container" style={{ paddingTop: "48px", paddingBottom: "40px", position: "relative", zIndex: 1 }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--color-accent)",
                marginBottom: "8px",
              }}
            >
              Browse
            </p>
            <h1
              style={{
                fontSize: "clamp(1.75rem, 5vw, 2.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--color-text-primary)",
                marginBottom: "8px",
                lineHeight: 1.1,
              }}
            >
              Discover anime
            </h1>
            <p
              style={{
                fontSize: "var(--text-base)",
                color: "var(--color-text-tertiary)",
                maxWidth: "480px",
                lineHeight: 1.65,
              }}
            >
              Browse thousands of animated clips sorted by score, recency, and favorites.
            </p>
          </div>
        </div>

        <div className="page-container">

          {/* ── Trending ──────────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Trending now
              </h2>
              <Link href="/browse?sort=score" className="section-link">
                See all
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </div>

            {/* Horizontal scroll strip */}
            <div className="trending-strip">
              <Suspense fallback={null}>
                <TrendingStripContent />
              </Suspense>
            </div>
          </section>

          <div className="divider" />

          {/* ── New uploads ───────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                New uploads
              </h2>
              <Link href="/browse?sort=date" className="section-link">
                See all
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </div>

            <Suspense fallback={<SkeletonGrid count={10} />}>
              <NewUploadsGrid />
            </Suspense>
          </section>

          <div className="divider" />

          {/* ── Popular tags ──────────────────────────────── */}
          <section className="page-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-title__bar" aria-hidden />
                Popular tags
              </h2>
              <Link href="/tags" className="section-link">
                All tags
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </div>

            <div className="tag-grid-featured">
              {POPULAR_TAGS.map((tag) => (
                <Link
                  key={tag.name}
                  href={`/tags/${tag.name}`}
                  className="tag-card"
                >
                  <span className="tag-card__name">
                    {tag.name.replace(/_/g, " ")}
                  </span>
                  <span className="tag-card__count">{tag.count}</span>
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
                Popular characters
              </h2>
            </div>

            <div className="character-grid">
              {POPULAR_CHARACTERS.map((char) => (
                <Link
                  key={char.slug}
                  href={`/tags/${char.slug}`}
                  className="character-card"
                >
                  <div className="character-card__img-wrap">
                    {/* Placeholder gradient (replace with Image when you have real assets) */}
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: `linear-gradient(135deg, #1e1e1e, #141414)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                      }}
                    >
                      {char.name.charAt(0)}
                    </div>
                  </div>
                  <div className="character-card__name">{char.name}</div>
                  <div className="character-card__count">{char.count} videos</div>
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
              <a href="/2257" className="site-footer__link">18 U.S.C. 2257</a>
              <a href="mailto:contact@iku.gg" className="site-footer__link">Contact</a>
            </div>
            <p className="site-footer__copy">
              &copy; {new Date().getFullYear()} iku.gg &mdash; All content sourced from{" "}
              <a href="https://danbooru.donmai.us" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-text-secondary)", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                Danbooru
              </a>
              . For adults 18+ only.
            </p>
          </div>
        </footer>
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────── */}
      <BottomNav active="browse" />
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

/* These would normally fetch real data — shown as skeletons for now */
function TrendingStripContent() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="video-card" style={{ width: "220px", flexShrink: 0 }}>
          <div className="video-card__media">
            <div className="skeleton-thumb" />
            <span className="video-card__duration">0:42</span>
            <span className={`video-card__score${i < 3 ? " video-card__score--hot" : ""}`}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              {(500 - i * 40).toString()}
            </span>
            <span className={`rank-badge rank-badge--${i < 3 ? i + 1 : "n"}`}>{i + 1}</span>
          </div>
          <div className="video-card__body">
            <div className="skeleton-line skeleton" style={{ width: "85%", marginBottom: "5px" }} />
            <div className="skeleton-line skeleton" style={{ width: "55%", height: "10px" }} />
          </div>
        </div>
      ))}
    </>
  );
}

function NewUploadsGrid() {
  return <SkeletonGrid count={10} />;
}

function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <Link
        href="/"
        className={`bottom-nav__item${active === "home" ? " bottom-nav__item--active" : ""}`}
        aria-label="Feed"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Feed
      </Link>
      <Link
        href="/browse"
        className={`bottom-nav__item${active === "browse" ? " bottom-nav__item--active" : ""}`}
        aria-label="Browse"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
        Browse
      </Link>
      <Link
        href="/search"
        className={`bottom-nav__item${active === "search" ? " bottom-nav__item--active" : ""}`}
        aria-label="Search"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        Search
      </Link>
      <Link
        href="/tags"
        className={`bottom-nav__item${active === "tags" ? " bottom-nav__item--active" : ""}`}
        aria-label="Tags"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        Tags
      </Link>
      <Link
        href="/account"
        className={`bottom-nav__item${active === "account" ? " bottom-nav__item--active" : ""}`}
        aria-label="Account"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Account
      </Link>
    </nav>
  );
}
