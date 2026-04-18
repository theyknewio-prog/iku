import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | iku.gg",
  description:
    "Terms of Service for iku.gg — free animated hentai streaming platform. Age requirements, content policy, user conduct, and legal compliance.",
  alternates: { canonical: "https://iku.gg/terms" },
};

const h2: React.CSSProperties = {
  color: "var(--color-text-primary)",
  fontSize: 20,
  fontWeight: 700,
  marginTop: 32,
  marginBottom: 12,
};

export default function TermsPage() {
  return (
    <main className="v2-page">
      <div
        className="v2-content"
        style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px" }}
      >
        <nav
          style={{
            fontSize: 13,
            color: "var(--color-text-tertiary)",
            marginBottom: 16,
          }}
        >
          <Link href="/" style={{ color: "var(--color-text-tertiary)" }}>
            Home
          </Link>
          {" / "}
          <span style={{ color: "var(--color-text-secondary)" }}>
            Terms of Service
          </span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginBottom: 32 }}>
          Last updated: April 18, 2026
        </p>

        <section
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: 1.7,
            fontSize: 15,
          }}
        >
          <p>
            These Terms of Service ("Terms") govern your access to and use of
            iku.gg (the "Service"). By using the Service, you agree to these
            Terms. If you do not agree, do not use the Service.
          </p>

          <h2 style={h2}>1. Age Requirement</h2>
          <p>
            iku.gg contains sexually explicit, adult-oriented content. By
            accessing the Service you represent and warrant that you are at
            least <strong>eighteen (18) years old</strong>, or the age of
            majority in your jurisdiction, whichever is greater. Access by
            minors is strictly prohibited and constitutes a material breach of
            these Terms.
          </p>

          <h2 style={h2}>2. Nature of the Service</h2>
          <p>
            iku.gg is an index and playback interface for publicly available
            animated adult content. All visual content depicts{" "}
            <strong>fictional, animated characters</strong> — no real persons
            are depicted. The Service links to or embeds content licensed,
            published or otherwise made publicly available by third-party
            publishers.
          </p>

          <h2 style={h2}>3. Content Policy</h2>
          <p>
            iku.gg enforces a <strong>zero-tolerance policy</strong> against
            content depicting minors (real or fictional), non-consensual acts,
            bestiality, or any other content prohibited by applicable law.
            Multiple automated filters operate at ingestion and serving time to
            block such content. To report material that violates this policy,
            email <strong>abuse@iku.gg</strong>. See our{" "}
            <Link href="/dmca" style={{ color: "var(--color-accent)" }}>
              DMCA policy
            </Link>{" "}
            for copyright takedowns and our{" "}
            <Link href="/2257" style={{ color: "var(--color-accent)" }}>
              18 U.S.C. § 2257 statement
            </Link>
            .
          </p>

          <h2 style={h2}>4. Accounts</h2>
          <p>
            An account is optional. You are responsible for maintaining the
            confidentiality of your credentials and for all activity under your
            account. You may delete your account at any time from your profile
            settings or by emailing <strong>privacy@iku.gg</strong>.
          </p>

          <h2 style={h2}>5. User Conduct</h2>
          <p>You agree not to:</p>
          <ul style={{ marginLeft: 24, marginTop: 8, marginBottom: 16 }}>
            <li>use the Service for any unlawful purpose</li>
            <li>
              attempt to gain unauthorized access to our systems or bypass
              security measures
            </li>
            <li>crawl, index, or mirror the Service at scale</li>
            <li>
              redistribute, rebrand or rehost the user experience, UI, or
              branding of iku.gg
            </li>
            <li>
              upload, post or transmit content that infringes any third-party
              rights or violates these Terms
            </li>
            <li>
              use the Service to harass, threaten, or defame any individual
            </li>
          </ul>

          <h2 style={h2}>6. Premium Subscription</h2>
          <p>
            Optional paid plans ("iku.gg Premium") remove advertising and unlock
            additional features. Subscriptions renew automatically at the end of
            each billing period unless canceled. You may cancel at any time from
            your profile; access continues until the end of the current paid
            period. No refunds for partial periods except where required by law.
          </p>

          <h2 style={h2}>7. Advertising</h2>
          <p>
            Free use of the Service is supported by third-party advertising.
            iku.gg is not responsible for the content of third-party ads. Ads
            are subject to the advertising network's own terms and privacy
            policies.
          </p>

          <h2 style={h2}>8. Intellectual Property</h2>
          <p>
            The iku.gg brand, logo, UI code, written editorial content
            (articles, glossary, captions) and curated metadata are the property
            of iku.gg or its licensors and are protected by copyright and
            trademark law. The underlying animated works belong to their
            respective rights holders.
          </p>

          <h2 style={h2}>9. No Warranty</h2>
          <p>
            iku.gg is provided "as-is" and "as-available" without warranties of
            any kind, express or implied. We do not guarantee availability,
            accuracy, completeness, or fitness for any particular purpose.
          </p>

          <h2 style={h2}>10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, iku.gg and its operators
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits or
            revenues, arising from your use of the Service.
          </p>

          <h2 style={h2}>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless iku.gg, its operators,
            affiliates and contractors from any claim or demand arising out of
            your use of the Service or your breach of these Terms.
          </p>

          <h2 style={h2}>12. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time
            for any reason, including breach of these Terms. Upon termination,
            sections that by their nature should survive (ownership,
            disclaimers, indemnities, limitations of liability) will survive.
          </p>

          <h2 style={h2}>13. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction in which
            iku.gg's operator is established, without regard to conflict-of-law
            principles. Any dispute shall be brought in the competent courts of
            that jurisdiction.
          </p>

          <h2 style={h2}>14. Changes</h2>
          <p>
            We may update these Terms from time to time. The "Last updated" date
            above reflects the most recent revision. Continued use of the
            Service after changes take effect constitutes acceptance of the
            revised Terms.
          </p>

          <h2 style={h2}>15. Contact</h2>
          <p>
            Questions about these Terms:{" "}
            <Link href="/contact" style={{ color: "var(--color-accent)" }}>
              contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
