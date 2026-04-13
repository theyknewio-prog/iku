/**
 * /preview/v8 — "Algorithmic Feed" variant.
 *
 * Inspiration: YouTube 2026 home + TikTok web + Reddit new UI. Chip
 * filters at top, massive algorithmic grid below, creator attribution
 * under every thumb, chapter markers, "Shorts shelf" breaking up the
 * grid. This is what 20-something users actually expect from a
 * streaming product in 2026.
 *
 * Key patterns stolen:
 * - YouTube: chip row "All / Hentai / 3D / Genshin / Overwatch /
 *   Anime / Cosplay / Recently uploaded / Watched". Big thumbs
 *   2-3 per row on desktop, creator avatar + title + meta, 1-row
 *   shorts shelf inline, "Watch again" row for returning users.
 * - TikTok web: inline preview on hover.
 * - Reddit new: compact toggle, voting.
 */

import Link from "next/link";
import Image from "next/image";
import { getVideos } from "@/lib/content";
import { buildTitle } from "@/lib/video-display";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtDur(s: number | null) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function fmtName(raw: string) {
  return raw.replace(/_/g, " ").replace(/:/g, "").trim()
    .split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function timeAgo(d: Date) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export default async function V8() {
  const [{ data: main }, { data: shorts }] = await Promise.all([
    getVideos({ limit: 16, order: "score", source: "all", requireThumbnail: true }),
    getVideos({ limit: 8, order: "date", source: "all", requireThumbnail: true }),
  ]);

  const chips = [
    "All", "Hentai", "3D", "Genshin Impact", "Overwatch", "Blue Archive",
    "Honkai", "Cosplay", "Futanari", "Compilation", "SFM",
    "Uncensored", "Recently uploaded", "Watched",
  ];

  return (
    <main style={{
      background: "#0f0f0f", minHeight: "100dvh",
      color: "#fff", fontFamily: "'Roboto', 'Inter', sans-serif",
      display: "flex",
    }}>

      {/* ── LEFT RAIL ─────────────────────────────────────────── */}
      <aside style={{
        width: 240, background: "#0f0f0f",
        padding: "12px 0", flexShrink: 0, height: "100dvh",
        position: "sticky", top: 0, overflowY: "auto",
      }}>
        <div style={{ padding: "0 16px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fff", fontSize: 22 }}>☰</button>
          <Link href="/preview/v8" style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            <span style={{
              background: "#ff0033", width: 28, height: 20, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, fontWeight: 900, paddingLeft: 2,
            }}>▶</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em" }}>iku</span>
          </Link>
        </div>

        <nav style={{ padding: "0 8px", borderBottom: "1px solid #272727", paddingBottom: 10, marginBottom: 10 }}>
          {[
            { icon: "🏠", label: "Home", active: true, href: "/preview/v8" },
            { icon: "⚡", label: "Shorts", href: "/feed" },
            { icon: "🔔", label: "Subscriptions", href: "/subscriptions" },
          ].map((n) => (
            <Link key={n.label} href={n.href} style={{
              display: "flex", alignItems: "center", gap: 24, padding: "9px 12px",
              borderRadius: 10, color: "#fff", fontSize: 14,
              fontWeight: n.active ? 600 : 400, textDecoration: "none",
              background: n.active ? "rgba(255,255,255,0.1)" : "transparent",
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        <nav style={{ padding: "0 8px", borderBottom: "1px solid #272727", paddingBottom: 10, marginBottom: 10 }}>
          <div style={{ padding: "4px 12px 10px", fontSize: 16, fontWeight: 500 }}>You</div>
          {[
            { icon: "📜", label: "History", href: "/history" },
            { icon: "📺", label: "Playlists", href: "/playlists" },
            { icon: "▶", label: "Your videos", href: "/profile" },
            { icon: "❤", label: "Liked videos", href: "/favorites" },
            { icon: "⏱", label: "Watch later", href: "/watchlater" },
          ].map((n) => (
            <Link key={n.label} href={n.href} style={{
              display: "flex", alignItems: "center", gap: 24, padding: "9px 12px",
              borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 400,
              textDecoration: "none",
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        <nav style={{ padding: "0 8px" }}>
          <div style={{ padding: "4px 12px 10px", fontSize: 16, fontWeight: 500 }}>Explore</div>
          {[
            { icon: "🔥", label: "Trending", href: "/trending" },
            { icon: "🌸", label: "Hentai 2D", href: "/hentai" },
            { icon: "🎮", label: "3D & Games", href: "/3d" },
            { icon: "👤", label: "Characters", href: "/character" },
            { icon: "📚", label: "Series", href: "/series" },
            { icon: "🏷️", label: "Tags", href: "/tags" },
            { icon: "📝", label: "Blog", href: "/blog" },
          ].map((n) => (
            <Link key={n.label} href={n.href} style={{
              display: "flex", alignItems: "center", gap: 24, padding: "9px 12px",
              borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 400,
              textDecoration: "none",
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* ── MAIN COLUMN ──────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header / search */}
        <header style={{
          position: "sticky", top: 0, zIndex: 40, background: "#0f0f0f",
          padding: "10px 24px", display: "flex", alignItems: "center", gap: 20,
        }}>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ display: "flex", maxWidth: 640, width: "100%" }}>
              <input placeholder="Search" style={{
                flex: 1, padding: "9px 16px", background: "#121212",
                border: "1px solid #303030", borderRight: "none",
                borderRadius: "20px 0 0 20px", color: "#fff", fontSize: 14, outline: "none",
              }} />
              <button style={{
                padding: "0 20px", background: "#222", border: "1px solid #303030",
                borderRadius: "0 20px 20px 0", color: "#aaa", cursor: "pointer", fontSize: 16,
              }}>
                🔍
              </button>
            </div>
          </div>
          <Link href="/pricing" style={{
            background: "linear-gradient(90deg, #ff0033, #ff5500)",
            color: "#fff", padding: "7px 16px", borderRadius: 999,
            fontSize: 13, fontWeight: 700, textDecoration: "none",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}>
            ⭐ iku Premium
          </Link>
          <Link href="/login" style={{
            color: "#3ea6ff", border: "1px solid #303030", padding: "6px 12px", borderRadius: 999,
            fontSize: 13, fontWeight: 600, textDecoration: "none",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}>
            👤 Sign in
          </Link>
        </header>

        {/* Chip row */}
        <div style={{
          position: "sticky", top: 56, zIndex: 30, background: "#0f0f0f",
          display: "flex", gap: 10, padding: "12px 24px", overflowX: "auto",
          borderBottom: "1px solid #272727",
        }}>
          {chips.map((c, i) => (
            <button key={c} style={{
              padding: "7px 13px", background: i === 0 ? "#fff" : "#272727",
              color: i === 0 ? "#0f0f0f" : "#fff",
              border: "none", borderRadius: 8, fontSize: 14,
              fontWeight: i === 0 ? 500 : 400, whiteSpace: "nowrap", cursor: "pointer",
            }}>
              {c}
            </button>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "18px 14px" }}>
          {main.slice(0, 8).map((v, i) => (
            <Link key={v.id} href={`/watch/${v.slug}`} style={{ textDecoration: "none", color: "#fff" }}>
              <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: 12 }}>
                {v.thumbnail && <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />}
                {v.duration && (
                  <span style={{
                    position: "absolute", right: 6, bottom: 6,
                    background: "rgba(0,0,0,0.85)", padding: "2px 5px", borderRadius: 4,
                    fontSize: 11, fontWeight: 600,
                  }}>
                    {fmtDur(v.duration)}
                  </span>
                )}
                {i % 4 === 0 && (
                  <span style={{
                    position: "absolute", left: 6, top: 6,
                    background: "#ff0033", padding: "2px 8px", borderRadius: 3,
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
                  }}>
                    NEW
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, hsl(${(i * 53) % 360}, 75%, 60%), hsl(${(i * 53 + 50) % 360}, 75%, 45%))`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 14, fontWeight: 800,
                }}>
                  {fmtName(v.characters[0] || v.copyrights[0] || "iku").charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 4 }}>
                    {buildTitle(v)}
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{v.characters[0] ? fmtName(v.characters[0]) : "iku Studios"}</span>
                    <span style={{ fontSize: 11 }}>✓</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>
                    {fmtViews(v.score)} views · {timeAgo(v.createdAt)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── SHORTS SHELF (breaks up the grid) ──────────────── */}
        <section style={{
          padding: "16px 24px", borderTop: "1px solid #272727", borderBottom: "1px solid #272727",
          background: "#0f0f0f", margin: "8px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Shorts</h2>
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
            {shorts.map((v) => (
              <Link key={v.id} href={`/watch/${v.slug}`} style={{
                flexShrink: 0, width: 200, textDecoration: "none", color: "#fff",
              }}>
                <div style={{ position: "relative", aspectRatio: "9/16", borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: 8 }}>
                  {v.thumbnail && <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.75))",
                  }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 4 }}>
                  {buildTitle(v)}
                </div>
                <div style={{ fontSize: 11, color: "#aaa" }}>
                  {fmtViews(v.score)} views
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Rest of grid */}
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "18px 14px" }}>
          {main.slice(8).map((v, i) => (
            <Link key={v.id} href={`/watch/${v.slug}`} style={{ textDecoration: "none", color: "#fff" }}>
              <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: 12 }}>
                {v.thumbnail && <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />}
                {v.duration && (
                  <span style={{
                    position: "absolute", right: 6, bottom: 6,
                    background: "rgba(0,0,0,0.85)", padding: "2px 5px", borderRadius: 4,
                    fontSize: 11, fontWeight: 600,
                  }}>
                    {fmtDur(v.duration)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, hsl(${(i * 71) % 360}, 75%, 60%), hsl(${(i * 71 + 40) % 360}, 75%, 45%))`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 14, fontWeight: 800,
                }}>
                  {fmtName(v.characters[0] || v.copyrights[0] || "iku").charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 4 }}>
                    {buildTitle(v)}
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 2 }}>
                    {v.characters[0] ? fmtName(v.characters[0]) : "iku Studios"} <span style={{ fontSize: 10 }}>✓</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>
                    {fmtViews(v.score)} views · {timeAgo(v.createdAt)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
