import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DMCA & Content Removal | iku.gg",
  description: "DMCA takedown and content removal process for iku.gg. How to report copyright infringement or illegal content.",
  alternates: { canonical: "https://iku.gg/dmca" },
};

export default function DmcaPage() {
  return (
    <main className="v2-page">
      <div className="v2-content" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px" }}>
        <nav style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginBottom: 16 }}>
          <Link href="/" style={{ color: "var(--color-text-tertiary)" }}>Home</Link>
          {" / "}
          <span style={{ color: "var(--color-text-secondary)" }}>DMCA</span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>DMCA & Content Removal</h1>
        <p style={{ color: "var(--color-text-tertiary)", marginBottom: 32 }}>
          Last updated: April 4, 2026
        </p>

        <section style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, fontSize: 15 }}>
          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>1. Our Role</h2>
          <p>
            iku.gg does not host video files. We aggregate metadata (titles, tags, thumbnails) and
            references to content that is publicly available on third-party platforms, including
            Danbooru, Gelbooru, Rule34.xxx, Rule34Video, and several WordPress-based hentai streaming
            sites. Videos are streamed from those sources on demand.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>2. Removal Requests</h2>
          <p>
            If you believe that content referenced on iku.gg infringes your copyright, or if
            you want a specific video delisted for any other legitimate reason, please submit a
            request containing:
          </p>
          <ul style={{ marginLeft: 24, marginTop: 8, marginBottom: 16 }}>
            <li>The full iku.gg URL of the content (e.g. https://iku.gg/watch/...)</li>
            <li>A description of the work you own and how it is infringed</li>
            <li>Your contact information</li>
            <li>A statement made in good faith that the use is not authorized</li>
            <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act</li>
          </ul>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>3. Illegal Content</h2>
          <p>
            iku.gg has a <strong>zero-tolerance policy</strong> for content depicting minors,
            non-consensual acts, or any illegal material. Our scrapers filter against a maintained
            list of banned tags and keywords at the database level, and individual content can
            still be blocked server-side. If you find such content despite our filters, please
            report it immediately and it will be removed within 24 hours.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>4. How to Submit</h2>
          <p>
            Send your request via the contact form or email below. We typically respond within 48
            hours and honor valid removal requests within 72 hours.
          </p>
          <p style={{ marginTop: 16, padding: 16, border: "1px solid var(--color-border-default)", borderRadius: 8 }}>
            <strong>Contact:</strong> dmca@iku.gg
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>5. Counter-Notice</h2>
          <p>
            If you believe your content was removed in error, you may submit a counter-notice
            containing the same information as a removal request plus a statement that you have a
            good faith belief the material was removed in error.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>6. 18 U.S.C. § 2257 Compliance Notice</h2>
          <p>
            All visual content on iku.gg is fictional, computer-generated, or animated. No
            depictions of real human performers are hosted or referenced. As such, iku.gg is not
            subject to 18 U.S.C. § 2257 record-keeping requirements, as no real human persons are
            depicted.
          </p>
        </section>
      </div>
    </main>
  );
}
