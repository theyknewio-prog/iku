import Link from "next/link";

interface SiteHeaderProps {
  activePath?: "trending" | "new" | "tags" | "home";
}

export function SiteHeader({ activePath }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__logo">
          iku
        </Link>

        <nav className="site-header__nav">
          <Link
            href="/"
            className={`nav-link${activePath === "home" ? " nav-link--active" : ""}`}
          >
            Home
          </Link>
          <Link
            href="/trending"
            className={`nav-link${activePath === "trending" ? " nav-link--active" : ""}`}
          >
            Trending
          </Link>
          <Link
            href="/new"
            className={`nav-link${activePath === "new" ? " nav-link--active" : ""}`}
          >
            New
          </Link>
          <Link
            href="/tags"
            className={`nav-link${activePath === "tags" ? " nav-link--active" : ""}`}
          >
            Tags
          </Link>
        </nav>
      </div>
    </header>
  );
}
