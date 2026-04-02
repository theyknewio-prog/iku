"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/* ── SVG Icons ─────────────────────────────────────────────── */

function IconHome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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

function IconCharacters({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

function IconSearch({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ── Nav definitions ─────────────────────────────────────────── */

const SIDEBAR_ITEMS = [
  { href: "/",          label: "Home",       Icon: IconHome },
  { href: "/explore",   label: "Browse",     Icon: IconBrowse },
  { href: "/trending",  label: "Trending",   Icon: IconTrending },
  { href: "/new",       label: "New",        Icon: IconNew },
  { href: "/tags",      label: "Tags",       Icon: IconTag },
  { href: "/feed",      label: "Feed",       Icon: IconFeed },
] as const;

const BOTTOM_ITEMS = [
  { href: "/",         label: "Home",     Icon: IconHome },
  { href: "/explore",  label: "Browse",   Icon: IconBrowse },
  { href: "/trending", label: "Trending", Icon: IconTrending },
  { href: "/tags",     label: "Tags",     Icon: IconTag },
  { href: "/feed",     label: "Feed",     Icon: IconFeed },
] as const;

/* ── AppShell ─────────────────────────────────────────────────── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  /* Topbar becomes opaque on scroll */
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* /feed is full-screen TikTok mode — no chrome */
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

        {/* Logo mark */}
        <Link href="/" className="v2-sidebar__logo" aria-label="iku home">
          IK
        </Link>

        {/* Nav items */}
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

        {/* Divider + bottom area */}
        <div className="v2-sidebar__bottom">
          <div className="v2-sidebar__divider" />
          <div className="v2-sidebar__avatar" aria-hidden="true" />
        </div>
      </aside>

      {/* ══ TOPBAR (fixed, transparent → frosted on scroll) ════ */}
      <header className={`v2-topbar${scrolled ? " v2-topbar--scrolled" : ""}`}>
        {/* Nav links — desktop only */}
        <nav className="v2-topbar__nav" aria-label="Content navigation">
          <Link href="/"         className={`v2-topbar__link${pathname === "/" ? " v2-topbar__link--active" : ""}`}>Home</Link>
          <Link href="/trending" className={`v2-topbar__link${pathname.startsWith("/trending") ? " v2-topbar__link--active" : ""}`}>Trending</Link>
          <Link href="/new"      className={`v2-topbar__link${pathname.startsWith("/new") ? " v2-topbar__link--active" : ""}`}>New</Link>
          <Link href="/explore"  className={`v2-topbar__link${pathname.startsWith("/explore") ? " v2-topbar__link--active" : ""}`}>Browse</Link>
          <Link href="/tags"     className={`v2-topbar__link${pathname.startsWith("/tags") ? " v2-topbar__link--active" : ""}`}>Tags</Link>
        </nav>

        {/* Right: search pill */}
        <div className="v2-topbar__right">
          <Link href="/explore" className="v2-topbar__search" aria-label="Search">
            <span className="v2-topbar__search-icon"><IconSearch size={14} /></span>
            <span className="v2-topbar__search-text">Search titles, tags, characters...</span>
          </Link>
        </div>
      </header>

      {/* ══ MAIN CONTENT ════════════════════════════════════════ */}
      <div className="v2-main">
        {children}
      </div>

    </div>

    {/* ══ MOBILE BOTTOM NAV — outside v2-shell to avoid stacking context issues ═══ */}
    <nav className="v2-bottom-nav" aria-label="Mobile navigation">
      {BOTTOM_ITEMS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`v2-bottom-nav__item${isActive(href) ? " v2-bottom-nav__item--active" : ""}`}
          aria-current={isActive(href) ? "page" : undefined}
        >
          <Icon size={22} />
          <span className="v2-bottom-nav__label">{label}</span>
        </Link>
      ))}
    </nav>
  </>
  );
}
