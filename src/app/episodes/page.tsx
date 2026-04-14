import React from "react";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { Pagination } from "@/components/Pagination";
import { ListingAdBlock } from "@/components/ListingAdBlock";
import { getVideos, countVideos } from "@/lib/content";
import type { Video } from "@/types/video";

export const revalidate = 1800;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hentai Episodes — Full-length 2D & 3D | iku.gg Premium",
  description:
    "Stream full-length hentai episodes — 7,000+ uncut 2D OAVs from Hentaicity & Hentaigasm plus 31,000+ long-form 3D animations. Free preview, full library with iku Premium 4.99€/mo.",
  other: { rating: "adult" },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://iku.gg/episodes" },
  openGraph: {
    title: "Full-length Hentai Episodes — iku.gg",
    description:
      "38,000+ full-length hentai episodes — 2D classics + long-form 3D. Stream the preview free, unlock everything with Premium 4.99€/mo.",
    siteName: "iku.gg",
    type: "website",
    images: [{ url: "https://iku.gg/og-default.png", width: 1200, height: 630, alt: "iku.gg" }],
  },
};

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function EpisodesPage({ searchParams }: Props) {
  // Default sort = date because rule34video garbage-collects old thumbnails
  // (404s on screencap CDN). Sorting by score surfaces popular-but-old
  // videos with dead images. Date keeps fresh, working thumbs at top.
  const { page = "1", sort = "date" } = await searchParams;
  const currentPage = Math.max(1, parseInt(String(page)));
  const sortOrder = (["score", "date", "favcount"].includes(String(sort))
    ? sort
    : "date") as "score" | "date" | "favcount";

  const [{ data: videos, hasMore }, totalCount] = await Promise.all([
    getVideos({
      limit: 40,
      order: sortOrder,
      page: currentPage,
      longFormat: true,
      requireThumbnail: true,
    }),
    countVideos({ longFormat: true, requireThumbnail: true }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / 40));

  return (
    <div className="shell-content">
      <main>
        <div className="page-container">
          <ListingAdBlock variant="top" />

          {/* ── Page hero ─────────────────────────────────────── */}
          <div className="tag-hero">
            <p className="tag-hero__label">Premium · Full-length episodes</p>
            <h1 className="tag-hero__title">
              Hentai Episodes — Full-length 2D &amp; 3D
            </h1>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginTop: "10px",
                lineHeight: 1.6,
                maxWidth: "780px",
              }}
            >
              <strong>{totalCount.toLocaleString()}</strong> full-length hentai
              episodes catalogued on iku.gg — uncensored 2D OAVs from
              Hentaicity &amp; Hentaigasm, plus long-form 3D animations from
              Rule34Video and SFM creators. Every episode is over 10 minutes,
              most are 20-40+ minutes. Free users see a preview;{" "}
              <Link href="/pricing" style={{ color: "var(--color-accent)" }}>
                iku Premium
              </Link>{" "}
              unlocks the full library, removes every ad, and adds 4K when
              available — all for 4.99 €/month, cancel anytime.
            </p>
          </div>

          {/* ── Premium banner ────────────────────────────────── */}
          <Link
            href="/pricing"
            className="hp-unlock-banner"
            aria-label="Unlock all full-length episodes with iku Premium"
            style={{ marginTop: "20px" }}
          >
            <span className="hp-unlock-banner__icon" aria-hidden>✨</span>
            <span className="hp-unlock-banner__text">
              <span className="hp-unlock-banner__title">
                Unlock every full episode
              </span>
              <span className="hp-unlock-banner__sub">
                {totalCount.toLocaleString()} episodes · 4K when available · zero ads · cancel anytime
              </span>
            </span>
            <span className="hp-unlock-banner__cta">4.99€/mo</span>
          </Link>

          {/* ── Sort filter bar ───────────────────────────────── */}
          <div className="filter-bar" style={{ marginTop: 24 }}>
            {([
              { value: "date", label: "Newest" },
              { value: "score", label: "Top Rated" },
              { value: "favcount", label: "Most Saved" },
            ] as const).map((opt) => (
              <Link
                key={opt.value}
                href={`/episodes?sort=${opt.value}&page=1`}
                className={`filter-chip${sortOrder === opt.value ? " filter-chip--active" : ""}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* ── Grid ──────────────────────────────────────────── */}
          {videos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "var(--color-text-tertiary)",
              }}
            >
              <p>No episodes found.</p>
            </div>
          ) : (
            <>
              <Link href="/pricing" className="hp-premium-strip" aria-label="Get iku Premium">
                <span className="hp-premium-strip__icon">🚫</span>
                <span className="hp-premium-strip__text">
                  <strong>Skip every ad &amp; unlock all episodes</strong> · 4K when available · cancel anytime
                </span>
                <span className="hp-premium-strip__cta">Premium 4.99€/mo →</span>
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

          {/* ── SEO body ──────────────────────────────────────── */}
          <section
            style={{
              maxWidth: "780px",
              margin: "32px auto 64px",
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.7,
            }}
          >
            <h2 style={{ color: "var(--color-text-primary)", fontSize: "20px", marginBottom: "12px" }}>
              What you get with full-length hentai
            </h2>
            <p>
              Tube clips are great for 2-minute fixes — but full hentai
              episodes are a different format entirely. The 7,000+ episodes
              from Hentaicity and Hentaigasm are uncensored 20-30 minute
              OAV releases (Bible Black, La Blue Girl, Taimanin Asagi era),
              while the 31,000+ long-form Rule34Video entries are
              compilation- and storyline-style 3D animations from
              independent creators using Blender, Koikatsu, Honey Select,
              and SFM.
            </p>
            <p>
              On the free tier you can preview every episode page, see the
              metadata, related videos and FAQ. Hitting play on a locked
              episode shows an unlock screen. iku Premium (4.99 €/month)
              removes the unlock gate site-wide, kills every ad, and serves
              4K when the source supports it. Yearly is 39.99 € (33% off),
              cancel anytime.
            </p>
            <p>
              Don&apos;t want full episodes? The{" "}
              <Link href="/hentai" style={{ color: "var(--color-accent)" }}>2D hentai catalogue</Link>{" "}
              keeps every short and medium clip, the{" "}
              <Link href="/3d" style={{ color: "var(--color-accent)" }}>3D vertical</Link>{" "}
              has the SFM and Blender library, and the{" "}
              <Link href="/feed" style={{ color: "var(--color-accent)" }}>Shorts feed</Link>{" "}
              loops 30-second clips TikTok-style.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
