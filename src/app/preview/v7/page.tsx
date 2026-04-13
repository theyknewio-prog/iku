/**
 * /preview/v7 — "Anime Streaming" variant.
 *
 * Inspiration: Crunchyroll + MangaDex + Bilibili + hanime.tv. Premium
 * anime streaming aesthetic. Episode-first, series-centric, dark
 * purple/orange. Continue Watching row. Seasonal releases sidebar.
 *
 * This reframes iku.gg hentai/3D videos as "episodes" of "series".
 * It's a natural fit — we already have `/series/[slug]` and characters.
 *
 * Key patterns stolen:
 * - Crunchyroll: dark with orange accent, "Continue Watching" row
 *   with progress bars baked in, episode numbers.
 * - MangaDex: reading progress, bookmarks, chapter lists.
 * - hanime.tv: the only legitimate anime-adult crossover at scale —
 *   poster-style cards, season badges, simulcast schedule.
 * - Netflix mega-dropdown for genre nav.
 */

import Link from "next/link";
import Image from "next/image";
import { getVideos, getCuratedGenreCounts } from "@/lib/content";
import pool from "@/lib/db";
import { buildTitle } from "@/lib/video-display";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtName(raw: string) {
  return raw.replace(/_/g, " ").replace(/:/g, "").trim()
    .split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function getSeries() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT co AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(copyrights) AS co FROM videos WHERE array_length(copyrights,1) > 0) t
     WHERE co <> ''
     GROUP BY co ORDER BY count DESC LIMIT 12`
  );
  return rows;
}

export default async function V7() {
  const [hero, continueW, newEps, topSeries, series, genres] = await Promise.all([
    getVideos({ limit: 1, order: "score", source: "all", requireThumbnail: true }),
    getVideos({ limit: 6, order: "date", source: "all", requireThumbnail: true }),
    getVideos({ limit: 12, order: "date", source: "all", requireThumbnail: true }),
    getVideos({ limit: 10, order: "score", vertical: "hentai", requireThumbnail: true }),
    getSeries(),
    getCuratedGenreCounts(),
  ]);

  const featured = hero.data[0];

  return (
    <main style={{
      background: "#0b0f1a", minHeight: "100dvh",
      color: "#fff", fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* ── HEADER ────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(11,15,26,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 32px", gap: 32 }}>
          <Link href="/preview/v7" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span style={{
              fontSize: 22, fontWeight: 900, color: "#ff7a00",
              letterSpacing: "-0.03em", fontFamily: "'Poppins', sans-serif",
            }}>
              iku
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Anime
            </span>
          </Link>

          <nav style={{ display: "flex", gap: 24 }}>
            {[
              { label: "Home", href: "/preview/v7", active: true },
              { label: "Popular", href: "/trending" },
              { label: "Simulcasts", href: "/new" },
              { label: "Series", href: "/series" },
              { label: "Genres", href: "/tags", caret: true },
              { label: "Manga", href: "/3d" },
              { label: "My List", href: "/favorites" },
            ].map((n) => (
              <Link key={n.label} href={n.href} style={{
                fontSize: 13, fontWeight: n.active ? 700 : 500,
                color: n.active ? "#fff" : "rgba(255,255,255,0.7)",
                textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
              }}>
                {n.label}
                {n.caret && <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>}
              </Link>
            ))}
          </nav>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            <input placeholder="Search anime, characters..." style={{
              padding: "7px 14px 7px 32px", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999,
              color: "#fff", fontSize: 12, outline: "none", width: 220,
              backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 fill=%22%23888%22><circle cx=%226%22 cy=%226%22 r=%224%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22/><line x1=%229%22 y1=%229%22 x2=%2213%22 y2=%2213%22 stroke=%22%23888%22 stroke-width=%222%22/></svg>')",
              backgroundRepeat: "no-repeat", backgroundPosition: "10px center",
            }} />
            <Link href="/pricing" style={{
              background: "#ff7a00", color: "#000", padding: "7px 18px", borderRadius: 999,
              fontSize: 12, fontWeight: 800, textDecoration: "none",
            }}>
              Try Premium
            </Link>
            <Link href="/login" style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", padding: "7px 18px", borderRadius: 999,
              fontSize: 12, fontWeight: 600, textDecoration: "none",
            }}>
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────── */}
      {featured && (
        <section style={{ position: "relative", height: 560, overflow: "hidden" }}>
          {featured.thumbnail && (
            <Image src={featured.thumbnail} alt="" fill unoptimized
              style={{ objectFit: "cover", opacity: 0.62, filter: "brightness(0.6)" }} />
          )}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(11,15,26,0) 20%, rgba(11,15,26,0.9) 85%, #0b0f1a 100%), linear-gradient(90deg, rgba(11,15,26,0.88) 0%, rgba(11,15,26,0) 55%)",
          }} />
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            padding: "0 32px", zIndex: 2,
          }}>
            <div style={{ maxWidth: 580 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(255,122,0,0.15)", border: "1px solid rgba(255,122,0,0.4)",
                padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                color: "#ffb370", letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: 18,
              }}>
                🔥 Simulcast · Spring 2026
              </div>
              <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 14, fontFamily: "'Poppins', sans-serif" }}>
                {featured.copyrights[0] ? fmtName(featured.copyrights[0]) : buildTitle(featured).slice(0, 48)}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>
                <span style={{ color: "#ff7a00", fontWeight: 800 }}>★ 4.8</span>
                <span>·</span>
                <span>24 episodes</span>
                <span>·</span>
                <span style={{ padding: "2px 6px", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>18+</span>
                <span>·</span>
                <span>Action · Ecchi · Fantasy</span>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.82)", marginBottom: 26 }}>
                {buildTitle(featured)}. {fmtViews(featured.score)} total watches. New episode every Thursday.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <Link href={`/watch/${featured.slug}`} style={{
                  background: "#ff7a00", color: "#000", padding: "13px 28px", borderRadius: 999,
                  fontSize: 14, fontWeight: 800, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  ▶ Start Watching
                </Link>
                <Link href="/favorites" style={{
                  background: "rgba(255,255,255,0.1)", color: "#fff", padding: "13px 24px", borderRadius: 999,
                  fontSize: 14, fontWeight: 700, textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}>
                  + Add to List
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CONTINUE WATCHING ─────────────────────────────────── */}
      <section style={{ padding: "36px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>
            Continue Watching
          </h2>
          <Link href="/history" style={{ marginLeft: "auto", fontSize: 12, color: "#ff7a00", textDecoration: "none", fontWeight: 600 }}>
            View all →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {continueW.data.map((v, i) => {
            const progress = 20 + ((v.id * 7) % 70);
            return (
              <Link key={v.id} href={`/watch/${v.slug}`} style={{ textDecoration: "none", color: "#fff" }}>
                <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "#000", marginBottom: 8 }}>
                  {v.thumbnail && <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.85))" }} />
                  <div style={{
                    position: "absolute", top: 8, left: 8,
                    background: "rgba(0,0,0,0.78)", padding: "3px 8px", borderRadius: 4,
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                  }}>
                    EP {(i % 12) + 1}
                  </div>
                  <div style={{
                    position: "absolute", left: 0, right: 0, bottom: 0, height: 4,
                    background: "rgba(255,255,255,0.25)",
                  }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: "#ff7a00" }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {v.copyrights[0] ? fmtName(v.copyrights[0]) : buildTitle(v).slice(0, 40)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  Episode {(i % 12) + 1} · {progress}% watched
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── TOP HENTAI SERIES (poster cards) ──────────────────── */}
      <section style={{ padding: "40px 32px 0" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
          🔥 Top Hentai Series This Season
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
          {topSeries.data.map((v, i) => (
            <Link key={v.id} href={`/watch/${v.slug}`} style={{ textDecoration: "none", color: "#fff" }}>
              <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: "#000", marginBottom: 8 }}>
                {v.thumbnail && <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />}
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  background: i < 3 ? "#ff7a00" : "rgba(0,0,0,0.75)",
                  color: i < 3 ? "#000" : "#fff",
                  padding: "3px 8px", borderRadius: 3, fontSize: 10, fontWeight: 900,
                }}>
                  #{i + 1}
                </div>
                <div style={{
                  position: "absolute", bottom: 6, left: 6,
                  background: "rgba(0,0,0,0.78)", padding: "2px 7px", borderRadius: 3,
                  fontSize: 9, fontWeight: 700, color: "#ff7a00",
                }}>
                  ★ {(4.0 + ((v.score % 100) / 100)).toFixed(1)}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {v.copyrights[0] ? fmtName(v.copyrights[0]) : buildTitle(v).slice(0, 32)}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {(v.tags[0] || "hentai").replace(/_/g, " ")} · {Math.floor(v.score / 500) + 12} eps
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── GENRES ────────────────────────────────────────────── */}
      <section style={{ padding: "40px 32px 0" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Browse by genre</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {genres.slice(0, 8).map((g) => (
            <Link key={g.name} href={`/tag/${encodeURIComponent(g.name)}`} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              padding: "14px 16px", borderRadius: 8, textDecoration: "none", color: "#fff",
            }}>
              <span style={{ fontSize: 24 }}>{g.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name.replace(/_/g, " ")}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{fmtViews(g.count)} episodes</div>
              </div>
              <span style={{ color: "#ff7a00", fontSize: 16 }}>→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── NEW EPISODES ──────────────────────────────────────── */}
      <section style={{ padding: "40px 32px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>📺 New episodes</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {newEps.data.map((v, i) => (
            <Link key={v.id} href={`/watch/${v.slug}`} style={{ textDecoration: "none", color: "#fff", display: "flex", gap: 10 }}>
              <div style={{ position: "relative", width: 140, aspectRatio: "16/9", borderRadius: 6, overflow: "hidden", background: "#000", flexShrink: 0 }}>
                {v.thumbnail && <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />}
                <span style={{
                  position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.85)",
                  fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 2,
                }}>
                  NEW
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0, padding: "2px 0" }}>
                <div style={{ fontSize: 10, color: "#ff7a00", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 2 }}>
                  EP {(i % 12) + 1} · JUST ADDED
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {buildTitle(v)}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                  {fmtViews(v.score)} views
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 36, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {series.map((s) => (
            <Link key={s.name} href={`/series/${encodeURIComponent(s.name)}`} style={{
              padding: "6px 14px", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999,
              fontSize: 12, color: "rgba(255,255,255,0.85)", textDecoration: "none",
            }}>
              {fmtName(s.name)} <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>{s.count}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
