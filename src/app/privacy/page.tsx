import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | iku.gg",
  description:
    "Privacy Policy for iku.gg. How we handle data, cookies, advertising, payments, and your rights under GDPR and CCPA.",
  alternates: { canonical: "https://iku.gg/privacy" },
};

const h2: React.CSSProperties = {
  color: "var(--color-text-primary)",
  fontSize: 20,
  fontWeight: 700,
  marginTop: 32,
  marginBottom: 12,
};

export default function PrivacyPage() {
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
            Privacy Policy
          </span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          Privacy Policy
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
            This Privacy Policy explains what information iku.gg collects, how
            it is used, and the rights you have over it. By using iku.gg you
            agree to the practices described here. If you do not agree, please
            do not use the service.
          </p>

          <h2 style={h2}>1. Information We Collect</h2>
          <p>
            Browsing iku.gg does <strong>not</strong> require an account. For
            visitors who do create an optional account (for favorites, watch
            history sync, Premium, or Discord features), we collect:
          </p>
          <ul style={{ marginLeft: 24, marginTop: 8, marginBottom: 16 }}>
            <li>
              Email address (for sign-in, verification and password reset)
            </li>
            <li>
              A hashed password (bcrypt; we never store plain-text passwords)
            </li>
            <li>
              If you sign in with Discord: your Discord user ID, username,
              avatar URL, and email — provided by Discord under their OAuth
              consent screen
            </li>
            <li>
              Account activity: score, streaks, favorites, watch history,
              completed quests
            </li>
          </ul>

          <h2 style={h2}>2. Cookies &amp; Local Storage</h2>
          <p>
            We use a small number of cookies and <strong>localStorage</strong>{" "}
            entries for:
          </p>
          <ul style={{ marginLeft: 24, marginTop: 8, marginBottom: 16 }}>
            <li>Your age-verification confirmation (18+)</li>
            <li>Session cookies for signed-in users (NextAuth)</li>
            <li>Watch history, favorites, and blacklisted tags (local only)</li>
            <li>
              Anti-fraud / DDoS protection cookies set by our CDN (Cloudflare)
            </li>
          </ul>
          <p>
            You can clear all of this at any time via your browser settings.
          </p>

          <h2 style={h2}>3. Server Logs</h2>
          <p>
            Our servers log HTTP requests for security, rate limiting and abuse
            prevention. Logs contain IP address, User-Agent, requested URL and
            timestamp. Logs are rotated automatically and are not shared with
            third parties except where required by law or to investigate abuse.
          </p>

          <h2 style={h2}>4. Analytics</h2>
          <p>
            We use privacy-friendly product analytics (PostHog, EU / US cloud)
            to understand aggregate site usage (page views, session length,
            feature engagement). We do not sell analytics data.
          </p>

          <h2 style={h2}>5. Advertising</h2>
          <p>
            iku.gg displays advertising from third-party ad networks. These
            networks may set their own cookies or use similar technologies to
            deliver and measure ads, and may collect limited data such as IP
            address, device type, coarse location and ad interactions. We do not
            share your email, account identifiers or watch history with ad
            networks. Please consult each network's own privacy policy for
            details.
          </p>

          <h2 style={h2}>6. Payments</h2>
          <p>
            iku.gg Premium payments are processed by{" "}
            <strong>Stripe, Inc.</strong> We do not see or store full payment
            card numbers. Stripe's privacy policy is available at{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)" }}
            >
              stripe.com/privacy
            </a>
            .
          </p>

          <h2 style={h2}>7. CDN &amp; DDoS Protection</h2>
          <p>
            iku.gg is served through Cloudflare, which may process requests and
            set security cookies to mitigate abuse. See Cloudflare's privacy
            policy at{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)" }}
            >
              cloudflare.com/privacypolicy
            </a>
            .
          </p>

          <h2 style={h2}>8. Data Retention</h2>
          <p>
            Account data is kept for as long as your account exists. Server logs
            are retained for up to 30 days. Backup copies may persist for up to
            90 days before rotation. Deleting your account removes your personal
            identifiers from the live database.
          </p>

          <h2 style={h2}>9. Your Rights (GDPR / CCPA)</h2>
          <p>Regardless of where you live, you may request to:</p>
          <ul style={{ marginLeft: 24, marginTop: 8, marginBottom: 16 }}>
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account and associated data</li>
            <li>Export your data in a portable format</li>
            <li>
              Opt out of the "sale" or "sharing" of personal information —
              iku.gg does not sell personal information
            </li>
          </ul>
          <p>
            To exercise these rights, email <strong>privacy@iku.gg</strong>. We
            respond within 30 days.
          </p>

          <h2 style={h2}>10. Children</h2>
          <p>
            iku.gg is an adult-only service strictly restricted to users aged{" "}
            <strong>eighteen (18) or older</strong> (or the age of majority in
            your jurisdiction, whichever is greater). We do not knowingly
            collect information from anyone under 18. If you believe a minor has
            provided us information, contact <strong>abuse@iku.gg</strong> and
            we will delete it immediately.
          </p>

          <h2 style={h2}>11. International Transfers</h2>
          <p>
            Our servers are located in the European Union. By using iku.gg you
            consent to the transfer and processing of your information in the EU
            and any third country where our subprocessors (Stripe, Cloudflare,
            Resend, PostHog) operate, under appropriate safeguards.
          </p>

          <h2 style={h2}>12. Changes</h2>
          <p>
            We may update this policy as the service evolves. The "Last updated"
            date above reflects the most recent revision. Material changes will
            be announced on the site.
          </p>

          <h2 style={h2}>13. Contact</h2>
          <p>
            Privacy questions: <strong>privacy@iku.gg</strong>
            <br />
            Abuse / illegal content: <strong>abuse@iku.gg</strong>
            <br />
            Copyright / DMCA: see our{" "}
            <Link href="/dmca" style={{ color: "var(--color-accent)" }}>
              DMCA page
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
