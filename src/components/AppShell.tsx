"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Logo SVG ─────────────────────────────────────────────── */

function IkuLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size * 2.8}
      height={size}
      viewBox="0 0 68 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="iku"
    >
      {/* i — stem */}
      <rect x="0" y="10" width="7" height="18" rx="3.5" fill="#f0f0f0" />
      {/* i — dot (pink circle accent) */}
      <circle cx="3.5" cy="4" r="4" fill="#ff2080" />

      {/* k — vertical stem */}
      <rect x="12" y="0" width="7" height="28" rx="3.5" fill="#f0f0f0" />
      {/* k — upper diagonal arm */}
      <path
        d="M19 14 L31 3"
        stroke="#f0f0f0"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* k — lower diagonal arm */}
      <path
        d="M19 14 L31 25"
        stroke="#f0f0f0"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* u — left stem */}
      <rect x="36" y="10" width="7" height="14" rx="3.5" fill="#f0f0f0" />
      {/* u — right stem */}
      <rect x="57" y="10" width="7" height="14" rx="3.5" fill="#f0f0f0" />
      {/* u — bottom curve connecting both stems */}
      <path
        d="M39.5 22 Q39.5 29 50 29 Q60.5 29 60.5 22"
        stroke="#f0f0f0"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/* ── SVG Icons (strokeWidth 1.5 — premium thinner stroke) ─── */

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconHome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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

function IconExplore({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
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

function IconFeed({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
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

/* ── Nav items definition ─────────────────────────────────── */

const NAV_ITEMS = [
  { href: "/",          label: "Home",     Icon: IconHome },
  { href: "/explore",   label: "Explore",  Icon: IconExplore },
  { href: "/trending",  label: "Trending", Icon: IconTrending },
  { href: "/new",       label: "New",      Icon: IconNew },
  { href: "/tags",      label: "Tags",     Icon: IconTag },
  { href: "/feed",      label: "Feed",     Icon: IconFeed },
] as const;

/* ── AppShell ─────────────────────────────────────────────── */

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // /feed is full-screen TikTok mode — render without shell chrome
  if (pathname === "/feed") {
    return <>{children}</>;
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="app-shell">
      {/* ── Top header bar (all viewports) ───────────────── */}
      <header className="app-header">
        <div className="app-header__inner">
          {/* Logo — always visible in header (desktop hides via CSS at 1280px+
              where sidebar has more room, but we keep it always for consistency) */}
          <Link href="/" className="app-header__logo" aria-label="iku home">
            <IkuLogo size={22} />
          </Link>

          {/* Search — center pill */}
          <div className="app-header__search">
            <div className="search-bar">
              <span className="search-bar__icon">
                <IconSearch size={15} />
              </span>
              <input
                className="search-bar__input"
                type="search"
                placeholder="Search hentai, characters, tags..."
                aria-label="Search hentai, characters, tags"
              />
            </div>
          </div>

          {/* Right slot — reserved for future auth buttons */}
          <div className="app-header__actions" />
        </div>
      </header>

      {/* ── Left sidebar (desktop only, 1024px+) ─────────── */}
      <aside className="app-sidebar" aria-label="Sidebar navigation">
        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`sidebar-nav-item${isActive(href) ? " sidebar-nav-item--active" : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <span className="sidebar-nav-item__icon">
                <Icon size={20} />
              </span>
              <span className="sidebar-nav-item__label">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer links */}
        <div className="sidebar-footer">
          <a href="/terms"   className="sidebar-footer__link">Terms</a>
          <a href="/privacy" className="sidebar-footer__link">Privacy</a>
          <a href="/dmca"    className="sidebar-footer__link">DMCA</a>
          <p className="sidebar-footer__copy">&copy; {new Date().getFullYear()} iku.gg</p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="app-main">
        {children}
      </div>

      {/* ── Right sidebar (desktop 1280px+) ──────────────── */}
      <aside className="app-right-sidebar" aria-label="Trending tags">
        <h3 className="right-sidebar__title">Trending Tags</h3>
        <div className="right-sidebar__tags">
          {[
            "hentai", "anime", "3d", "cosplay", "ahegao",
            "uncensored", "creampie", "maid", "milf",
            "schoolgirl", "elf", "futanari", "tentacle", "gangbang",
          ].map((tag) => (
            <Link
              key={tag}
              href={`/tag/${tag}`}
              className="tag-pill tag-pill--dark"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Mobile bottom nav ────────────────────────────── */}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`bottom-nav__item${isActive(href) ? " bottom-nav__item--active" : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={22} />
            {isActive(href) && (
              <span className="bottom-nav__label">{label}</span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
