"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { SearchAutocomplete } from "./SearchAutocomplete";
import { StreakBadge } from "./StreakBadge";

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

function IconMenu({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
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

/* ── User menu (topbar) ─────────────────────────────────────── */

function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  if (status === "loading") {
    return <div className="v2-topbar-avatar" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="v2-topbar-signin">
        Sign in
      </Link>
    );
  }

  const avatar = session.user.avatarEmoji || "🌸";
  const username = session.user.username || session.user.name || "You";

  return (
    <div ref={ref} className="v2-user-menu">
      <button
        type="button"
        className="v2-topbar-avatar v2-topbar-avatar--user"
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        aria-expanded={open}
      >
        <span aria-hidden="true" style={{ fontSize: 18 }}>{avatar}</span>
      </button>
      {open && (
        <div className="v2-user-dropdown" role="menu">
          <div className="v2-user-dropdown__header">
            <div className="v2-user-dropdown__avatar">{avatar}</div>
            <div>
              <div className="v2-user-dropdown__name">{username}</div>
              <div className="v2-user-dropdown__email">{session.user.email}</div>
            </div>
          </div>
          <Link href="/profile" className="v2-user-dropdown__item" onClick={() => setOpen(false)}>👤 Profile</Link>
          <Link href="/favorites" className="v2-user-dropdown__item" onClick={() => setOpen(false)}>❤️ Favorites</Link>
          <Link href="/history" className="v2-user-dropdown__item" onClick={() => setOpen(false)}>🕐 History</Link>
          <Link href="/pricing" className="v2-user-dropdown__item" onClick={() => setOpen(false)}>✨ Go Pro</Link>
          <Link href="/settings" className="v2-user-dropdown__item" onClick={() => setOpen(false)}>⚙️ Settings</Link>
          <button
            type="button"
            className="v2-user-dropdown__item v2-user-dropdown__item--danger"
            onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
          >
            🚪 Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Nav definitions ─────────────────────────────────────────── */

/* Sidebar sections — Discover
 *
 * Note: "Top Rated" used to live here but pointed at /explore?sort=top,
 * which was functionally identical to /trending (both sort by score DESC).
 * Removed to avoid user confusion — use /trending instead.
 */
const DISCOVER_ITEMS = [
  { href: "/",         label: "Home",         Icon: IconHome,     emoji: "🏠" },
  { href: "/trending", label: "Trending",     Icon: IconTrending, emoji: "🔥", badge: "Hot" },
  { href: "/new",      label: "New Releases", Icon: IconNew,      emoji: "🆕" },
  { href: "/feed",     label: "Shorts",       Icon: IconFeed,     emoji: "⚡", badge: "New", badgeGradient: true },
  { href: "/explore",  label: "Explore",      Icon: IconBrowse,   emoji: "🔎" },
] as const;

/* Library */
const LIBRARY_ITEMS = [
  { href: "/favorites", label: "Favorites", Icon: IconHeart,    emoji: "❤️" },
  { href: "/history",   label: "History",   Icon: IconHistory,  emoji: "🕐" },
  { href: "/pricing",   label: "Go Pro",    Icon: IconStar,     emoji: "✨" },
  { href: "/settings",  label: "Settings",  Icon: IconSettings, emoji: "⚙️" },
] as const;

/* Browse */
const BROWSE_ITEMS = [
  { href: "/character", label: "Characters", Icon: IconCharacter, emoji: "👤" },
  { href: "/series",    label: "Series",     Icon: IconSeries,    emoji: "📺" },
  { href: "/tags",      label: "Tags",       Icon: IconTag,       emoji: "🏷️" },
] as const;

/* Affiliate partners — external links, open in new tab */
const AFFILIATE_ITEMS = [
  { href: "https://www.nutaku.net/home/?af=ikugg", label: "Hentai Games", emoji: "\uD83C\uDFAE" },
  { href: "https://t.mbjms.com/410186/9403/0?target=banners&aff_sub5=SF_006OG000004lmDN", label: "AI Hentai", emoji: "\u2728" },
] as const;

/* Extras — content pages that weren't previously reachable from mobile */
const EXTRA_ITEMS = [
  { href: "/blog",     label: "Blog",     Icon: IconBrowse, emoji: "📰" },
  { href: "/pricing",  label: "Pricing",  Icon: IconStar,   emoji: "💎" },
  { href: "/glossary", label: "Glossary", Icon: IconTag,    emoji: "📖" },
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
  { href: "/search",   label: "Search",   Icon: IconSearch,   featured: false },
  { href: "/feed",     label: "Shorts",   Icon: IconFeed,     featured: true },
  { href: "/trending", label: "Trending", Icon: IconTrending, featured: false },
] as const;


/* ── AppShell ─────────────────────────────────────────────────── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Lock body scroll while the full drawer is open */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  /* Close drawer on navigation */
  useEffect(() => {
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

        {/* Affiliate Partners */}
        <div className="v2-sidebar-section">
          <div className="v2-sidebar-section__label">Partners</div>
          {AFFILIATE_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="v2-nav-item v2-nav-item--affiliate"
            >
              <span className="v2-nav-icon" aria-hidden="true">{item.emoji}</span>
              <span className="v2-nav-item__label">{item.label}</span>
              <span className="v2-nav-badge v2-nav-badge--gradient">Ad</span>
            </a>
          ))}
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

        {/* Telegram + Discord CTAs — pinned at the bottom of the sidebar */}
        <div className="v2-sidebar-discord">
          <a
            href="https://t.me/ikudotgg"
            target="_blank"
            rel="noopener noreferrer"
            className="v2-sidebar-discord-btn v2-sidebar-telegram-btn"
            aria-label="Join our Telegram channel"
          >
            <span className="v2-sidebar-discord-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </span>
            <span className="v2-sidebar-discord-btn__text">
              <span className="v2-sidebar-discord-btn__title">Telegram</span>
              <span className="v2-sidebar-discord-btn__sub">Daily videos · trending</span>
            </span>
          </a>
          <a
            href="https://discord.gg/cQZc8trq8N"
            target="_blank"
            rel="noopener noreferrer"
            className="v2-sidebar-discord-btn"
            aria-label="Join our Discord server"
          >
            <span className="v2-sidebar-discord-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </span>
            <span className="v2-sidebar-discord-btn__text">
              <span className="v2-sidebar-discord-btn__title">Join Discord</span>
              <span className="v2-sidebar-discord-btn__sub">Daily drops · watch parties</span>
            </span>
          </a>
        </div>

      </aside>

      {/* TOPBAR */}
      <header className={`v2-topbar${scrolled ? " v2-topbar--scrolled" : ""}`}>

        {/* Mobile hamburger — opens the full nav drawer */}
        <button
          type="button"
          className="v2-topbar-hamburger"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
        </button>

        {/* Mobile logo */}
        <Link href="/" prefetch={true} className="v2-topbar__logo" aria-label="iku home">
          <span className="v2-topbar__logo-text">iku</span>
        </Link>

        <div className="v2-topbar__search-area">
          <SearchAutocomplete />
        </div>

        {/* Stats chip */}
        <div className="v2-stats-chip">
          <span className="v2-stats-chip__sparkle">✨</span>
          <span>353,247 videos</span>
        </div>

        <div className="v2-topbar__actions">
          <StreakBadge />
          <Link href="/favorites" className="v2-topbar-btn" title="Favorites" aria-label="Favorites">
            <span aria-hidden="true" style={{ fontSize: 18 }}>❤️</span>
          </Link>
          <UserMenu />
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

      {/* More -- opens the same full drawer as the topbar hamburger */}
      <button
        type="button"
        className={`v2-bottom-nav__item${menuOpen ? " v2-bottom-nav__item--active" : ""}`}
        aria-label="More options"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {menuOpen ? <IconClose size={22} /> : <IconMore size={22} />}
        <span className="v2-bottom-nav__label">More</span>
      </button>
    </nav>

    {/* FULL MOBILE DRAWER — shared between topbar hamburger and bottom "More" */}
    {menuOpen && (
      <>
        <div
          className="v2-nav-drawer-overlay"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Full navigation menu"
          className="v2-nav-drawer"
        >
          <div className="v2-nav-drawer__header">
            <Link href="/" className="v2-nav-drawer__logo" onClick={() => setMenuOpen(false)}>
              <span>iku.gg ✨</span>
              <small>353K+ free videos</small>
            </Link>
            <button
              type="button"
              className="v2-nav-drawer__close"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <IconClose size={22} />
            </button>
          </div>

          <div className="v2-nav-drawer__body">
            <div className="v2-nav-drawer__section">
              <div className="v2-nav-drawer__section-label">Discover</div>
              {(DISCOVER_ITEMS as unknown as NavItem[]).map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={`v2-nav-drawer__item${isActive(item.href) ? " v2-nav-drawer__item--active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="v2-nav-drawer__emoji" aria-hidden>{item.emoji}</span>
                  <span className="v2-nav-drawer__label">{item.label}</span>
                  {item.badge && (
                    <span className={`v2-nav-drawer__badge${item.badgeGradient ? " v2-nav-drawer__badge--gradient" : ""}`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            <div className="v2-nav-drawer__section">
              <div className="v2-nav-drawer__section-label">My Library</div>
              {LIBRARY_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`v2-nav-drawer__item${isActive(item.href) ? " v2-nav-drawer__item--active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="v2-nav-drawer__emoji" aria-hidden>{item.emoji}</span>
                  <span className="v2-nav-drawer__label">{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="v2-nav-drawer__section">
              <div className="v2-nav-drawer__section-label">Browse</div>
              {BROWSE_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`v2-nav-drawer__item${isActive(item.href) ? " v2-nav-drawer__item--active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="v2-nav-drawer__emoji" aria-hidden>{item.emoji}</span>
                  <span className="v2-nav-drawer__label">{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="v2-nav-drawer__section">
              <div className="v2-nav-drawer__section-label">Partners</div>
              {AFFILIATE_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="v2-nav-drawer__item v2-nav-drawer__item--affiliate"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="v2-nav-drawer__emoji" aria-hidden>{item.emoji}</span>
                  <span className="v2-nav-drawer__label">{item.label}</span>
                  <span className="v2-nav-drawer__badge v2-nav-drawer__badge--gradient">Ad</span>
                </a>
              ))}
            </div>

            <div className="v2-nav-drawer__section">
              <div className="v2-nav-drawer__section-label">More</div>
              {EXTRA_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`v2-nav-drawer__item${isActive(item.href) ? " v2-nav-drawer__item--active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="v2-nav-drawer__emoji" aria-hidden>{item.emoji}</span>
                  <span className="v2-nav-drawer__label">{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="v2-nav-drawer__section">
              <div className="v2-nav-drawer__section-label">Quick Tags</div>
              <div className="v2-nav-drawer__tags">
                {QUICK_TAGS.map((tag) => (
                  <Link
                    key={tag.label}
                    href={tag.href}
                    className={`v2-nav-drawer__tag v2-nav-drawer__tag--${tag.color}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {tag.label}
                  </Link>
                ))}
              </div>
            </div>

            <a
              href="https://discord.gg/cQZc8trq8N"
              target="_blank"
              rel="noopener noreferrer"
              className="v2-nav-drawer__discord"
              onClick={() => setMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <div>
                <strong>Join Discord</strong>
                <small>Daily drops · watch parties</small>
              </div>
            </a>
          </div>
        </aside>
      </>
    )}
  </>
  );
}
