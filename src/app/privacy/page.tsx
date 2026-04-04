import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | iku.gg",
  description: "Privacy Policy for iku.gg. How we handle data, cookies, third-party services, and your rights as a visitor.",
  alternates: { canonical: "https://iku.gg/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="v2-page">
      <div className="v2-content" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px" }}>
        <nav style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginBottom: 16 }}>
          <Link href="/" style={{ color: "var(--color-text-tertiary)" }}>Home</Link>
          {" / "}
          <span style={{ color: "var(--color-text-secondary)" }}>Privacy Policy</span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: "var(--color-text-tertiary)", marginBottom: 32 }}>
          Last updated: April 4, 2026
        </p>

        <section style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, fontSize: 15 }}>
          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>1. Data We Don't Collect</h2>
          <p>
            iku.gg does not require an account. We do not collect names, email addresses, phone
            numbers, or any other personally identifiable information from visitors.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>2. Cookies & Local Storage</h2>
          <p>
            We use <strong>localStorage</strong> (not cookies) to remember:
          </p>
          <ul style={{ marginLeft: 24, marginTop: 8, marginBottom: 16 }}>
            <li>Your age verification confirmation</li>
            <li>Your watch history (for the /history page)</li>
            <li>Your favorites (for the /favorites page)</li>
            <li>Your blacklisted tags (for content filtering)</li>
          </ul>
          <p>
            All of this data stays in your browser and is never transmitted to our servers. You
            can clear it anytime via your browser settings.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>3. Server Logs</h2>
          <p>
            Our servers log HTTP requests for security, rate limiting, and abuse prevention. Logs
            contain IP addresses, User-Agent strings, and timestamps. They are automatically
            rotated and not shared with third parties except as required by law.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>4. Third-Party Content</h2>
          <p>
            Videos and images on iku.gg are embedded or streamed from third-party sources
            (Danbooru, Gelbooru, Rule34, Rule34Video, and various WordPress-based hentai sites).
            Those third parties may collect their own analytics when their content loads. We have
            no control over their privacy practices.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>5. CDN & DDoS Protection</h2>
          <p>
            iku.gg sits behind Cloudflare, which may process requests and set security cookies
            for DDoS protection. See Cloudflare's own privacy policy at{" "}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)" }}>cloudflare.com/privacypolicy</a>.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>6. Your Rights</h2>
          <p>
            Since we don't store personal data on our servers, there is nothing to request, export,
            or delete. You control all persistent data in your own browser.
          </p>

          <h2 style={{ color: "var(--color-text-primary)", fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>7. Contact</h2>
          <p>
            For privacy questions, use the contact methods on our{" "}
            <Link href="/dmca" style={{ color: "var(--color-accent)" }}>DMCA page</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
