/**
 * /preview/v3 — "RedGIFs / TikTok" variant.
 *
 * Inspiration: Redgifs desktop + TikTok For You. Portrait video
 * player centered on desktop (not a grid-first experience). For You
 * / Trending tabs above. Minimal left icon nav. Right sidebar with
 * recommended creators + similar clips. Fullscreen-feels.
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

async function getTopChars() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT ch AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(characters) AS ch FROM videos WHERE array_length(characters,1) > 0) t
     WHERE ch <> ''
     GROUP BY ch ORDER BY count DESC LIMIT 6`,
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

export default async function V3() {
  const [trending, chars] = await Promise.all([
    getVideos({
      limit: 6,
      order: "score",
      source: "all",
      requireThumbnail: true,
    }),
    getTopChars(),
  ]);

  const [featured, ...nextUp] = trending.data;

  return (
    <main
      style={{
        background: "#000",
        minHeight: "100dvh",
        color: "#fff",
        fontFamily: "var(--font-sans)",
        display: "flex",
      }}
    >
      {/* ── LEFT ICON NAV ────────────────────────────────────── */}
      <nav
        style={{
          width: 80,
          background: "#0a0a0a",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          padding: "20px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          position: "sticky",
          top: 0,
          height: "100dvh",
          flexShrink: 0,
        }}
      >
        <Link
          href="/preview/v3"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "linear-gradient(135deg, #eb0400 0%, #8b0000 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 900,
            color: "#fff",
            textDecoration: "none",
            marginBottom: 18,
          }}
        >
          iku
        </Link>

        {[
          { icon: "🏠", label: "Home", href: "/preview/v3", active: true },
          { icon: "🔍", label: "Explore", href: "/explore" },
          { icon: "🌸", label: "Hentai", href: "/hentai" },
          { icon: "🎮", label: "3D", href: "/3d" },
          { icon: "⚡", label: "Shorts", href: "/feed" },
          { icon: "👤", label: "Creators", href: "/character" },
          { icon: "🏷️", label: "Niches", href: "/tags" },
          { icon: "❤️", label: "My List", href: "/favorites" },
        ].map((n) => (
          <Link
            key={n.label}
            href={n.href}
            title={n.label}
            style={{
              width: 56,
              padding: "10px 0",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              textDecoration: "none",
              color: n.active ? "#fff" : "rgba(255,255,255,0.6)",
              background: n.active ? "rgba(235,4,0,0.15)" : "transparent",
            }}
          >
            <span style={{ fontSize: 22 }}>{n.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{n.label}</span>
          </Link>
        ))}

        <div
          style={{
            marginTop: "auto",
            padding: "12px 0",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Link
            href="/login"
            title="Sign in"
            style={{
              width: 56,
              padding: "10px 0",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 22 }}>👤</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>Sign In</span>
          </Link>
        </div>
      </nav>

      {/* ── CENTER (FOR YOU player area) ─────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 24px",
        }}
      >
        {/* TOP BAR — tabs */}
        <div
          style={{
            display: "flex",
            gap: 28,
            padding: "6px 0 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 20,
            width: "100%",
            maxWidth: 540,
            justifyContent: "center",
          }}
        >
          <button
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.55)",
              fontSize: 16,
              fontWeight: 600,
              padding: "8px 0",
              cursor: "pointer",
            }}
          >
            For You
          </button>
          <button
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
              padding: "8px 0",
              cursor: "pointer",
              borderBottom: "3px solid #eb0400",
              marginBottom: "-3px",
            }}
          >
            Trending
          </button>
          <button
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.55)",
              fontSize: 16,
              fontWeight: 600,
              padding: "8px 0",
              cursor: "pointer",
            }}
          >
            Live
          </button>
        </div>

        {/* PORTRAIT PLAYER */}
        {featured && (
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              position: "relative",
              borderRadius: 14,
              overflow: "hidden",
              background: "#000",
              aspectRatio: "9/16",
            }}
          >
            {featured.thumbnail && (
              <Image
                src={featured.thumbnail}
                alt=""
                fill
                unoptimized
                style={{ objectFit: "cover" }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)",
              }}
            />

            {/* Right action rail (like TikTok/Redgifs) */}
            <div
              style={{
                position: "absolute",
                right: 10,
                bottom: 80,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                alignItems: "center",
              }}
            >
              {[
                { icon: "👁", label: formatViews(featured.score) },
                { icon: "❤", label: formatViews(featured.favorites) },
                { icon: "💬", label: "318" },
                { icon: "↗", label: "Share" },
                { icon: "🔇", label: "Mute" },
              ].map((a) => (
                <div
                  key={a.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(8px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      color: "#fff",
                    }}
                  >
                    {a.icon}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    {a.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom creator info */}
            <Link
              href={`/watch/${featured.slug}`}
              style={{
                position: "absolute",
                left: 14,
                right: 70,
                bottom: 14,
                color: "#fff",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #eb0400, #8b0000)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                  }}
                >
                  🌸
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>
                    {featured.characters[0]
                      ? formatName(featured.characters[0])
                      : "iku.gg"}
                    <span style={{ color: "#00e4ff", marginLeft: 6 }}>✓</span>
                  </div>
                  <div
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.72)" }}
                  >
                    {featured.copyrights[0]
                      ? formatName(featured.copyrights[0])
                      : ""}
                  </div>
                </div>
                <button
                  style={{
                    marginLeft: "auto",
                    padding: "6px 14px",
                    borderRadius: 4,
                    background: "#eb0400",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Follow
                </button>
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.45,
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}
              >
                {buildTitle(featured).slice(0, 120)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.72)",
                  marginTop: 6,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {featured.tags.slice(0, 4).map((t) => (
                  <span key={t}>#{t.replace(/_/g, "")}</span>
                ))}
              </div>
            </Link>

            {/* Progress bar */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 3,
                background: "rgba(255,255,255,0.18)",
              }}
            >
              <div
                style={{ width: "34%", height: "100%", background: "#eb0400" }}
              />
            </div>
          </div>
        )}

        {/* Vertical scroll hint */}
        <div
          style={{
            marginTop: 14,
            color: "rgba(255,255,255,0.35)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>↑</span>
          <span>Swipe up for next</span>
          <span>↓</span>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ────────────────────────────────────── */}
      <aside
        style={{
          width: 340,
          background: "#0a0a0a",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          padding: "20px 18px",
          overflowY: "auto",
          height: "100dvh",
          position: "sticky",
          top: 0,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <input
            placeholder="Search Creators"
            style={{
              flex: 1,
              padding: "9px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: 13,
              outline: "none",
            }}
          />
          <Link
            href="/pricing"
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              background: "#eb0400",
              color: "#fff",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            ✨ Go Pro
          </Link>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 14,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Creators you might enjoy
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {chars.slice(0, 4).map((c) => (
              <div
                key={c.name}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #eb0400, #8b0000)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  🌸
                  <span
                    style={{
                      position: "absolute",
                      right: -2,
                      bottom: -2,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#00e4ff",
                      border: "3px solid #0a0a0a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#000",
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
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
                    {formatName(c.name)}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}
                  >
                    {formatViews(c.count)} videos
                  </div>
                </div>
                <Link
                  href={`/character/${encodeURIComponent(c.name)}`}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Visit
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 14,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Up next
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nextUp.map((v) => (
              <Link
                key={v.id}
                href={`/watch/${v.slug}`}
                style={{
                  display: "flex",
                  gap: 10,
                  textDecoration: "none",
                  color: "#fff",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 110,
                    aspectRatio: "9/16",
                    borderRadius: 6,
                    overflow: "hidden",
                    flexShrink: 0,
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
                </div>
                <div style={{ minWidth: 0, flex: 1, padding: "4px 0" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {buildTitle(v)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.45)",
                      marginTop: 4,
                    }}
                  >
                    {formatViews(v.score)} views
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
