/**
 * /preview/v4 — "PimpBunny / Neon Casino" variant.
 *
 * Inspiration: Vegas casino signage + Bratz-era web aesthetic +
 * Hentaipros bunny mascot. Neon pink/purple/gold explosion, glitter,
 * animated sparkles, 🐰 everywhere, gaudy fun. Not minimalist. This
 * is the "coup de coeur" weird variant.
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

async function getTopGames() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT copy AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(copyrights) AS copy FROM videos WHERE array_length(copyrights,1) > 0) t
     WHERE copy <> '' AND copy <> 'original'
     GROUP BY copy ORDER BY count DESC LIMIT 8`,
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

export default async function V4() {
  const [trending, topRated, newest, games] = await Promise.all([
    getVideos({
      limit: 8,
      order: "score",
      source: "all",
      requireThumbnail: true,
    }),
    getVideos({
      limit: 8,
      order: "favcount",
      source: "all",
      requireThumbnail: true,
    }),
    getVideos({
      limit: 12,
      order: "date",
      source: "all",
      requireThumbnail: true,
    }),
    getTopGames(),
  ]);

  const [featured, ...rest] = trending.data;

  return (
    <main
      style={{
        background: `
        radial-gradient(ellipse at top left, rgba(255,0,110,0.25) 0%, transparent 55%),
        radial-gradient(ellipse at top right, rgba(131,56,236,0.25) 0%, transparent 55%),
        radial-gradient(ellipse at bottom, rgba(255,190,11,0.18) 0%, transparent 60%),
        #0b0316
      `,
        minHeight: "100dvh",
        color: "#fff",
        fontFamily: "'Nunito', var(--font-sans)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Sparkles overlay ─────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          backgroundImage: `
          radial-gradient(2px 2px at 10% 20%, #ffbe0b, transparent),
          radial-gradient(2px 2px at 30% 60%, #ff006e, transparent),
          radial-gradient(3px 3px at 70% 10%, #8338ec, transparent),
          radial-gradient(1.5px 1.5px at 85% 40%, #ffbe0b, transparent),
          radial-gradient(2px 2px at 50% 85%, #ff006e, transparent),
          radial-gradient(2px 2px at 15% 90%, #8338ec, transparent),
          radial-gradient(2px 2px at 95% 75%, #ffbe0b, transparent)
        `,
          backgroundSize: "100% 100%",
          opacity: 0.7,
        }}
      />

      {/* ── HEADER ───────────────────────────────────────── */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "rgba(11,3,22,0.5)",
          backdropFilter: "blur(12px)",
          borderBottom: "2px solid rgba(255,0,110,0.35)",
        }}
      >
        <Link
          href="/preview/v4"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontSize: 36,
              lineHeight: 1,
              filter: "drop-shadow(0 0 8px rgba(255,0,110,0.8))",
            }}
          >
            🐰
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              background:
                "linear-gradient(135deg, #ff006e 0%, #ffbe0b 50%, #8338ec 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 20px rgba(255,0,110,0.35)",
            }}
          >
            iku.club
          </span>
        </Link>

        <nav
          style={{
            display: "flex",
            gap: 6,
            marginLeft: 20,
            flex: 1,
            overflowX: "auto",
          }}
        >
          {[
            { emoji: "🎲", label: "Lucky" },
            { emoji: "🌸", label: "Hentai", href: "/hentai" },
            { emoji: "🎮", label: "3D", href: "/3d" },
            { emoji: "⚡", label: "Shorts", href: "/feed" },
            { emoji: "🔥", label: "Trending", href: "/trending" },
            { emoji: "💎", label: "VIP", href: "/pricing" },
            { emoji: "🏆", label: "Leaderboard" },
          ].map((n, i) => (
            <Link
              key={n.label}
              href={n.href ?? "#"}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                background:
                  i === 0
                    ? "linear-gradient(135deg, #ff006e 0%, #8338ec 100%)"
                    : "rgba(255,255,255,0.06)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                border:
                  "1px solid " +
                  (i === 0
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.08)"),
                boxShadow: i === 0 ? "0 0 20px rgba(255,0,110,0.55)" : "none",
              }}
            >
              <span>{n.emoji}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            placeholder="🔎 Search..."
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              width: 220,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,0,110,0.4)",
              color: "#fff",
              outline: "none",
              fontSize: 13,
            }}
          />
          <Link
            href="/pricing"
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #ffbe0b 0%, #ff006e 100%)",
              color: "#1a0312",
              fontSize: 14,
              fontWeight: 900,
              textDecoration: "none",
              letterSpacing: "0.02em",
              boxShadow: "0 4px 20px rgba(255,190,11,0.5)",
              border: "2px solid rgba(255,255,255,0.25)",
              animation: "pulse 2s infinite",
            }}
          >
            💎 GO VIP
          </Link>
        </div>
      </header>

      {/* ── JACKPOT HERO ─────────────────────────────────── */}
      {featured && (
        <section
          style={{
            position: "relative",
            zIndex: 5,
            padding: "32px 28px 24px",
          }}
        >
          <div
            style={{
              position: "relative",
              borderRadius: 24,
              overflow: "hidden",
              background:
                "linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a0ca3 100%)",
              padding: "4px",
              boxShadow:
                "0 0 60px rgba(255,0,110,0.45), 0 0 120px rgba(131,56,236,0.35)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 1fr",
                gap: 20,
                padding: 22,
                borderRadius: 20,
                background: "rgba(11,3,22,0.78)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Link
                href={`/watch/${featured.slug}`}
                style={{
                  position: "relative",
                  aspectRatio: "16/10",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#000",
                  textDecoration: "none",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
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
                      "linear-gradient(135deg, rgba(255,0,110,0.15), rgba(131,56,236,0.15))",
                    mixBlendMode: "overlay",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    padding: "4px 12px",
                    borderRadius: 999,
                    background:
                      "linear-gradient(135deg, #ffbe0b 0%, #ff006e 100%)",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#1a0312",
                    boxShadow: "0 0 16px rgba(255,190,11,0.6)",
                  }}
                >
                  🎰 Jackpot
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 14,
                    right: 14,
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.78)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ▶ {formatViews(featured.score)}
                </div>
              </Link>

              <div
                style={{
                  padding: "8px 6px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    background: "rgba(255,190,11,0.18)",
                    borderRadius: 999,
                    alignSelf: "flex-start",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#ffbe0b",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(255,190,11,0.35)",
                    marginBottom: 14,
                  }}
                >
                  🎁 Today&apos;s pick
                </div>

                <h1
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    marginBottom: 12,
                    background:
                      "linear-gradient(135deg, #fff 0%, #ffbe0b 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {buildTitle(featured)}
                </h1>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,0.8)",
                    marginBottom: 18,
                  }}
                >
                  🐰 <strong>360,000+ clips</strong> of hentai, 3D cartoon porn,
                  SFM compilations & TikTok shorts. Nothing to install, nothing
                  to pay. Spin the wheel and find your obsession.
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link
                    href={`/watch/${featured.slug}`}
                    style={{
                      padding: "14px 24px",
                      borderRadius: 999,
                      background:
                        "linear-gradient(135deg, #ff006e 0%, #8338ec 100%)",
                      color: "#fff",
                      fontWeight: 900,
                      fontSize: 14,
                      textDecoration: "none",
                      boxShadow: "0 6px 24px rgba(255,0,110,0.55)",
                      border: "2px solid rgba(255,255,255,0.2)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    ▶ Play Now
                  </Link>
                  <Link
                    href="/feed"
                    style={{
                      padding: "14px 22px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 14,
                      textDecoration: "none",
                      border: "2px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    🎲 Spin Another
                  </Link>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginTop: 22,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  <span>
                    <span style={{ color: "#ffbe0b" }}>★★★★★</span> 4.9
                  </span>
                  <span>🔥 {formatViews(featured.score)} views</span>
                  <span>❤ {formatViews(featured.favorites)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── HOT RIGHT NOW row ──────────────────────────── */}
      <section
        style={{ position: "relative", zIndex: 5, padding: "8px 28px 32px" }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "linear-gradient(135deg, #ff006e 0%, #ffbe0b 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          🔥 Hot right now — 💯
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {rest.map((v, i) => (
            <Link
              key={v.id}
              href={`/watch/${v.slug}`}
              style={{
                display: "block",
                borderRadius: 14,
                overflow: "hidden",
                background: "rgba(255,255,255,0.04)",
                textDecoration: "none",
                color: "#fff",
                border: "2px solid transparent",
                transition: "transform 200ms ease, border-color 200ms ease",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16/9",
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
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background:
                      i === 0
                        ? "linear-gradient(135deg, #ffbe0b, #ff006e)"
                        : "rgba(0,0,0,0.78)",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                    color: i === 0 ? "#1a0312" : "#fff",
                  }}
                >
                  {i === 0 ? "🏆 #1" : `#${i + 2}`}
                </div>
                {v.duration && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      padding: "3px 8px",
                      background: "rgba(0,0,0,0.78)",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {Math.floor(v.duration / 60)}:
                    {Math.floor(v.duration % 60)
                      .toString()
                      .padStart(2, "0")}
                  </span>
                )}
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {buildTitle(v)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                  <span style={{ color: "#ffbe0b" }}>★★★★★</span>
                  <span style={{ marginLeft: 6 }}>
                    {formatViews(v.score)} views
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── GAMES CASINO ──────────────────────────────── */}
      <section
        style={{ position: "relative", zIndex: 5, padding: "8px 28px 32px" }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
            background: "linear-gradient(135deg, #8338ec 0%, #ff006e 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          🎮 Bunny&apos;s arcade
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          {games.map((g, i) => {
            const grads = [
              "linear-gradient(135deg, #ff006e 0%, #ffbe0b 100%)",
              "linear-gradient(135deg, #8338ec 0%, #3a86ff 100%)",
              "linear-gradient(135deg, #ffbe0b 0%, #ff006e 100%)",
              "linear-gradient(135deg, #3a86ff 0%, #8338ec 100%)",
              "linear-gradient(135deg, #ff006e 0%, #8338ec 100%)",
              "linear-gradient(135deg, #8338ec 0%, #ffbe0b 100%)",
              "linear-gradient(135deg, #3a86ff 0%, #ff006e 100%)",
              "linear-gradient(135deg, #ffbe0b 0%, #8338ec 100%)",
            ];
            return (
              <Link
                key={g.name}
                href={`/series/${encodeURIComponent(g.name)}`}
                style={{
                  position: "relative",
                  padding: "20px 16px",
                  borderRadius: 16,
                  background: grads[i % grads.length],
                  color: "#fff",
                  textDecoration: "none",
                  minHeight: 100,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  border: "2px solid rgba(255,255,255,0.15)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: -10,
                    fontSize: 64,
                    opacity: 0.25,
                  }}
                >
                  🎰
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    marginBottom: 4,
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                >
                  {formatName(g.name)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>
                  🔥 {formatViews(g.count)} clips
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Top rated ─────────────────────────────────── */}
      <section
        style={{ position: "relative", zIndex: 5, padding: "8px 28px 32px" }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
            background: "linear-gradient(135deg, #ffbe0b 0%, #ff006e 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          💖 Bunny&apos;s favorites
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {topRated.data.map((v) => (
            <Link
              key={v.id}
              href={`/watch/${v.slug}`}
              style={{
                display: "block",
                borderRadius: 14,
                overflow: "hidden",
                background: "rgba(255,255,255,0.04)",
                textDecoration: "none",
                color: "#fff",
              }}
            >
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16/9",
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
                    top: 8,
                    right: 8,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #ff006e, #ffbe0b)",
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#1a0312",
                  }}
                >
                  💎 VIP
                </span>
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {buildTitle(v)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                  <span style={{ color: "#ffbe0b" }}>★★★★★</span>
                  <span style={{ marginLeft: 6 }}>
                    {formatViews(v.favorites)} ❤
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer
        style={{
          position: "relative",
          zIndex: 5,
          padding: "32px 28px 80px",
          textAlign: "center",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🐰💋💎</div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#ffbe0b",
            marginBottom: 4,
          }}
        >
          iku.club — the bunny&apos;s adult arcade
        </div>
        <div style={{ fontSize: 11 }}>
          © 2026 iku.gg — All models 18+ ·{" "}
          <Link href="/dmca" style={{ color: "#ff006e" }}>
            DMCA
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" style={{ color: "#ff006e" }}>
            Privacy
          </Link>
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </main>
  );
}
