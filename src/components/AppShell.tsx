"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchAutocomplete } from "./SearchAutocomplete";

/* ── SVG Icons ─────────────────────────────────────────────── */

function IconHome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconSearch({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconBrowse({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconTrending({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTag({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconNew({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function IconStar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconFeed({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconHistory({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconHeart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconSettings({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconCharacter({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconSeries({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

function IconBell({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconMore({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

function IconClose({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ── Nav definitions ─────────────────────────────────────────── */

/* Sidebar sections — Discover */
const DISCOVER_ITEMS = [
  { href: "/",         label: "Home",         Icon: IconHome,     emoji: "🏠" },
  { href: "/trending", label: "Trending",     Icon: IconTrending, emoji: "🔥", badge: "Hot" },
  { href: "/new",      label: "New Releases", Icon: IconNew,      emoji: "🆕" },
  { href: "/explore?sort=top", label: "Top Rated", Icon: IconStar, emoji: "⭐" },
  { href: "/feed",     label: "Shorts",       Icon: IconFeed,     emoji: "⚡", badge: "New", badgeGradient: true },
  { href: "/explore",  label: "Explore",      Icon: IconBrowse,   emoji: "🔎" },
] as const;

/* Library */
const LIBRARY_ITEMS = [
  { href: "/favorites", label: "Favorites", Icon: IconHeart,    emoji: "❤️" },
  { href: "/history",   label: "History",   Icon: IconHistory,  emoji: "🕐" },
  { href: "/settings",  label: "Settings",  Icon: IconSettings, emoji: "⚙️" },
] as const;

/* Browse */
const BROWSE_ITEMS = [
  { href: "/character", label: "Characters", Icon: IconCharacter, emoji: "👤" },
  { href: "/series",    label: "Series",     Icon: IconSeries,    emoji: "📺" },
  { href: "/tags",      label: "Tags",       Icon: IconTag,       emoji: "🏷️" },
] as const;

/* Quick tags for sidebar bottom */
const QUICK_TAGS = [
  { label: "animated",   href: "/tag/animated",   color: "pink" },
  { label: "3D",         href: "/tag/3d",         color: "purple" },
  { label: "fantasy",    href: "/tag/fantasy",    color: "cyan" },
  { label: "uncensored", href: "/tag/uncensored", color: "gold" },
  { label: "vanilla",    href: "/tag/vanilla",    color: "green" },
  { label: "monster",    href: "/tag/monster",    color: "red" },
  { label: "elf",        href: "/tag/elf",        color: "orange" },
  { label: "schoolgirl", href: "/tag/schoolgirl", color: "blue" },
  { label: "catgirl",    href: "/tag/cat_girl",   color: "pink" },
  { label: "demon",      href: "/tag/demon",      color: "purple" },
] as const;

/* Mobile bottom — Industry standard 5-tab pattern */
const BOTTOM_ITEMS = [
  { href: "/",         label: "Home",     Icon: IconHome,     featured: false },
  { href: "/explore",  label: "Search",   Icon: IconSearch,   featured: false },
  { href: "/feed",     label: "Shorts",   Icon: IconFeed,     featured: true },
  { href: "/trending", label: "Trending", Icon: IconTrending, featured: false },
] as const;

const MORE_ITEMS = [
  { href: "/history",   label: "History",   Icon: IconHistory },
  { href: "/favorites", label: "Favorites", Icon: IconHeart },
  { href: "/tags",      label: "Tags",      Icon: IconTag },
  { href: "/settings",  label: "Settings",  Icon: IconSettings },
] as const;

/* ── AppShell ─────────────────────────────────────────────────── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close drawer on navigation */
  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  if (pathname === "/feed") {
    return <>{children}</>;
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  type NavItem = { href: string; label: string; Icon: React.ComponentType<{ size?: number }>; emoji?: string; badge?: string; badgeGradient?: boolean };

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        className={`v2-nav-item${active ? " v2-nav-item--active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <span className="v2-nav-icon" aria-hidden="true">
          {item.emoji ?? <item.Icon size={16} />}
        </span>
        <span className="v2-nav-item__label">{item.label}</span>
        {item.badge && (
          <span className={`v2-nav-badge${item.badgeGradient ? " v2-nav-badge--gradient" : ""}`}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
  <>
    <div className="v2-shell">

      {/* SIDEBAR (desktop, 220px expanded) */}
      <aside className="v2-sidebar" aria-label="Main navigation">

        {/* Logo */}
        <Link href="/" prefetch={true} className="v2-sidebar-logo" aria-label="iku home">
          <span className="v2-sidebar-logo__icon">iku</span>
          <span className="v2-sidebar-logo__text-wrap">
            <span className="v2-sidebar-logo__text">iku.gg ✨</span>
            <span className="v2-sidebar-logo__sub">353K+ free videos</span>
          </span>
        </Link>

        {/* Nav: Discover */}
        <div className="v2-sidebar-section">
          <div className="v2-sidebar-section__label">Discover</div>
          {(DISCOVER_ITEMS as unknown as NavItem[]).map(renderNavItem)}
        </div>

        {/* Nav: My Library */}
        <div className="v2-sidebar-section">
          <div className="v2-sidebar-section__label">My Library</div>
          {(LIBRARY_ITEMS as unknown as NavItem[]).map(renderNavItem)}
        </div>

        {/* Nav: Browse */}
        <div className="v2-sidebar-section">
          <div className="v2-sidebar-section__label">Browse</div>
          {(BROWSE_ITEMS as unknown as NavItem[]).map(renderNavItem)}
        </div>

        {/* Quick Tags */}
        <div className="v2-sidebar-section">
          <div className="v2-sidebar-section__label">Quick Tags</div>
          <div className="v2-sidebar-tags">
            {QUICK_TAGS.map((tag) => (
              <Link
                key={tag.label}
                href={tag.href}
                className={`v2-sidebar-tag v2-sidebar-tag--${tag.color}`}
              >
                {tag.label}
              </Link>
            ))}
          </div>
        </div>

      </aside>

      {/* TOPBAR */}
      <header className={`v2-topbar${scrolled ? " v2-topbar--scrolled" : ""}`}>

        {/* Mobile logo */}
        <Link href="/" prefetch={true} className="v2-topbar__logo" aria-label="iku home">
          <span className="v2-topbar__logo-text">iku</span>
        </Link>

        <div className="v2-topbar__search-area">
          <SearchAutocomplete />
        </div>

        {/* Stats chip */}
        <div className="v2-stats-chip">
          <span className="v2-stats-chip__sparkle">&#10024;</span>
          <span>353K+ Videos</span>
        </div>

        <div className="v2-topbar__actions">
          <Link href="/favorites" className="v2-topbar-btn" title="Favorites" aria-label="Favorites">
            <span aria-hidden="true" style={{ fontSize: 18 }}>❤️</span>
          </Link>
          <Link href="/settings" className="v2-topbar-avatar" title="Account" aria-label="Account">
            <span aria-hidden="true" style={{ fontSize: 18 }}>🎌</span>
          </Link>
        </div>

      </header>

      {/* MAIN CONTENT */}
      <div className="v2-main">
        {children}
      </div>

    </div>

    {/* MOBILE BOTTOM NAV */}
    <nav className="v2-bottom-nav" aria-label="Mobile navigation">
      {BOTTOM_ITEMS.map(({ href, label, Icon, featured }) => (
        <Link
          key={href}
          href={href}
          prefetch={true}
          className={`v2-bottom-nav__item${isActive(href) ? " v2-bottom-nav__item--active" : ""}${featured ? " v2-bottom-nav__item--shorts" : ""}`}
          aria-current={isActive(href) ? "page" : undefined}
        >
          {featured ? (
            <span className={`v2-shorts-icon-wrap${isActive(href) ? " v2-shorts-icon-wrap--active" : ""}`}>
              <Icon size={20} />
            </span>
          ) : (
            <Icon size={22} />
          )}
          <span className="v2-bottom-nav__label">{label}</span>
        </Link>
      ))}

      {/* More -- opens slide-up drawer */}
      <button
        type="button"
        className={`v2-bottom-nav__item${moreOpen ? " v2-bottom-nav__item--active" : ""}`}
        aria-label="More options"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
      >
        {moreOpen ? <IconClose size={22} /> : <IconMore size={22} />}
        <span className="v2-bottom-nav__label">More</span>
      </button>
    </nav>

    {/* MORE DRAWER */}
    {moreOpen && (
      <>
        <div
          className="v2-more-overlay"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More navigation options"
          className="v2-more-drawer"
        >
          {MORE_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`v2-more-drawer__item${isActive(href) ? " v2-more-drawer__item--active" : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon size={22} />
              <span className="v2-bottom-nav__label">{label}</span>
            </Link>
          ))}
        </div>
      </>
    )}
  </>
  );
}
