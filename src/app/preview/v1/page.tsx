/**
 * /preview/v1 — "Cinematic" variant.
 *
 * Inspiration: Netflix + hanime.tv + Spankbang's hero + a touch of
 * Redgifs creator-first. Dark prestige aesthetic. Massive hero with
 * auto-playing featured trailer, minimal top nav, horizontal Netflix-
 * style carousels for every section. No sidebar.
 */

import Link from "next/link";
import Image from "next/image";
import { getVideos, getCuratedGenreCounts, getVideoOfTheDay } from "@/lib/content";
import { buildTitle } from "@/lib/video-display";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDur(s: number | null) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default async function V1() {
  const [trending, newest, topRated, favs, vod, genres] = await Promise.all([
    getVideos({ limit: 16, order: "score", source: "all", requireThumbnail: true }),
    getVideos({ limit: 16, order: "date", source: "all", requireThumbnail: true }),
    getVideos({ limit: 16, order: "score", vertical: "hentai", requireThumbnail: true }),
    getVideos({ limit: 16, order: "favcount", source: "all", requireThumbnail: true }),
    getVideoOfTheDay(),
    getCuratedGenreCounts(),
  ]);

  const hero = vod ?? trending.data[0];

  return (
    <main style={{ background: "#060309", minHeight: "100dvh", color: "#fff", fontFamily: "var(--font-sans)" }}>
      {/* ── FLOATING NAV ─────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        padding: "20px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(180deg, rgba(6,3,9,0.92) 0%, rgba(6,3,9,0) 100%)",
        backdropFilter: "blur(8px)",
      }}>
        <Link href="/preview/v1" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{
            width: 34, height: 34, borderRadius: 8,
            background: "linear-gradient(135deg, #ff006e 0%, #8338ec 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 15, color: "#fff",
          }}>
            iku
          </span>
          <span style={{ fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
            Cinema
          </span>
        </Link>

        <div style={{ display: "flex", gap: 28 }}>
          {[
            { label: "Home", href: "/preview/v1" },
            { label: "Hentai", href: "/hentai" },
            { label: "3D", href: "/3d" },
            { label: "Shorts", href: "/feed" },
            { label: "Series", href: "/series" },
            { label: "My List", href: "/favorites" },
          ].map((it) => (
            <Link key={it.label} href={it.href}
              style={{ color: "rgba(255,255,255,0.78)", fontSize: 14, fontWeight: 500, textDecoration: "none", letterSpacing: "0.01em" }}>
              {it.label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", padding: "8px 16px", borderRadius: 4, fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            Search
          </button>
          <Link href="/login" style={{
            background: "#e50914", color: "#fff", padding: "8px 22px", borderRadius: 4,
            textDecoration: "none", fontWeight: 700, fontSize: 13,
          }}>
            Sign In
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      {hero && (
        <section style={{
          position: "relative",
          minHeight: "88vh",
          display: "flex",
          alignItems: "flex-end",
          padding: "0 48px 100px",
          overflow: "hidden",
        }}>
          {hero.thumbnail && (
            <Image src={hero.thumbnail} alt="" fill unoptimized
              style={{ objectFit: "cover", opacity: 0.68, filter: "brightness(0.55)" }} />
          )}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(6,3,9,0) 30%, rgba(6,3,9,0.85) 80%, #060309 100%), linear-gradient(90deg, rgba(6,3,9,0.85) 0%, rgba(6,3,9,0) 60%)",
          }} />

          <div style={{ position: "relative", zIndex: 2, maxWidth: 620 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "4px 12px", borderRadius: 999, background: "rgba(255,0,110,0.18)",
              border: "1px solid rgba(255,0,110,0.4)", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", color: "#ff7aa8", marginBottom: 20,
            }}>
              ✨ Featured Today
            </div>
            <h1 style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.03em", marginBottom: 18 }}>
              {buildTitle(hero)}
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "rgba(255,255,255,0.82)", marginBottom: 28, maxWidth: 560 }}>
              The largest free hentai + 3D cartoon porn library. {formatViews(trending.data.reduce((a, v) => a + v.score, 0))}+ views this week. Stream instantly, no signup.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href={`/watch/${hero.slug}`} style={{
                background: "#fff", color: "#0a0a0a", padding: "14px 32px", borderRadius: 6,
                fontWeight: 800, fontSize: 15, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 10,
              }}>
                ▶ Watch Now
              </Link>
              <Link href="/hentai" style={{
                background: "rgba(255,255,255,0.22)", color: "#fff", padding: "14px 28px", borderRadius: 6,
                fontWeight: 700, fontSize: 15, textDecoration: "none",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                ℹ More Info
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── ROWS (Netflix style) ────────────────────────────── */}
      <div style={{ padding: "0 48px 80px", display: "flex", flexDirection: "column", gap: 56, marginTop: -80 }}>
        {[
          { title: "🔥 Trending This Week", data: trending.data },
          { title: "🆕 Just Added", data: newest.data },
          { title: "🌸 Top Rated Hentai (2D)", data: topRated.data },
          { title: "💖 Most Favorited", data: favs.data },
        ].map((row) => (
          <section key={row.title}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18, letterSpacing: "-0.01em" }}>
              {row.title}
            </h2>
            <div style={{
              display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory",
              paddingBottom: 12, marginLeft: -48, paddingLeft: 48, marginRight: -48, paddingRight: 48,
            }}>
              {row.data.map((video) => (
                <Link key={video.id} href={`/watch/${video.slug}`} style={{
                  flexShrink: 0, width: 320, position: "relative", scrollSnapAlign: "start",
                  textDecoration: "none", color: "#fff", borderRadius: 8, overflow: "hidden",
                  background: "#12091c", transition: "transform 220ms ease",
                }}>
                  <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
                    {video.thumbnail && (
                      <Image src={video.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />
                    )}
                    {video.duration && (
                      <span style={{
                        position: "absolute", right: 8, bottom: 8, zIndex: 2,
                        padding: "3px 7px", background: "rgba(0,0,0,0.85)",
                        fontSize: 11, fontWeight: 700, borderRadius: 3,
                      }}>
                        {formatDur(video.duration)}
                      </span>
                    )}
                    {video.width >= 1080 && (
                      <span style={{
                        position: "absolute", left: 8, bottom: 8, zIndex: 2,
                        padding: "3px 7px", background: "rgba(0,0,0,0.85)", color: "#4ade80",
                        fontSize: 10, fontWeight: 800, borderRadius: 3, letterSpacing: "0.04em",
                      }}>
                        {video.width >= 2160 ? "4K" : "HD"}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "10px 12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {buildTitle(video)}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                      <span style={{ color: "#ffd700" }}>★★★★★</span>
                      <span style={{ marginLeft: 6 }}>{formatViews(video.score)} views</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* ── Genre strip ─────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>🎭 Browse by Genre</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {genres.slice(0, 12).map((g) => (
              <Link key={g.name} href={`/tag/${encodeURIComponent(g.name)}`}
                style={{
                  padding: "18px 16px", borderRadius: 8,
                  background: "linear-gradient(135deg, rgba(255,0,110,0.15), rgba(131,56,236,0.15))",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#fff", textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                <span style={{ fontSize: 22 }}>{g.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name.replace(/_/g, " ")}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{formatViews(g.count)} videos</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer style={{
        padding: "40px 48px 80px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        fontSize: 12,
        color: "rgba(255,255,255,0.45)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginBottom: 28 }}>
            <Link href="/hentai" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}>Hentai 2D</Link>
            <Link href="/3d" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}>3D</Link>
            <Link href="/feed" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}>Shorts</Link>
            <Link href="/trending" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}>Trending</Link>
            <Link href="/character" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}>Characters</Link>
            <Link href="/series" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}>Series</Link>
            <Link href="/blog" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 13 }}>Blog</Link>
          </div>
          <p>© 2026 iku.gg — All models are 18+. A premium streaming experience.</p>
        </div>
      </footer>
    </main>
  );
}
