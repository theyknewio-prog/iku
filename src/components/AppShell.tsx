"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── SVG Icons ────────────────────────────────────────────── */

function IconHome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconTrending({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconExplore({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconTag({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconFeed({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconNew({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

/* ── Nav items definition ─────────────────────────────────── */

const NAV_ITEMS = [
  { href: "/",          label: "Home",     Icon: IconHome },
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
      {/* ── Left sidebar (desktop only) ──────────────────── */}
      <aside className="app-sidebar" aria-label="Sidebar navigation">
        {/* Logo */}
        <Link href="/" className="sidebar-logo" aria-label="iku home">
          iku
        </Link>

        {/* Nav links */}
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

        {/* Footer links at bottom of sidebar */}
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

      {/* ── Mobile bottom nav ────────────────────────────── */}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`bottom-nav__item${isActive(href) ? " bottom-nav__item--active" : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
