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


function IconHamburger({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/* ── Nav definitions ─────────────────────────────────────────── */

const SIDEBAR_ITEMS = [
  { href: "/",          label: "Home",      Icon: IconHome },
  { href: "/explore",   label: "Browse",    Icon: IconBrowse },
  { href: "/trending",  label: "Trending",  Icon: IconTrending },
  { href: "/new",       label: "New",       Icon: IconNew },
  { href: "/tags",      label: "Tags",      Icon: IconTag },
  { href: "/feed",      label: "Shorts",    Icon: IconFeed },
  { href: "/history",   label: "History",   Icon: IconHistory },
  { href: "/favorites", label: "Favorites", Icon: IconHeart },
  { href: "/settings",  label: "Settings",  Icon: IconSettings },
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
  }, [pathname]);

  if (pathname === "/feed") {
    return <>{children}</>;
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }


  return (
  <>
    <div className="v2-shell">

      {/* ══ SIDEBAR (desktop, 60px icon-only) ═════════════════ */}
      <aside className="v2-sidebar" aria-label="Main navigation">

        <Link href="/" className="v2-sidebar__logo" aria-label="iku home">
          IK
        </Link>

        <nav className="v2-sidebar__nav">
          {SIDEBAR_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`v2-sidebar__item${isActive(href) ? " v2-sidebar__item--active" : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon size={20} />
              <span className="v2-sidebar__tooltip">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="v2-sidebar__bottom">
          <div className="v2-sidebar__divider" />
          <div className="v2-sidebar__avatar" aria-hidden="true" />
        </div>
      </aside>

      {/* ══ TOPBAR ════════════════════════════════════════════ */}
      <header className={`v2-topbar${scrolled ? " v2-topbar--scrolled" : ""}`}>

        <Link href="/" className="v2-topbar__logo" aria-label="iku home">
          <span className="v2-topbar__logo-text">iku</span>
        </Link>

        <SearchAutocomplete />

        <div className="v2-topbar__right">
          <nav className="v2-topbar__nav" aria-label="Content navigation">
            <Link href="/"          className={`v2-topbar__link${pathname === "/" ? " v2-topbar__link--active" : ""}`}>Home</Link>
            <Link href="/trending"  className={`v2-topbar__link${pathname.startsWith("/trending") ? " v2-topbar__link--active" : ""}`}>Trending</Link>
            <Link href="/new"       className={`v2-topbar__link${pathname.startsWith("/new") ? " v2-topbar__link--active" : ""}`}>New</Link>
            <Link href="/explore"   className={`v2-topbar__link${pathname.startsWith("/explore") ? " v2-topbar__link--active" : ""}`}>Browse</Link>
            <Link href="/tags"      className={`v2-topbar__link${pathname.startsWith("/tags") ? " v2-topbar__link--active" : ""}`}>Tags</Link>
            <Link href="/history"   className={`v2-topbar__link${pathname.startsWith("/history") ? " v2-topbar__link--active" : ""}`}>History</Link>
            <Link href="/favorites" className={`v2-topbar__link${pathname.startsWith("/favorites") ? " v2-topbar__link--active" : ""}`}>Favorites</Link>
            <Link href="/settings"  className={`v2-topbar__link${pathname.startsWith("/settings") ? " v2-topbar__link--active" : ""}`}>Settings</Link>
          </nav>

          <button
            className="v2-topbar__hamburger"
            aria-label="Menu"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <IconHamburger size={22} />
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="v2-mobile-menu" onClick={() => setMenuOpen(false)}>
            <Link href="/" className="v2-mobile-menu__item">Home</Link>
            <Link href="/explore" className="v2-mobile-menu__item">Browse</Link>
            <Link href="/trending" className="v2-mobile-menu__item">Trending</Link>
            <Link href="/new" className="v2-mobile-menu__item">New</Link>
            <Link href="/tags" className="v2-mobile-menu__item">Tags</Link>
            <Link href="/feed" className="v2-mobile-menu__item">Feed</Link>
            <div className="v2-mobile-menu__divider" />
            <Link href="/blog" className="v2-mobile-menu__item">Blog</Link>
            <Link href="/glossary" className="v2-mobile-menu__item">Glossary</Link>
            <div className="v2-mobile-menu__divider" />
            <Link href="/history" className="v2-mobile-menu__item">History</Link>
            <Link href="/favorites" className="v2-mobile-menu__item">Favorites</Link>
            <Link href="/settings" className="v2-mobile-menu__item">Settings</Link>
          </div>
        )}
      </header>

      {/* ══ MAIN CONTENT ════════════════════════════════════════ */}
      <div className="v2-main">
        {children}
      </div>

    </div>

    {/* ══ MOBILE BOTTOM NAV ═══════════════════════════════════ */}
    <nav className="v2-bottom-nav" aria-label="Mobile navigation">
      {BOTTOM_ITEMS.map(({ href, label, Icon, featured }) => (
        <Link
          key={href}
          href={href}
          className={`v2-bottom-nav__item${isActive(href) ? " v2-bottom-nav__item--active" : ""}${featured && isActive(href) ? " v2-bottom-nav__item--featured" : ""}${featured && !isActive(href) ? " v2-bottom-nav__item--shorts-hint" : ""}`}
          aria-current={isActive(href) ? "page" : undefined}
        >
          <Icon size={22} />
          <span className="v2-bottom-nav__label">{label}</span>
        </Link>
      ))}

      {/* More — opens slide-up drawer */}
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

    {/* ══ MORE DRAWER ════════════════════════════════════════ */}
    {moreOpen && (
      <>
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 49,
          }}
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More navigation options"
          style={{
            position: "fixed",
            bottom: "calc(60px + env(safe-area-inset-bottom))",
            left: 0,
            right: 0,
            background: "var(--color-bg-elevated)",
            borderTop: "1px solid var(--color-border-default)",
            borderRadius: "16px 16px 0 0",
            zIndex: 50,
            padding: "20px 24px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
          }}
        >
          {MORE_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`v2-bottom-nav__item${isActive(href) ? " v2-bottom-nav__item--active" : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
              style={{
                padding: "14px 8px",
                borderRadius: "10px",
                background: isActive(href)
                  ? "var(--color-accent-dim)"
                  : "var(--color-bg-muted)",
              }}
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
