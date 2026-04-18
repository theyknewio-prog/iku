/**
 * /preview/v2 — "Twitch / Gaming" variant.
 *
 * Inspiration: Twitch + Iwara + rule34video filter sidebar. Left
 * sidebar with followed creators + game categories. Main feed focused
 * on "Live Trending" at top (simulated with highest-score videos).
 * Purple accents (Twitch-style). Dense grid.
 */

import Link from "next/link";
import Image from "next/image";
import { getVideos } from "@/lib/content";
import pool from "@/lib/db";
import { buildTitle } from "@/lib/video-display";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDur(s: number | null) {
  if (!s) return "LIVE";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

async function getTopGames() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT copy AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(copyrights) AS copy FROM videos WHERE array_length(copyrights,1) > 0) t
     WHERE copy <> '' AND copy <> 'original'
     GROUP BY copy ORDER BY count DESC LIMIT 12`,
  );
  return rows;
}

async function getTopChars() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT ch AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(characters) AS ch FROM videos WHERE array_length(characters,1) > 0) t
     WHERE ch <> ''
     GROUP BY ch ORDER BY count DESC LIMIT 10`,
  );
  return rows;
}

function formatName(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/:/g, "")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const SIDEBAR_W = 260;
const PURPLE = "#9147ff";

export default async function V2() {
  const [trending, top, newest, games, chars] = await Promise.all([
    getVideos({
      limit: 24,
      order: "score",
      source: "all",
      requireThumbnail: true,
    }),
    getVideos({
      limit: 12,
      order: "favcount",
      source: "all",
      requireThumbnail: true,
    }),
    getVideos({
      limit: 18,
      order: "date",
      source: "all",
      requireThumbnail: true,
    }),
    getTopGames(),
    getTopChars(),
  ]);

  const [liveFeatured, ...feed] = trending.data;

  return (
    <main
      style={{
        background: "#0e0e10",
        minHeight: "100dvh",
        color: "#efeff1",
        fontFamily: "var(--font-sans)",
        display: "flex",
      }}
    >
      {/* ── LEFT SIDEBAR (Twitch style) ──────────────────────── */}
      <aside
        style={{
          width: SIDEBAR_W,
          background: "#1f1f23",
          borderRight: "1px solid rgba(255,255,255,0.04)",
          padding: "18px 12px",
          position: "sticky",
          top: 0,
          height: "100dvh",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <Link
          href="/preview/v2"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            padding: "6px 12px",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: PURPLE,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
            }}
          >
            iku
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#efeff1" }}>
            iku.tv
          </span>
        </Link>

        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#adadb8",
              padding: "0 12px 8px",
            }}
          >
            🎮 Top Games
          </div>
          {games.slice(0, 8).map((g) => (
            <Link
              key={g.name}
              href={`/series/${encodeURIComponent(g.name)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                borderRadius: 4,
                textDecoration: "none",
                color: "#efeff1",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 42,
                  borderRadius: 4,
                  background:
                    "linear-gradient(135deg, " + PURPLE + " 0%, #e8467c 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                🎮
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {formatName(g.name)}
                </div>
                <div style={{ fontSize: 11, color: "#adadb8" }}>
                  {formatViews(g.count)} videos
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#adadb8",
              padding: "0 12px 8px",
            }}
          >
            👤 Recommended Characters
          </div>
          {chars.slice(0, 8).map((c) => (
            <Link
              key={c.name}
              href={`/character/${encodeURIComponent(c.name)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                borderRadius: 4,
                textDecoration: "none",
                color: "#efeff1",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #e8467c, " + PURPLE + ")",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                🌸
                <span
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#00f598",
                    border: "2px solid #1f1f23",
                  }}
                />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {formatName(c.name)}
                </div>
                <div style={{ fontSize: 11, color: "#00f598" }}>
                  LIVE · {formatViews(c.count)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* TOPBAR */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background: "#18181b",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <nav style={{ display: "flex", gap: 22 }}>
            {[
              { label: "Home", href: "/preview/v2" },
              { label: "Hentai", href: "/hentai" },
              { label: "3D", href: "/3d" },
              { label: "Shorts", href: "/feed" },
              { label: "Browse", href: "/explore" },
            ].map((n) => (
              <Link
                key={n.label}
                href={n.href}
                style={{
                  color: "#efeff1",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: 4,
                }}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div style={{ flex: 1, maxWidth: 520, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "#0e0e10",
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ color: "#adadb8", fontSize: 14 }}>🔍</span>
              <span style={{ color: "#adadb8", fontSize: 13 }}>Search</span>
            </div>
          </div>

          <Link
            href="/pricing"
            style={{
              background: PURPLE,
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Subscribe
          </Link>
          <Link
            href="/login"
            style={{
              background: "transparent",
              color: "#efeff1",
              padding: "8px 16px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Log In
          </Link>
        </header>

        <div style={{ padding: "24px" }}>
          {/* FEATURED — "Live Now" */}
          {liveFeatured && (
            <section style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 4,
                    background: "#eb0400",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      background: "#fff",
                      borderRadius: "50%",
                    }}
                  />{" "}
                  Live
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                  Featured Trending
                </h2>
              </div>

              <Link
                href={`/watch/${liveFeatured.slug}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: 20,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "16/9",
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "#000",
                  }}
                >
                  {liveFeatured.thumbnail && (
                    <Image
                      src={liveFeatured.thumbnail}
                      alt=""
                      fill
                      unoptimized
                      style={{ objectFit: "cover" }}
                    />
                  )}
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      top: 12,
                      padding: "3px 8px",
                      background: "#eb0400",
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 3,
                      color: "#fff",
                      letterSpacing: "0.06em",
                    }}
                  >
                    LIVE
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 12,
                      padding: "3px 8px",
                      background: "rgba(0,0,0,0.85)",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 3,
                    }}
                  >
                    {formatViews(liveFeatured.score)} viewers
                  </span>
                </div>
                <div style={{ padding: "8px 0" }}>
                  <h3
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      marginBottom: 10,
                      lineHeight: 1.2,
                    }}
                  >
                    {buildTitle(liveFeatured)}
                  </h3>
                  <div
                    style={{
                      color: PURPLE,
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 16,
                    }}
                  >
                    {liveFeatured.copyrights[0]
                      ? formatName(liveFeatured.copyrights[0])
                      : "iku"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {liveFeatured.tags.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        style={{
                          padding: "4px 10px",
                          background: "#2d2d30",
                          borderRadius: 4,
                          fontSize: 11,
                          color: "#adadb8",
                        }}
                      >
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* RECOMMENDED FOR YOU — Twitch-style grid */}
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 14px" }}>
              Recommended For You
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 18,
              }}
            >
              {feed.slice(0, 12).map((v) => (
                <Link
                  key={v.id}
                  href={`/watch/${v.slug}`}
                  style={{
                    textDecoration: "none",
                    color: "#efeff1",
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "16/9",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#000",
                    }}
                  >
                    {v.thumbnail && (
                      <Image
                        src={v.thumbnail}
                        alt=""
                        fill
                        unoptimized
                        style={{ objectFit: "cover" }}
                      />
                    )}
                    <span
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 8,
                        padding: "2px 6px",
                        background: "#eb0400",
                        fontSize: 10,
                        fontWeight: 800,
                        borderRadius: 2,
                        color: "#fff",
                      }}
                    >
                      LIVE
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        left: 8,
                        bottom: 8,
                        padding: "2px 6px",
                        background: "rgba(0,0,0,0.78)",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 2,
                      }}
                    >
                      {formatViews(v.score)} viewers
                    </span>
                    {v.duration && (
                      <span
                        style={{
                          position: "absolute",
                          right: 8,
                          bottom: 8,
                          padding: "2px 6px",
                          background: "rgba(0,0,0,0.78)",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 2,
                        }}
                      >
                        {formatDur(v.duration)}
                      </span>
                    )}
                  </div>
                  <div
                    style={{ padding: "10px 0 2px", display: "flex", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background:
                          "linear-gradient(135deg, " + PURPLE + ", #e8467c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                      }}
                    >
                      {(v.characters[0] || "a").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {buildTitle(v)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: PURPLE,
                          fontWeight: 500,
                          marginTop: 2,
                        }}
                      >
                        {v.characters[0] ? formatName(v.characters[0]) : "iku"}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#adadb8", marginTop: 1 }}
                      >
                        {v.copyrights[0]
                          ? formatName(v.copyrights[0])
                          : "Original"}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* CATEGORIES STRIP */}
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 14px" }}>
              Browse Categories
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {games.map((g) => (
                <Link
                  key={g.name}
                  href={`/series/${encodeURIComponent(g.name)}`}
                  style={{
                    display: "block",
                    padding: 16,
                    borderRadius: 6,
                    background:
                      "linear-gradient(135deg, #1f1f23 0%, #3d1a52 100%)",
                    color: "#efeff1",
                    textDecoration: "none",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>🎮</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {formatName(g.name)}
                  </div>
                  <div style={{ fontSize: 11, color: PURPLE, fontWeight: 600 }}>
                    {formatViews(g.count)} clips
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* LATEST UPLOADS — Twitch sidebar recent */}
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 14px" }}>
              Recent Uploads
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              {newest.data.slice(0, 12).map((v) => (
                <Link
                  key={v.id}
                  href={`/watch/${v.slug}`}
                  style={{
                    textDecoration: "none",
                    color: "#efeff1",
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "16/9",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#000",
                    }}
                  >
                    {v.thumbnail && (
                      <Image
                        src={v.thumbnail}
                        alt=""
                        fill
                        unoptimized
                        style={{ objectFit: "cover" }}
                      />
                    )}
                    {v.duration && (
                      <span
                        style={{
                          position: "absolute",
                          right: 6,
                          bottom: 6,
                          padding: "2px 6px",
                          background: "rgba(0,0,0,0.78)",
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 2,
                        }}
                      >
                        {formatDur(v.duration)}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "8px 0 2px",
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {buildTitle(v)}
                  </div>
                  <div style={{ fontSize: 11, color: "#adadb8" }}>
                    {formatViews(v.score)} views
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
