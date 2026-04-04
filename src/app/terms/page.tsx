import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | iku.gg",
  description: "Terms of Service for iku.gg — free animated hentai streaming platform. Age requirements, content policy, user conduct, and legal compliance.",
  alternates: { canonical: "https://iku.gg/terms" },
};

export default function TermsPage() {
  return (
    <main className="v2-page">
      <div className="v2-content" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px" }}>
        <nav style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginBottom: 16 }}>
          <Link href="/" style={{ color: "var(--color-text-tertiary)" }}>Home</Link>
          {" / "}
          <span style={{ color: "var(--color-text-secondary)" }}>Terms of Service</span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: "var(--color-text-tertiary)", marginBottom: 32 }}>
          Last updated: April 4, 2026
        </p>

        <section style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, fontSize: 15 }}>
          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>1. Age Requirement</h2>
          <p>
            iku.gg contains sexually explicit, adult-oriented content. By accessing this site you
            represent and warrant that you are at least <strong>eighteen (18) years old</strong>, or
            the age of majority in your jurisdiction, whichever is greater. Access by minors is
            strictly prohibited.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>2. Content</h2>
          <p>
            All visual content on iku.gg depicts fictional, animated characters. iku.gg does not
            host video files directly; we aggregate publicly available content from third-party
            sources (Danbooru, Gelbooru, Rule34, Rule34Video, and various hentai streaming sites).
            Any content depicting minors or non-consensual scenarios is strictly prohibited and
            removed upon identification. See our{" "}
            <Link href="/dmca" style={{ color: "var(--color-accent)" }}>DMCA policy</Link> for
            takedown requests.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>3. User Conduct</h2>
          <p>
            You agree not to use iku.gg for any unlawful purpose, not to attempt unauthorized access
            to our systems, not to scrape content at scale, and not to redistribute our user
            experience or branding.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>4. No Warranty</h2>
          <p>
            iku.gg is provided "as-is" without warranties of any kind. We do not guarantee
            availability, accuracy, or fitness for any particular purpose.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>5. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, iku.gg and its operators shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages arising from
            your use of the service.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>6. Changes</h2>
          <p>
            We may update these terms at any time. Continued use of iku.gg after changes
            constitutes acceptance of the revised terms.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>7. Contact</h2>
          <p>
            For questions about these terms or to report a violation, please contact us via the{" "}
            <Link href="/dmca" style={{ color: "var(--color-accent)" }}>DMCA page</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
