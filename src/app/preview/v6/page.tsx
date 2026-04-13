/**
 * /preview/v6 — "Creator Premium" variant.
 *
 * Inspiration: OnlyFans + Fansly + Patreon + Fanvue. Creator-first,
 * subscription-oriented. Feed of posts from subscribed creators,
 * creator cards with price/rating, tip buttons, messaging CTA.
 *
 * We reframe iku.gg characters/series as "creators". Each character
 * becomes a subscribable profile with their "content library". This
 * is how we can charge for Pro tiers that unlock full libraries.
 *
 * Key patterns stolen:
 * - OnlyFans: teal/blue palette, cards with subscribe CTA, "posts"
 *   feed, left rail = list of subs, right rail = suggestions.
 * - Fansly: "Live now" badge on creator avatars, tiers, chats.
 * - Patreon: $/mo price pill, tier perks list.
 */

import Link from "next/link";
import Image from "next/image";
import { getVideos } from "@/lib/content";
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

async function getCreators() {
  const { rows } = await pool.query<{ name: string; count: number }>(
    `SELECT ch AS name, COUNT(*)::int AS count
     FROM (SELECT unnest(characters) AS ch FROM videos WHERE array_length(characters,1) > 0) t
     WHERE ch <> ''
     GROUP BY ch ORDER BY count DESC LIMIT 14`
  );
  return rows;
}

export default async function V6() {
  const [{ data: posts }, creators] = await Promise.all([
    getVideos({ limit: 6, order: "score", source: "all", requireThumbnail: true }),
    getCreators(),
  ]);

  const mySubs = creators.slice(0, 6);
  const suggested = creators.slice(6, 14);

  return (
    <main style={{
      background: "#f4f5f7", minHeight: "100dvh",
      color: "#1a2332", fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex",
    }}>

      {/* ── LEFT RAIL (my subscriptions) ──────────────────────── */}
      <aside style={{
        width: 260, background: "#fff", borderRight: "1px solid #e5e8ec",
        height: "100dvh", position: "sticky", top: 0, overflowY: "auto", flexShrink: 0,
      }}>
        <div style={{ padding: "18px 16px", borderBottom: "1px solid #e5e8ec" }}>
          <Link href="/preview/v6" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "linear-gradient(135deg, #00aff0 0%, #0084d1 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: 15,
            }}>
              iku
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2332", letterSpacing: "0.01em" }}>
              iku.fans
            </span>
          </Link>
        </div>

        <nav style={{ padding: "10px 8px", borderBottom: "1px solid #e5e8ec" }}>
          {[
            { icon: "🏠", label: "Home", active: true, href: "/preview/v6" },
            { icon: "🔔", label: "Notifications", count: 3, href: "/notifications" },
            { icon: "💬", label: "Messages", count: 12, href: "/messages" },
            { icon: "💰", label: "Subscriptions", href: "/subscriptions" },
            { icon: "➕", label: "Collections", href: "/collections" },
            { icon: "🔖", label: "Bookmarks", href: "/favorites" },
            { icon: "📜", label: "History", href: "/history" },
            { icon: "👤", label: "My Profile", href: "/profile" },
          ].map((n) => (
            <Link key={n.label} href={n.href} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "9px 12px",
              borderRadius: 8, color: n.active ? "#00aff0" : "#1a2332",
              fontSize: 14, fontWeight: n.active ? 700 : 500, textDecoration: "none",
              background: n.active ? "rgba(0,175,240,0.08)" : "transparent",
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.count && (
                <span style={{
                  background: "#00aff0", color: "#fff", fontSize: 11, fontWeight: 700,
                  padding: "1px 7px", borderRadius: 10,
                }}>
                  {n.count}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8395a7", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Your subscriptions · {mySubs.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {mySubs.map((c, i) => (
              <Link key={c.name} href={`/character/${encodeURIComponent(c.name)}`} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "6px 8px",
                borderRadius: 8, textDecoration: "none", color: "#1a2332",
              }}>
                <div style={{ position: "relative" }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 80%, 65%), hsl(${(i * 47 + 40) % 360}, 80%, 50%))`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 14, fontWeight: 800,
                  }}>
                    {fmtName(c.name).charAt(0)}
                  </div>
                  {i < 3 && (
                    <span style={{
                      position: "absolute", right: -1, bottom: -1, width: 11, height: 11,
                      background: "#44d27d", border: "2px solid #fff", borderRadius: "50%",
                    }} />
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fmtName(c.name)}
                  </div>
                  <div style={{ fontSize: 10, color: "#8395a7" }}>
                    {i < 3 ? "LIVE now" : `${fmtViews(c.count)} posts`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* ── CENTER FEED ───────────────────────────────────────── */}
      <section style={{ flex: 1, minWidth: 0, maxWidth: 680, padding: "24px 28px" }}>
        <div style={{
          background: "linear-gradient(135deg, #00aff0 0%, #0084d1 100%)",
          borderRadius: 14, padding: "22px 24px", color: "#fff", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ fontSize: 32 }}>✨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>
              Unlock all creator libraries
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              One subscription. 1,243 creators. Unlimited content.
            </div>
          </div>
          <Link href="/pricing" style={{
            background: "#fff", color: "#0084d1", padding: "10px 20px", borderRadius: 999,
            fontSize: 13, fontWeight: 800, textDecoration: "none",
          }}>
            4.99€/mo
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {posts.map((p, i) => (
            <article key={p.id} style={{
              background: "#fff", borderRadius: 12, border: "1px solid #e5e8ec", overflow: "hidden",
            }}>
              <header style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: `linear-gradient(135deg, hsl(${(i * 53) % 360}, 80%, 65%), hsl(${(i * 53 + 40) % 360}, 80%, 50%))`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 16, fontWeight: 800,
                }}>
                  {fmtName(p.characters[0] || "iku").charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2332" }}>
                      {p.characters[0] ? fmtName(p.characters[0]) : "iku Studios"}
                    </span>
                    <span style={{ fontSize: 13, color: "#00aff0" }}>✓</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#8395a7" }}>
                    @{(p.characters[0] || "iku").replace(/_/g, "")} · {i === 0 ? "2h ago" : i === 1 ? "5h ago" : "1d ago"}
                  </div>
                </div>
                <button style={{
                  background: "transparent", border: "1px solid #e5e8ec",
                  padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  color: "#1a2332", cursor: "pointer",
                }}>
                  •••
                </button>
              </header>

              <div style={{ padding: "0 16px 12px", fontSize: 14, lineHeight: 1.45, color: "#3a4656" }}>
                {buildTitle(p).slice(0, 140)}
              </div>

              <Link href={`/watch/${p.slug}`} style={{
                display: "block", position: "relative", aspectRatio: "16/9", background: "#000",
              }}>
                {p.thumbnail && (
                  <Image src={p.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />
                )}
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 62, height: 62, borderRadius: "50%", background: "rgba(255,255,255,0.92)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#0084d1", fontSize: 24, paddingLeft: 4,
                  }}>
                    ▶
                  </div>
                </div>
                {i === 1 && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                    color: "#fff", gap: 8,
                  }}>
                    <div style={{ fontSize: 28 }}>🔒</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Subscribe to unlock</div>
                    <div style={{
                      background: "#00aff0", color: "#fff", padding: "8px 20px", borderRadius: 999,
                      fontSize: 13, fontWeight: 800, marginTop: 4,
                    }}>
                      3.99€ / month
                    </div>
                  </div>
                )}
              </Link>

              <footer style={{
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 20,
                borderTop: "1px solid #f0f2f5", fontSize: 13, color: "#3a4656",
              }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#3a4656", fontSize: 13 }}>
                  ❤ {fmtViews(p.favorites)}
                </button>
                <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#3a4656", fontSize: 13 }}>
                  💬 42
                </button>
                <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#3a4656", fontSize: 13 }}>
                  💰 Tip
                </button>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#8395a7" }}>
                  {fmtViews(p.score)} views
                </span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      {/* ── RIGHT RAIL (suggested creators) ───────────────────── */}
      <aside style={{
        width: 320, padding: "24px 20px", height: "100dvh",
        position: "sticky", top: 0, overflowY: "auto", flexShrink: 0,
      }}>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <input placeholder="Search creators, tags..." style={{
            width: "100%", padding: "10px 14px 10px 36px",
            background: "#fff", border: "1px solid #e5e8ec", borderRadius: 999,
            fontSize: 13, color: "#1a2332", outline: "none",
          }} />
          <span style={{ position: "absolute", left: 14, top: 10, color: "#8395a7" }}>🔍</span>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e8ec", overflow: "hidden", marginBottom: 18 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Suggested creators</span>
            <Link href="/character" style={{ marginLeft: "auto", fontSize: 12, color: "#00aff0", textDecoration: "none" }}>See all</Link>
          </div>
          <div>
            {suggested.map((c, i) => (
              <div key={c.name} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                borderBottom: i === suggested.length - 1 ? "none" : "1px solid #f0f2f5",
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: `linear-gradient(135deg, hsl(${(i * 61) % 360}, 75%, 65%), hsl(${(i * 61 + 40) % 360}, 75%, 50%))`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 16, fontWeight: 800, flexShrink: 0,
                }}>
                  {fmtName(c.name).charAt(0)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fmtName(c.name)}
                  </div>
                  <div style={{ fontSize: 11, color: "#8395a7" }}>
                    {fmtViews(c.count)} posts · {(i % 3 === 0) ? "FREE" : `${(2.99 + (i % 3)).toFixed(2)}€/mo`}
                  </div>
                </div>
                <button style={{
                  background: i % 2 === 0 ? "#00aff0" : "transparent",
                  color: i % 2 === 0 ? "#fff" : "#00aff0",
                  border: `1px solid #00aff0`,
                  padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>
                  {i % 2 === 0 ? "Subscribe" : "Follow"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#8395a7", lineHeight: 1.55, padding: "0 8px" }}>
          <Link href="/terms" style={{ color: "#8395a7", textDecoration: "none", marginRight: 14 }}>Terms</Link>
          <Link href="/privacy" style={{ color: "#8395a7", textDecoration: "none", marginRight: 14 }}>Privacy</Link>
          <Link href="/help" style={{ color: "#8395a7", textDecoration: "none" }}>Help</Link>
          <div style={{ marginTop: 8 }}>© 2026 iku.fans — All creators 18+</div>
        </div>
      </aside>
    </main>
  );
}
