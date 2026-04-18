import React from "react";
import Link from "next/link";
import { HentaiProsBanner } from "@/components/HentaiProsBanner";
import { ListingAdBlock } from "@/components/ListingAdBlock";
import { Suspense } from "react";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { Pagination } from "@/components/Pagination";
import { getVideos, countVideos } from "@/lib/content";
import type { Video } from "@/types/video";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Hentai & Cartoon Porn — Free SFM Animations | iku.gg",
  description:
    "The biggest free 3D hentai, cartoon porn & SFM animation library. Genshin, Overwatch, Blue Archive, Honkai Star Rail & more. No signup, updated daily on iku.gg.",
  other: { rating: "adult" },
  alternates: { canonical: "https://iku.gg/3d" },
  openGraph: {
    title: "3D Hentai & Cartoon Porn | iku.gg",
    description:
      "Free 3D hentai, SFM animations, cartoon porn & game character compilations updated daily.",
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

const TOP_GAMES = [
  { label: "Genshin Impact", slug: "genshin_impact", count: "3,382" },
  { label: "Blue Archive", slug: "blue_archive", count: "2,235" },
  { label: "Overwatch", slug: "overwatch", count: "2,193" },
  { label: "Zenless Zone Zero", slug: "zenless_zone_zero", count: "1,266" },
  { label: "Final Fantasy", slug: "final_fantasy", count: "1,205" },
  { label: "Honkai Star Rail", slug: "honkai:_star_rail", count: "848" },
  { label: "Fortnite", slug: "fortnite", count: "772" },
  { label: "Resident Evil", slug: "resident_evil", count: "706" },
  { label: "Nier Automata", slug: "nier:automata", count: "613" },
  { label: "Dead or Alive", slug: "dead_or_alive", count: "705" },
];

export default async function ThreeDPage({ searchParams }: Props) {
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
      vertical: "3d",
      requireThumbnail: true,
    }),
    countVideos({ vertical: "3d", requireThumbnail: true }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / 40));

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          <ListingAdBlock variant="top" />
          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">3D & Cartoon Porn</p>
            <h1 className="tag-hero__title">
              3D Hentai, SFM Animations & Cartoon Porn
            </h1>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginTop: "8px",
                maxWidth: "760px",
              }}
            >
              The biggest free library of 3D hentai, cartoon porn, SFM (Source
              Filmmaker) animations and HMV compilations. 300,000+ clips
              featuring Genshin Impact, Overwatch, Blue Archive, Honkai Star
              Rail, Zenless Zone Zero and more. No signup required.
            </p>
          </div>

          {/* ── Top games strip — quick access ─────────────────── */}
          <div
            className="filter-bar"
            style={{ marginBottom: "32px", flexWrap: "wrap" }}
          >
            {TOP_GAMES.map((g) => (
              <Link
                key={g.slug}
                href={`/series/${g.slug}`}
                className="filter-chip"
                title={`${g.label} — ${g.count} videos`}
              >
                {g.label}
                <span
                  style={{ opacity: 0.55, marginLeft: "6px", fontSize: "11px" }}
                >
                  {g.count}
                </span>
              </Link>
            ))}
          </div>

          {/* ── Sort bar ──────────────────────────────────────── */}
          <nav className="sort-bar" aria-label="Sort 3D videos">
            <Link
              href={`/3d?sort=score&page=1`}
              className={`sort-pill${sortOrder === "score" ? " sort-pill--active" : ""}`}
              aria-current={sortOrder === "score" ? "page" : undefined}
            >
              Top Rated
            </Link>
            <Link
              href={`/3d?sort=date&page=1`}
              className={`sort-pill${sortOrder === "date" ? " sort-pill--active" : ""}`}
              aria-current={sortOrder === "date" ? "page" : undefined}
            >
              Newest
            </Link>
            <Link
              href={`/3d?sort=favcount&page=1`}
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
              <p>No 3D videos found.</p>
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
              <ListingAdBlock variant="mid" />
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
              <ListingAdBlock variant="bottom" />
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
              About 3D Hentai, SFM & Cartoon Porn on iku.gg
            </h2>
            <p>
              This is iku.gg&apos;s <strong>3D catalogue</strong> — over 300,000
              clips covering Source Filmmaker (SFM) animations, 3D hentai,
              cartoon porn, HMV compilations and fan animations from the most
              popular gaming franchises. You&apos;ll find content from Genshin
              Impact, Overwatch, Blue Archive, Zenless Zone Zero, Honkai Star
              Rail, Final Fantasy, Resident Evil, Nier Automata, Fortnite, Dead
              or Alive and many more.
            </p>
            <p style={{ marginTop: "12px" }}>
              Prefer classic 2D animated OAV? Check our{" "}
              <Link href="/hentai">Hentai 2D catalogue</Link>. Want bite-sized
              clips instead? Try the <Link href="/feed">Shorts feed</Link>.
              Browse by <Link href="/character">character</Link>,{" "}
              <Link href="/series">series/game</Link>, or{" "}
              <Link href="/tags">tag</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
