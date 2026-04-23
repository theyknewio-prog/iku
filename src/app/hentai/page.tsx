import Link from "next/link";
import { Suspense } from "react";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { Pagination } from "@/components/Pagination";
import { getVideos, countVideos } from "@/lib/content";
import type { Video } from "@/types/video";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hentai — Watch Free 2D Hentai Anime Videos | iku.gg",
  description:
    "Stream the largest collection of free 2D hentai anime videos. Full episodes, OAV, uncensored animations, all updated daily on iku.gg. No signup, no cost.",
  other: { rating: "adult" },
  alternates: { canonical: "https://iku.gg/hentai" },
  openGraph: {
    title: "Hentai — Free 2D Hentai Anime | iku.gg",
    description:
      "Watch free 2D hentai anime videos. Full episodes, OAV & uncensored animations updated daily.",
    siteName: "iku.gg",
    type: "website",
    images: [
      {
        url: "https://iku.gg/og-default.png",
        width: 1200,
        height: 630,
        alt: "iku.gg",
      },
    ],
  },
  robots: { index: true, follow: true },
};

export const revalidate = 1800;
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function HentaiPage({ searchParams }: Props) {
  const { page = "1", sort = "score" } = await searchParams;
  const currentPage = Math.max(1, parseInt(String(page)));
  const sortOrder = (
    ["score", "date", "favcount"].includes(String(sort)) ? sort : "score"
  ) as "score" | "date" | "favcount";

  const [{ data: videos, hasMore }, totalCount] = await Promise.all([
    getVideos({
      limit: 40,
      order: sortOrder,
      page: currentPage,
      vertical: "hentai",
      requireThumbnail: true,
    }),
    countVideos({ vertical: "hentai", requireThumbnail: true }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / 40));

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">2D Anime Hentai</p>
            <h1 className="tag-hero__title">Hentai — Free 2D Anime Episodes</h1>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginTop: "8px",
                maxWidth: "760px",
              }}
            >
              Full 2D hentai episodes, OAV, and uncensored anime animations.
              Long-form classic hentai from Hentaigasm, Hentaicity, and premium
              WordPress sources — all free, no signup, updated daily.
            </p>
          </div>

          {/* ── Sort bar ──────────────────────────────────────── */}
          <nav className="sort-bar" aria-label="Sort hentai videos">
            <Link
              href={`/hentai?sort=score&page=1`}
              className={`sort-pill${sortOrder === "score" ? " sort-pill--active" : ""}`}
              aria-current={sortOrder === "score" ? "page" : undefined}
            >
              Top Rated
            </Link>
            <Link
              href={`/hentai?sort=date&page=1`}
              className={`sort-pill${sortOrder === "date" ? " sort-pill--active" : ""}`}
              aria-current={sortOrder === "date" ? "page" : undefined}
            >
              Newest
            </Link>
            <Link
              href={`/hentai?sort=favcount&page=1`}
              className={`sort-pill${sortOrder === "favcount" ? " sort-pill--active" : ""}`}
              aria-current={sortOrder === "favcount" ? "page" : undefined}
            >
              Most Favorited
            </Link>
          </nav>

          {/* ── Video grid ────────────────────────────────────── */}
          {videos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "var(--color-text-tertiary)",
              }}
            >
              <p>No hentai videos found.</p>
            </div>
          ) : (
            <>
              <Link
                href="/pricing"
                className="hp-premium-strip"
                aria-label="Get iku Premium"
              >
                <span className="hp-premium-strip__icon">🚫</span>
                <span className="hp-premium-strip__text">
                  <strong>Skip every ad</strong> · 4K when available · Early
                  access · Unlimited favorites
                </span>
                <span className="hp-premium-strip__cta">
                  Premium 4.99€/mo →
                </span>
              </Link>
              <div className="video-grid">
                {videos.map((video: Video, i) => (
                  <ThumbnailCard
                    key={video.id}
                    video={video}
                    priority={i < 4}
                    lazy={i >= 4}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Pagination ───────────────────────────────────── */}
          {videos.length > 0 && (
            <div style={{ marginTop: "40px", marginBottom: "48px" }}>
              <Suspense>
                <Pagination
                  currentPage={currentPage}
                  hasNextPage={hasMore}
                  totalPages={totalPages}
                />
              </Suspense>
            </div>
          )}

          {/* ── SEO footer block ─────────────────────────────── */}
          <section
            style={{
              marginTop: "48px",
              padding: "32px 24px",
              background: "rgba(26, 22, 37, 0.5)",
              borderRadius: "16px",
              color: "var(--color-text-secondary)",
              fontSize: "14px",
              lineHeight: "1.7",
            }}
          >
            <h2
              style={{
                color: "var(--color-text-primary)",
                marginBottom: "16px",
              }}
            >
              About 2D Hentai on iku.gg
            </h2>
            <p>
              iku.gg hosts one of the largest free collections of{" "}
              <strong>2D hentai anime</strong> online. You&apos;ll find full OAV
              episodes (15–30 minutes each), classic 2D hentai series,
              uncensored animations, and both subbed and raw versions. All
              content is streaming-ready with no downloads required.
            </p>
            <p style={{ marginTop: "12px" }}>
              Looking for something specific? Browse{" "}
              <Link href="/character">by character</Link>,{" "}
              <Link href="/series">by series</Link>, or{" "}
              <Link href="/tags">by tag</Link>. Want something different? Try
              our <Link href="/3d">3D hentai catalogue</Link> or the{" "}
              <Link href="/feed">Shorts feed</Link> for quick clips.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
