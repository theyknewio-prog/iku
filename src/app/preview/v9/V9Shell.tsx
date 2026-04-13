"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Video = {
  id: number;
  slug: string;
  title: string;
  thumbnail: string | null;
  score: number;
  duration: number | null;
  width: number;
};

type NamedCount = { name: string; count: number };

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function dur(s: number | null) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function prettyName(n: string) {
  return n.replace(/_/g, " ").replace(/:/g, "").trim()
    .split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const NAV_ITEMS = [
  { icon: "🏠", label: "Home",       href: "/preview/v9", shortcut: "G H" },
  { icon: "🌸", label: "Hentai",     href: "/hentai",     shortcut: "G E" },
  { icon: "🎮", label: "3D",         href: "/3d",         shortcut: "G D" },
  { icon: "⚡", label: "Shorts",     href: "/feed",       shortcut: "G S" },
  { icon: "🔥", label: "Trending",   href: "/trending",   shortcut: "G T" },
  { icon: "🆕", label: "New",        href: "/new",        shortcut: "G N" },
  { icon: "👤", label: "Characters", href: "/character",  shortcut: "G C" },
  { icon: "📚", label: "Series",     href: "/series",     shortcut: "G R" },
  { icon: "🏷️", label: "Tags",       href: "/tags",       shortcut: "G G" },
  { icon: "❤️", label: "Favorites",  href: "/favorites",  shortcut: "G F" },
  { icon: "🕐", label: "History",    href: "/history",    shortcut: "G Y" },
  { icon: "⚙️", label: "Settings",   href: "/settings",   shortcut: "," },
];

const FILTER_CHIPS = [
  "All", "Trending", "New", "HD", "4K",
  "Genshin", "Overwatch", "Blue Archive", "Honkai",
  "Futanari", "Cosplay", "SFM", "Compilation",
];

const RECENT_SEARCHES = ["raiden shogun", "genshin compilation", "4k hentai"];
const TRENDING_SEARCHES = ["3d honkai", "zzz characters", "cosplay 2026", "futa hentai"];

/* ─────────────────────────────────────────────────────────── */

export function V9Shell({
  videos, tags, chars,
}: { videos: Video[]; tags: NamedCount[]; chars: NamedCount[] }) {
  // Pattern 4: Collapsible sidebar (persisted)
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const s = localStorage.getItem("v9-sidebar-expanded");
    if (s === "1") setExpanded(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("v9-sidebar-expanded", expanded ? "1" : "0");
  }, [expanded]);

  // Pattern 1: Command palette (⌘K)
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
        setSearchFocus(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pattern 2: Filter chips active state
  const [activeChip, setActiveChip] = useState("All");

  // Pattern 3: Search autocomplete
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const cmdResults = useMemo(() => {
    const q = cmdQuery.toLowerCase().trim();
    const navHits = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(q));
    const tagHits = tags.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6);
    const charHits = chars.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
    return { navHits, tagHits, charHits };
  }, [cmdQuery, tags, chars]);

  const autocompleteHits = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    const tagHits = tags.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 4);
    const charHits = chars.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4);
    return { tagHits, charHits };
  }, [searchQuery, tags, chars]);

  const sidebarWidth = expanded ? 240 : 64;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0a0a0f",
      color: "#fff",
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex",
    }}>
      {/* ── SIDEBAR ───────────────────────────────────────────── */}
      <aside
        style={{
          width: sidebarWidth,
          flexShrink: 0,
          background: "#07070c",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          height: "100dvh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          padding: "14px 10px",
          transition: "width 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Logo */}
        <Link href="/preview/v9" style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 8px 18px", textDecoration: "none",
          overflow: "hidden", whiteSpace: "nowrap",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #ff3d7a 0%, #8b38ff 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: 13,
          }}>iku</div>
          {expanded && (
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>
              iku<span style={{ color: "#ff7aa8" }}>.gg</span>
            </span>
          )}
        </Link>

        {/* Nav items with hover-reveal labels */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.slice(0, 9).map((n, i) => (
            <SidebarItem key={n.label} item={n} active={i === 0} expanded={expanded} />
          ))}
        </nav>

        <div style={{ margin: "14px 0", height: 1, background: "rgba(255,255,255,0.06)" }} />

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.slice(9).map((n) => (
            <SidebarItem key={n.label} item={n} active={false} expanded={expanded} />
          ))}
        </nav>

        {/* Collapse toggle (bottom) */}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={`${expanded ? "Collapse" : "Expand"} sidebar (⌘\\)`}
          style={{
            marginTop: "auto",
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px", background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.55)", fontSize: 13, borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: "center" }}>
            {expanded ? "«" : "»"}
          </span>
          {expanded && (
            <span style={{ flex: 1, textAlign: "left" }}>
              Collapse <kbd style={kbd}>⌘\</kbd>
            </span>
          )}
        </button>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header style={{
          position: "sticky", top: 0, zIndex: 30,
          background: "rgba(10,10,15,0.85)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "12px 24px",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          {/* Search with autocomplete */}
          <div style={{ flex: 1, maxWidth: 560, position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "0 16px", background: "rgba(255,255,255,0.05)",
              border: `1px solid ${searchFocus ? "rgba(255,122,168,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12, transition: "border-color 150ms ease",
            }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>🔍</span>
              <input
                ref={searchRef}
                placeholder="Search characters, tags, series…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                style={{
                  flex: 1, padding: "10px 0", background: "transparent",
                  border: "none", color: "#fff", fontSize: 14, outline: "none",
                }}
              />
              <button
                onClick={() => setCmdOpen(true)}
                title="Command palette"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, padding: "3px 8px",
                  color: "rgba(255,255,255,0.7)", fontSize: 11,
                  fontFamily: "ui-monospace, monospace", cursor: "pointer",
                }}
              >
                ⌘K
              </button>
            </div>

            {/* Autocomplete dropdown */}
            {searchFocus && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
                background: "#13131c", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: 10, zIndex: 50,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                maxHeight: 420, overflowY: "auto",
              }}>
                {!searchQuery && (
                  <>
                    <SectionLabel>Recent</SectionLabel>
                    {RECENT_SEARCHES.map((r) => (
                      <Row key={r} icon="🕐" label={r} />
                    ))}
                    <SectionLabel>Trending now</SectionLabel>
                    {TRENDING_SEARCHES.map((r) => (
                      <Row key={r} icon="🔥" label={r} meta="up today" />
                    ))}
                  </>
                )}
                {searchQuery && autocompleteHits && (
                  <>
                    {autocompleteHits.tagHits.length > 0 && (
                      <>
                        <SectionLabel>Tags</SectionLabel>
                        {autocompleteHits.tagHits.map((t) => (
                          <Row key={t.name} icon="🏷️" label={prettyName(t.name)} meta={`${fmt(t.count)} videos`} />
                        ))}
                      </>
                    )}
                    {autocompleteHits.charHits.length > 0 && (
                      <>
                        <SectionLabel>Characters</SectionLabel>
                        {autocompleteHits.charHits.map((c) => (
                          <Row key={c.name} icon="👤" label={prettyName(c.name)} meta={`${fmt(c.count)} videos`} />
                        ))}
                      </>
                    )}
                    {autocompleteHits.tagHits.length === 0 && autocompleteHits.charHits.length === 0 && (
                      <div style={{ padding: "16px 12px", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                        No matches for &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setCmdOpen(true)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)",
              padding: "8px 14px", borderRadius: 10, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>⌘</span> Quick nav
          </button>

          <Link href="/pricing" style={{
            background: "linear-gradient(135deg, #ff3d7a 0%, #8b38ff 100%)",
            color: "#fff", padding: "8px 16px", borderRadius: 10,
            fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>
            Go Premium
          </Link>
        </header>

        {/* ── Filter chip rail (sticky) ──────────────────────── */}
        <div style={{
          position: "sticky", top: 64, zIndex: 20,
          background: "rgba(10,10,15,0.85)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "10px 24px",
        }}>
          <div style={{
            display: "flex", gap: 8, overflowX: "auto",
            scrollSnapType: "x proximity",
          }}>
            {FILTER_CHIPS.map((c) => {
              const isActive = c === activeChip;
              return (
                <button
                  key={c}
                  onClick={() => setActiveChip(c)}
                  style={{
                    padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                    background: isActive ? "#fff" : "rgba(255,255,255,0.06)",
                    color: isActive ? "#0a0a0f" : "rgba(255,255,255,0.85)",
                    border: "1px solid",
                    borderColor: isActive ? "transparent" : "rgba(255,255,255,0.08)",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    whiteSpace: "nowrap", scrollSnapAlign: "start",
                    transition: "all 120ms ease",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Contextual breadcrumb (bonus: pattern 6) ───────── */}
        <div style={{
          padding: "14px 24px 0",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: "rgba(255,255,255,0.5)",
        }}>
          <Link href="/preview/v9" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Home</Link>
          <span>›</span>
          <span>Trending</span>
          {activeChip !== "All" && (
            <>
              <span>›</span>
              <span style={{
                background: "rgba(255,122,168,0.15)", color: "#ff7aa8",
                border: "1px solid rgba(255,122,168,0.25)", padding: "2px 8px",
                borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {activeChip}
                <button
                  onClick={() => setActiveChip("All")}
                  style={{ background: "none", border: "none", color: "#ff7aa8", cursor: "pointer", fontSize: 13 }}
                >
                  ×
                </button>
              </span>
            </>
          )}
        </div>

        {/* ── Grid ───────────────────────────────────────────── */}
        <div style={{
          padding: "18px 24px 60px",
          display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}>
          {videos.map((v) => (
            <Link key={v.id} href={`/watch/${v.slug}`} style={{ textDecoration: "none", color: "#fff" }}>
              <div style={{
                position: "relative", aspectRatio: "16/9",
                borderRadius: 10, overflow: "hidden", background: "#000", marginBottom: 10,
              }}>
                {v.thumbnail && <Image src={v.thumbnail} alt="" fill unoptimized style={{ objectFit: "cover" }} />}
                {v.duration && (
                  <span style={{
                    position: "absolute", bottom: 6, right: 6,
                    background: "rgba(0,0,0,0.85)", padding: "2px 6px", borderRadius: 4,
                    fontSize: 11, fontWeight: 600,
                  }}>{dur(v.duration)}</span>
                )}
                {v.width >= 1080 && (
                  <span style={{
                    position: "absolute", top: 6, left: 6,
                    background: "rgba(0,0,0,0.85)", color: "#4ade80",
                    padding: "2px 6px", borderRadius: 4,
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
                  }}>{v.width >= 2160 ? "4K" : "HD"}</span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginBottom: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {prettyName(v.title)}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ color: "#ffd700" }}>★★★★★</span> {fmt(v.score)} views
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ── COMMAND PALETTE MODAL ───────────────────────────── */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "12vh 20px 0",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 620,
              background: "#13131c", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16 }}>⌘</span>
              <input
                autoFocus
                placeholder="Search or jump to…"
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                style={{
                  flex: 1, background: "transparent", border: "none",
                  color: "#fff", fontSize: 16, outline: "none",
                }}
              />
              <kbd style={kbd}>ESC</kbd>
            </div>

            <div style={{ maxHeight: "50vh", overflowY: "auto", padding: "8px 6px" }}>
              {cmdResults.navHits.length > 0 && (
                <>
                  <SectionLabel>Go to</SectionLabel>
                  {cmdResults.navHits.map((n) => (
                    <Link key={n.label} href={n.href} style={cmdRow}>
                      <span style={{ fontSize: 16, width: 22 }}>{n.icon}</span>
                      <span style={{ flex: 1 }}>{n.label}</span>
                      <kbd style={kbd}>{n.shortcut}</kbd>
                    </Link>
                  ))}
                </>
              )}
              {cmdResults.charHits.length > 0 && (
                <>
                  <SectionLabel>Characters</SectionLabel>
                  {cmdResults.charHits.map((c) => (
                    <Link key={c.name} href={`/character/${encodeURIComponent(c.name)}`} style={cmdRow}>
                      <span style={{ fontSize: 16, width: 22 }}>👤</span>
                      <span style={{ flex: 1 }}>{prettyName(c.name)}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{fmt(c.count)}</span>
                    </Link>
                  ))}
                </>
              )}
              {cmdResults.tagHits.length > 0 && (
                <>
                  <SectionLabel>Tags</SectionLabel>
                  {cmdResults.tagHits.map((t) => (
                    <Link key={t.name} href={`/tag/${encodeURIComponent(t.name)}`} style={cmdRow}>
                      <span style={{ fontSize: 16, width: 22 }}>🏷️</span>
                      <span style={{ flex: 1 }}>{prettyName(t.name)}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{fmt(t.count)}</span>
                    </Link>
                  ))}
                </>
              )}
              {cmdQuery && cmdResults.navHits.length + cmdResults.tagHits.length + cmdResults.charHits.length === 0 && (
                <div style={{ padding: "24px 16px", color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>
                  No matches for &quot;{cmdQuery}&quot;
                </div>
              )}
            </div>

            <div style={{
              padding: "10px 18px", borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex", gap: 18, fontSize: 11, color: "rgba(255,255,255,0.4)",
            }}>
              <span><kbd style={kbd}>↑↓</kbd> navigate</span>
              <span><kbd style={kbd}>↵</kbd> select</span>
              <span><kbd style={kbd}>⌘\</kbd> toggle sidebar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

const kbd: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  padding: "1px 6px",
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
  color: "rgba(255,255,255,0.75)",
};

const cmdRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "10px 14px", borderRadius: 8,
  textDecoration: "none", color: "#fff", fontSize: 14,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "10px 14px 4px", fontSize: 10, fontWeight: 700,
      color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em",
    }}>
      {children}
    </div>
  );
}

function Row({ icon, label, meta }: { icon: string; label: string; meta?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 14,
    }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span style={{ fontSize: 15, width: 20 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {meta && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{meta}</span>}
    </div>
  );
}

function SidebarItem({
  item, active, expanded,
}: {
  item: { icon: string; label: string; href: string; shortcut: string };
  active: boolean;
  expanded: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: expanded ? "8px 10px" : "10px",
        borderRadius: 8,
        color: active ? "#fff" : "rgba(255,255,255,0.65)",
        background: active
          ? "linear-gradient(135deg, rgba(255,61,122,0.2), rgba(139,56,255,0.2))"
          : hover ? "rgba(255,255,255,0.05)" : "transparent",
        textDecoration: "none", position: "relative",
        whiteSpace: "nowrap", overflow: "hidden",
        transition: "background 120ms ease",
      }}
    >
      <span style={{ fontSize: 18, width: 22, textAlign: "center", flexShrink: 0 }}>
        {item.icon}
      </span>
      {expanded && (
        <>
          <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 500 }}>
            {item.label}
          </span>
          <kbd style={{ ...kbd, fontSize: 10, opacity: hover || active ? 1 : 0 }}>
            {item.shortcut}
          </kbd>
        </>
      )}

      {/* Hover-reveal label (only when collapsed) */}
      {!expanded && hover && (
        <span
          style={{
            position: "absolute", left: "calc(100% + 12px)", top: "50%", transform: "translateY(-50%)",
            background: "#13131c", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600,
            whiteSpace: "nowrap", zIndex: 40,
            boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
          }}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
