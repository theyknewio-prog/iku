export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container">
        <div className="site-footer__links">
          <a href="/terms" className="site-footer__link">
            Terms
          </a>
          <a href="/privacy" className="site-footer__link">
            Privacy
          </a>
          <a href="/dmca" className="site-footer__link">
            DMCA
          </a>
        </div>
        <p className="site-footer__copy">
          &copy; {new Date().getFullYear()} iku.gg — Free Hentai Videos
        </p>
      </div>
    </footer>
  );
}
