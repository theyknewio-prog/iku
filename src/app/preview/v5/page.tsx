/**
 * /preview/v5 — "Classic Mainstream Tube" variant.
 *
 * Inspiration: xvideos + redtube + spankbang + youporn. The proven
 * adult-tube grid. Dense thumbnails, red accent, category tabs up
 * top, sidebar filters, "straight to the goods" mentality. High
 * density = high pages/session = more ad impressions.
 *
 * Key patterns stolen:
 * - xvideos: ultra-compact header, category pills row, massive
 *   endless grid, no hero.
 * - redtube: red/black, rating stars on every card, duration badge
 *   bottom-right, HD badge top-left, hover-preview.
 * - spankbang: tabs "New / Top / Trending / Longest", saved filters
 *   in URL, breadcrumbs above grid.
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

export default async function V5() {
  const { data: videos } = await getVideos({
    limit: 42, order: "score", source: "all", requireThumbnail: true,
  });

  const categories = [
    "Trending", "Hentai", "3D", "Futanari", "Genshin Impact",
    "Overwatch", "Blue Archive", "Honkai", "Rebirth", "Big Tits",
    "Creampie", "Milf", "Cosplay", "Compilation", "SFM",
  ];

  return (
    <main style={{ background: "#1b1b1b", minHeight: "100dvh", color: "#fff", fontFamily: "Arial, sans-serif" }}>
      {/* ── HEADER ────────────────────────────────────────────── */}
      <header style={{ background: "#000", borderBottom: "2px solid #ff0000" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", gap: 18 }}>
          <Link href="/preview/v5" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>iku</span>
            <span style={{
              fontSize: 26, fontWeight: 900,
              background: "#ff0000", color: "#000", padding: "0 6px", borderRadius: 3,
            }}>
              tube
            </span>
          </Link>

          <input placeholder="Search 353,000+ videos..." style={{
            flex: 1, maxWidth: 560, padding: "8px 14px",
            background: "#333", border: "1px solid #555", borderRadius: 3,
            color: "#fff", fontSize: 14, outline: "none",
          }} />
          <button style={{
            background: "#ff0000", color: "#fff", border: "none", padding: "8px 18px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 3,
          }}>
            SEARCH
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
            <Link href="/login" style={{ color: "#ccc", fontSize: 13, textDecoration: "none" }}>Login</Link>
            <Link href="/signup" style={{
              background: "transparent", color: "#ff7a00", fontSize: 13, textDecoration: "none",
              border: "1px solid #ff7a00", padding: "5px 12px", borderRadius: 3,
            }}>Join Free</Link>
            <Link href="/pricing" style={{
              background: "linear-gradient(180deg, #ffaa00, #ff5500)", color: "#000",
              fontSize: 12, fontWeight: 800, textDecoration: "none",
              padding: "6px 13px", borderRadius: 3,
            }}>GO PREMIUM</Link>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 0, padding: "0 20px", overflowX: "auto" }}>
          {[
            { label: "Home", href: "/preview/v5", active: true },
            { label: "Hentai", href: "/hentai" },
            { label: "3D", href: "/3d" },
            { label: "Categories", href: "/tags" },
            { label: "Characters", href: "/character" },
            { label: "Series", href: "/series" },
            { label: "Shorts", href: "/feed" },
            { label: "Live Cams", href: "/live" },
            { label: "Games", href: "/games" },
            { label: "Community", href: "/blog" },
          ].map((n) => (
            <Link key={n.label} href={n.href} style={{
              padding: "10px 16px", fontSize: 13, fontWeight: n.active ? 700 : 500,
              color: n.active ? "#fff" : "#bbb", textDecoration: "none",
              borderBottom: n.active ? "3px solid #ff0000" : "3px solid transparent",
              whiteSpace: "nowrap",
            }}>
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* ── CATEGORY PILLS ────────────────────────────────────── */}
      <div style={{
        background: "#2a2a2a", padding: "10px 20px",
        display: "flex", gap: 6, overflowX: "auto", borderBottom: "1px solid #111",
      }}>
        {categories.map((c, i) => (
          <Link key={c} href={c === "Trending" ? "/trending" : `/tag/${encodeURIComponent(c.toLowerCase().replace(/ /g, "_"))}`}
            style={{
              padding: "6px 14px", background: i === 0 ? "#ff0000" : "#444",
              color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none",
              borderRadius: 3, whiteSpace: "nowrap",
            }}>
            {c}
          </Link>
        ))}
      </div>

      {/* ── SORT BAR ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 20, padding: "12px 20px",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>Sort by:</span>
        {["Trending", "New", "Top Rated", "Most Viewed", "Longest"].map((s, i) => (
          <button key={s} style={{
            background: "none", border: "none", cursor: "pointer",
            color: i === 0 ? "#ff7a00" : "#ccc", fontSize: 13,
            fontWeight: i === 0 ? 700 : 500,
            borderBottom: i === 0 ? "2px solid #ff7a00" : "2px solid transparent", paddingBottom: 4,
          }}>
            {s}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
          353,241 videos  ·  Page 1 of 8,410
        </span>
      </div>

      {/* ── MASSIVE GRID ──────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 10,
      }}>
        {videos.map((v) => (
          <Link key={v.id} href={`/watch/${v.slug}`} style={{
            textDecoration: "none", color: "#fff", display: "block",
          }}>
            <div style={{
              position: "relative", aspectRatio: "16/9", overflow: "hidden",
              background: "#000", borderRadius: 2,
            }}>
              {v.thumbnail && (
                <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />
              )}
              {v.width >= 1080 && (
                <span style={{
                  position: "absolute", top: 4, left: 4, zIndex: 2,
                  background: "#ff0000", color: "#fff",
                  fontSize: 9, fontWeight: 900, padding: "2px 5px", borderRadius: 2,
                }}>
                  {v.width >= 2160 ? "4K" : "HD"}
                </span>
              )}
              {v.duration && (
                <span style={{
                  position: "absolute", bottom: 4, right: 4, zIndex: 2,
                  background: "rgba(0,0,0,0.85)", color: "#fff",
                  fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 2,
                }}>
                  {fmtDur(v.duration)}
                </span>
              )}
              <span style={{
                position: "absolute", bottom: 4, left: 4, zIndex: 2,
                background: "rgba(0,0,0,0.85)", color: "#ffb800",
                fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 2,
                letterSpacing: "0.05em",
              }}>
                ★ {Math.min(99, Math.floor(70 + (v.favorites % 30)))}%
              </span>
            </div>
            <div style={{ padding: "6px 2px 12px" }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "#fff", lineHeight: 1.35,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden", marginBottom: 3,
              }}>
                {buildTitle(v)}
              </div>
              <div style={{ fontSize: 10, color: "#999" }}>
                {fmtViews(v.score)} views · {Math.floor(v.favorites / 10)} likes
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── PAGINATION ────────────────────────────────────────── */}
      <div style={{ padding: "24px 20px 40px", display: "flex", justifyContent: "center", gap: 6 }}>
        {[1, 2, 3, 4, 5, "...", 8410].map((p, i) => (
          <button key={i} style={{
            minWidth: 36, padding: "6px 10px",
            background: p === 1 ? "#ff0000" : "#333",
            color: "#fff", border: "none", fontSize: 13, fontWeight: 600,
            cursor: "pointer", borderRadius: 2,
          }}>
            {p}
          </button>
        ))}
      </div>
    </main>
  );
}
