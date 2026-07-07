import Link from "next/link";
import React, { Suspense } from "react";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { Pagination } from "@/components/Pagination";
import { getVideos, countVideos } from "@/lib/content";
import { SORT_OPTIONS, parseSort } from "@/lib/sort-options";
import { AdRotationBanner } from "@/components/AdJoiBanner";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";
import { NativeOfferCard } from "@/components/NativeOfferCard";
import { GridAdBreak } from "@/components/GridAdBreak";

// Native affiliate cards woven into the grid (index → offer slug) and
// full-row network breaks (index → AdRotationBanner slug).
const NATIVE_AT: Record<number, string> = {
  6: "joi-ai",
  13: "candy-ai",
  21: "swipey",
  29: "meet",
  37: "joi-ai",
};
const BREAK_AT: Record<number, string> = {
  17: "swipey",
  33: "candy-ai",
};
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
  const { page = "1", sort } = await searchParams;
  const currentPage = Math.max(1, parseInt(String(page)));
  const sortOrder = parseSort(sort, "score");

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
          <nav className="sort-tabs" aria-label="Sort hentai videos">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={`/hentai?sort=${opt.value}&page=1`}
                className={`filter-chip${sortOrder === opt.value ? " filter-chip--active" : ""}`}
                aria-current={sortOrder === opt.value ? "page" : undefined}
              >
                {opt.label}
              </Link>
            ))}
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
              {/* AI #1 — Joi above the grid (anime/2D pool matches the
                  vertical's content style). */}
              <div style={{ margin: "8px auto 20px" }}>
                <AdRotationBanner slug="joi-ai" surface="page-hentai-top" />
              </div>
              <div className="video-grid">
                {videos.map((video: Video, i) => {
                  // Natives in-grid (1/8 cards) + full-row network breaks
                  // every ~2 screens — tube-standard density, zero walls.
                  const native = NATIVE_AT[i];
                  const gridBreak = BREAK_AT[i];
                  return (
                    <React.Fragment key={video.id}>
                      {native && (
                        <NativeOfferCard
                          slug={native}
                          surface={`hentai-native-${i}`}
                        />
                      )}
                      {gridBreak && (
                        <GridAdBreak>
                          <AdRotationBanner
                            slug={gridBreak}
                            surface={`page-hentai-break-${i}`}
                          />
                        </GridAdBreak>
                      )}
                      <ThumbnailCard
                        video={video}
                        priority={i < 4}
                        lazy={i >= 4}
                      />
                    </React.Fragment>
                  );
                })}
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

          {/* AI #2 — bottom of page, last-chance click before bounce.
              (Ex-mur de 3 dissous 2026-07-08: swipey remonté en grid break,
              Soulkyn déplacé après le bloc SEO — contenu entre chaque pub.) */}
          {videos.length > 0 && (
            <div style={{ margin: "16px auto 32px" }}>
              <AdRotationBanner slug="joi-ai" surface="page-hentai-bottom" />
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

          {videos.length > 0 && (
            <div style={{ margin: "24px auto 32px" }}>
              <SoulkynVerticalAd surface="page-hentai-vertical" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
