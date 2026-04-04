import Link from "next/link";
import { Suspense } from "react";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { Pagination } from "@/components/Pagination";
import { searchPosts } from "@/lib/danbooru";
import type { Video } from "@/types/video";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Hentai Videos — Latest Uploads | iku.gg",
  description:
    "The latest hentai video uploads on iku.gg. Stream brand new animated hentai clips as they drop — sorted by newest first.",
  other: { rating: "adult" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "New Hentai Videos — Latest Uploads | iku.gg",
    description:
      "Stream the newest hentai videos freshly uploaded to iku.gg. Updated daily.",
    siteName: "iku.gg",
    type: "website",
  },
};

export const revalidate = 1800;
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NewPage({ searchParams }: Props) {
  const { page = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(String(page)));

  const { data: videos, hasMore } = await searchPosts({
    limit: 40,
    order: "date",
    page: currentPage,
  });

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Fresh Uploads</p>
            <h1 className="tag-hero__title">New Hentai Videos</h1>
            <div className="tag-hero__stats">
              <span className="tag-hero__stat">
                Page <strong>{currentPage}</strong>
              </span>
              <span className="tag-hero__stat">
                <strong>{videos.length}</strong> latest hentai clips
              </span>
            </div>
          </div>

          {/* ── Video grid ────────────────────────────────────── */}
          {videos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "var(--color-text-tertiary)",
              }}
            >
              <p>No new hentai videos found. Check back shortly.</p>
              <Link
                href="/trending"
                style={{
                  display: "inline-flex",
                  marginTop: "16px",
                  color: "var(--color-accent)",
                  fontSize: "var(--text-sm)",
                  textDecoration: "none",
                }}
              >
                Browse trending hentai instead
              </Link>
            </div>
          ) : (
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
          )}

          {/* ── Pagination ───────────────────────────────────── */}
          {videos.length > 0 && (
            <div style={{ marginTop: "40px", marginBottom: "48px" }}>
              <Suspense>
                <Pagination currentPage={currentPage} hasNextPage={hasMore} />
              </Suspense>
            </div>
          )}
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
