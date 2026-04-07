import Link from "next/link";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { SignupCTA } from "@/components/SignupCTA";
import { getVideos } from "@/lib/content";
import type { Video } from "@/types/video";
import type { Metadata } from "next";
import { AdZoneClient } from "@/components/AdZoneClient";
import { AD_ZONES } from "@/lib/ad-config";

export const metadata: Metadata = {
  title: "Trending Hentai Videos 2026 | iku.gg",
  description:
    "The hottest trending hentai videos right now. Top rated animated hentai clips ranked by score — updated daily on iku.gg.",
  other: { rating: "adult" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Trending Hentai Videos 2026 | iku.gg",
    description:
      "Top rated hentai videos trending now. Stream free animated hentai ranked by community score.",
    siteName: "iku.gg",
    type: "website",
  },
};

export const revalidate = 1800;
export const dynamic = "force-dynamic";

const CATEGORY_TAGS = [
  { label: "School Uniform", tag: "school_uniform" },
  { label: "Bunny Girl", tag: "bunny_girl" },
  { label: "Maid", tag: "maid" },
  { label: "Catgirl", tag: "catgirl" },
  { label: "Elf", tag: "elf" },
  { label: "POV", tag: "pov" },
  { label: "Solo", tag: "solo" },
  { label: "Nurse", tag: "nurse" },
];

export default async function TrendingPage() {
  const { data: videos } = await getVideos({
    limit: 40,
    order: "score",
    requireThumbnail: true,
  });

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          {/* ── Ad zone — Leaderboard top ─────────────────── */}
          <AdZoneClient zoneId={AD_ZONES.exoclick.watchUnderplayer728} size="728x90" />

          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Most Popular</p>
            <h1 className="tag-hero__title">
              Trending Hentai
            </h1>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginTop: "8px",
              }}
            >
              Top {videos.length} hentai videos ranked by community score
            </p>
          </div>

          {/* ── Browse by category strip ─────────────────────── */}
          <div className="filter-bar" style={{ marginBottom: "32px" }}>
            {CATEGORY_TAGS.map((cat) => (
              <Link
                key={cat.tag}
                href={`/tag/${cat.tag}`}
                className="filter-chip"
              >
                {cat.label}
              </Link>
            ))}
          </div>

          {/* ── Video grid with rank badges ───────────────────── */}
          {videos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "var(--color-text-tertiary)",
              }}
            >
              <p>No trending hentai available right now. Check back soon.</p>
            </div>
          ) : (
            <div className="video-grid">
              {videos.map((video: Video, i) => (
                <ThumbnailCard
                  key={video.id}
                  video={video}
                  rank={i + 1}
                  priority={i < 4}
                  lazy={i >= 4}
                />
              ))}
            </div>
          )}

          {/* ── Signup CTA (shown only for anonymous visitors) ───── */}
          <SignupCTA placement="trending" />

          {/* ── Bottom CTA ────────────────────────────────────── */}
          <div
            style={{
              marginTop: "48px",
              marginBottom: "32px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginBottom: "16px",
              }}
            >
              Want the freshest hentai uploads?
            </p>
            <Link
              href="/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 24px",
                borderRadius: "var(--radius-full)",
                background: "var(--button-primary-bg)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                textDecoration: "none",
                boxShadow: "var(--button-primary-shadow)",
              }}
            >
              View New Hentai
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        <footer className="site-footer">
          <div className="page-container">
            <div className="site-footer__links">
              <a href="/terms" className="site-footer__link">Terms</a>
              <a href="/privacy" className="site-footer__link">Privacy</a>
              <a href="/dmca" className="site-footer__link">DMCA</a>
            </div>
            <p className="site-footer__copy">&copy; {new Date().getFullYear()} iku.gg</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
