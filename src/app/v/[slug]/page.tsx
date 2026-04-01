import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { getPost, getRelatedPosts } from "@/lib/danbooru";
import { extractIdFromSlug } from "@/lib/slugify";
import type { Video } from "@/types/video";

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: VideoPageProps) {
  const { slug } = await params;
  try {
    const id    = extractIdFromSlug(slug);
    const video = await getPost(id);
    const title = video.characters[0]
      ? `${video.characters[0].replace(/_/g, " ")}${video.copyrights[0] ? ` — ${video.copyrights[0].replace(/_/g, " ")}` : ""}`
      : "Video";
    return {
      title: `${title} — iku.gg`,
      robots: { index: false },
    };
  } catch {
    return { title: "Video — iku.gg", robots: { index: false } };
  }
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug } = await params;

  let video: Video;
  try {
    const id = extractIdFromSlug(slug);
    video = await getPost(id);
  } catch {
    notFound();
  }

  const title = video.characters[0]
    ? `${video.characters[0].replace(/_/g, " ")}${
        video.copyrights[0] ? ` — ${video.copyrights[0].replace(/_/g, " ")}` : ""
      }`
    : video.tags.slice(0, 3).map((t) => t.replace(/_/g, " ")).join(", ") || slug;

  const displayArtist = video.artists[0] ?? "";
  const scorePercent  = Math.round(
    (video.score / (video.score + Math.max(1, 20))) * 100
  );

  return (
    <div>
      {/* ── Header ───────────────────────────────────────── */}
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="site-header__logo">iku</Link>
          <div className="site-header__search-wrap">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
          <nav className="site-header__nav">
            <Link href="/"       className="nav-link">Feed</Link>
            <Link href="/browse" className="nav-link">Browse</Link>
            <Link href="/tags"   className="nav-link">Tags</Link>
          </nav>
        </div>
      </header>

      <main>
        <div className="player-layout">
          {/* ── Main column ───────────────────────────────── */}
          <div className="player-main">

            {/* Video */}
            <div className="player-video-wrap">
              <video
                src={video.url}
                poster={video.thumbnail}
                controls
                autoPlay
                loop
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
              />
            </div>

            {/* Title */}
            <h1 className="player-title">{title}</h1>

            {/* Meta row */}
            <div className="player-meta-row">
              <span className="player-views">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {video.favorites.toLocaleString()} saved
              </span>

              <div style={{ display: "flex", gap: "8px", marginLeft: "auto", flexWrap: "wrap" }}>
                <button className="player-vote-btn player-vote-btn--up" aria-label="Upvote">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  {video.score}
                </button>
                <button className="player-vote-btn player-vote-btn--down" aria-label="Downvote">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                  </svg>
                </button>

                <a
                  href={`https://danbooru.donmai.us/posts/${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Source
                </a>
              </div>
            </div>

            <div className="player-divider" />

            {/* Tags */}
            {video.tags.length > 0 && (
              <div className="player-tags">
                {video.tags.slice(0, 12).map((tag) => (
                  <Link key={tag} href={`/tags/${tag}`} className="tag-pill tag-pill--dark">
                    {tag.replace(/_/g, " ")}
                  </Link>
                ))}
                {video.characters.slice(0, 3).map((c) => (
                  <Link key={c} href={`/tags/${c}`} className="tag-pill tag-pill--active">
                    {c.replace(/_/g, " ")}
                  </Link>
                ))}
              </div>
            )}

            {/* Artist */}
            {displayArtist && (
              <div className="player-artist-row">
                <div
                  className="player-artist-avatar"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #ff2080, #7c3aff)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "16px",
                  }}
                >
                  {displayArtist.charAt(0).toUpperCase()}
                </div>
                <div>
                  <Link href={`/tags/${displayArtist}`} className="player-artist-name">
                    {displayArtist.replace(/_/g, " ")}
                  </Link>
                  <div className="player-artist-sub">Artist</div>
                </div>
                <Link href={`/tags/${displayArtist}`} className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }}>
                  Browse
                </Link>
              </div>
            )}

            {/* Score bar */}
            <div style={{ marginTop: "16px" }}>
              <div className="score-bar-wrap">
                <div className="score-bar">
                  <div className="score-bar__fill" style={{ width: `${Math.min(100, scorePercent)}%` }} />
                </div>
                <span className="score-bar__value">+{video.score}</span>
              </div>
            </div>

            {/* Related — mobile (below player) */}
            <div style={{ marginTop: "32px" }}>
              <div className="section-header">
                <h2 className="section-title" style={{ fontSize: "var(--text-md)" }}>
                  More like this
                </h2>
              </div>
              <Suspense fallback={
                <div className="video-grid">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-thumb" />
                      <div style={{ padding: "10px 12px 12px" }}>
                        <div className="skeleton-line skeleton" style={{ width: "85%", marginBottom: "5px" }} />
                        <div className="skeleton-line skeleton" style={{ width: "55%", height: "10px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              }>
                <RelatedGrid postId={video.id} />
              </Suspense>
            </div>
          </div>

          {/* ── Sidebar (desktop) ─────────────────────── */}
          <aside className="player-sidebar">
            <div className="player-sidebar__title">Up next</div>
            <Suspense fallback={
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="related-item">
                  <div className="related-item__thumb skeleton-thumb" style={{ width: "130px" }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-line skeleton" style={{ width: "90%", marginBottom: "5px" }} />
                    <div className="skeleton-line skeleton" style={{ width: "50%", height: "10px" }} />
                  </div>
                </div>
              ))
            }>
              <RelatedSidebar postId={video.id} />
            </Suspense>
          </aside>
        </div>

        {/* Footer */}
        <footer className="site-footer">
          <div className="page-container">
            <div className="site-footer__links">
              <a href="/terms"   className="site-footer__link">Terms</a>
              <a href="/privacy" className="site-footer__link">Privacy</a>
              <a href="/dmca"    className="site-footer__link">DMCA</a>
              <a href="/2257"    className="site-footer__link">18 U.S.C. 2257</a>
            </div>
            <p className="site-footer__copy">&copy; {new Date().getFullYear()} iku.gg</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ── Async server components for related content ────────────── */

async function RelatedGrid({ postId }: { postId: number }) {
  const related = await getRelatedPosts(postId, 8);
  if (!related.length) return null;
  return (
    <div className="video-grid">
      {related.map((v) => (
        <ThumbnailCard key={v.id} video={v} />
      ))}
    </div>
  );
}

async function RelatedSidebar({ postId }: { postId: number }) {
  const related = await getRelatedPosts(postId, 12);
  if (!related.length) return <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}>No related videos found.</p>;

  return (
    <>
      {related.map((v) => {
        const duration = v.duration
          ? `${Math.floor(v.duration / 60)}:${Math.floor(v.duration % 60).toString().padStart(2, "0")}`
          : "";
        const label = v.characters[0]
          ? v.characters[0].replace(/_/g, " ")
          : v.tags.slice(0, 2).map((t) => t.replace(/_/g, " ")).join(", ");
        return (
          <Link key={v.id} href={`/v/${v.slug}`} className="related-item">
            <div className="related-item__thumb">
              {v.thumbnail && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={v.thumbnail} alt={label} loading="lazy" />
              )}
              {duration && <span className="related-item__duration">{duration}</span>}
            </div>
            <div>
              <div className="related-item__title">{label}</div>
              <div className="related-item__meta">
                {v.artists[0]?.replace(/_/g, " ") ?? "unknown"} &middot; +{v.score}
              </div>
            </div>
          </Link>
        );
      })}
    </>
  );
}
