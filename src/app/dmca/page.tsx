import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DMCA & Content Removal | iku.gg",
  description:
    "DMCA takedown and content removal process for iku.gg. How to report copyright infringement or illegal content.",
  alternates: { canonical: "https://iku.gg/dmca" },
};

export default function DmcaPage() {
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
          <span style={{ color: "var(--color-text-secondary)" }}>DMCA</span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          DMCA & Content Removal
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
          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            1. Our Commitment
          </h2>
          <p>
            iku.gg respects intellectual property rights and complies with the
            Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512. We respond
            promptly to properly submitted takedown notices and maintain a
            repeat-infringer policy.
          </p>

          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            2. Filing a Takedown Notice
          </h2>
          <p>
            If you are a copyright owner (or authorized agent) and believe that
            content referenced on iku.gg infringes your copyright, please send a
            written notice containing:
          </p>
          <ul style={{ marginLeft: 24, marginTop: 8, marginBottom: 16 }}>
            <li>
              A physical or electronic signature of the copyright owner or
              authorized agent
            </li>
            <li>
              Identification of the copyrighted work claimed to be infringed
            </li>
            <li>
              The full iku.gg URL(s) of the allegedly infringing content (e.g.
              https://iku.gg/watch/...)
            </li>
            <li>Your contact information (name, address, phone, email)</li>
            <li>
              A statement that you have a good-faith belief the use is not
              authorized by the owner, agent, or law
            </li>
            <li>
              A statement, under penalty of perjury, that the information is
              accurate and you are authorized to act on behalf of the owner
            </li>
          </ul>

          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            3. Designated Agent
          </h2>
          <p
            style={{
              marginTop: 8,
              padding: 16,
              border: "1px solid var(--color-border-default)",
              borderRadius: 8,
            }}
          >
            <strong>Email:</strong> dmca@iku.gg
            <br />
            <strong>Response time:</strong> Within 48 hours, resolution within
            72 hours for valid notices.
          </p>

          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            4. Counter-Notice
          </h2>
          <p>
            If you believe your content was removed in error, you may submit a
            counter-notice containing identification of the removed material,
            your contact information, a statement under penalty of perjury that
            the removal was a mistake or misidentification, and your consent to
            jurisdiction.
          </p>

          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            5. Illegal Content Policy
          </h2>
          <p>
            iku.gg has a <strong>zero-tolerance policy</strong> for content
            depicting minors, non-consensual acts, or any other illegal
            material. Multiple layers of automated keyword and tag filtering
            block such content at ingestion and serving time. If you encounter
            material that violates this policy, please report it to{" "}
            <strong>abuse@iku.gg</strong> — it will be removed within 24 hours
            of receipt.
          </p>

          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            6. Repeat Infringer Policy
          </h2>
          <p>
            Accounts, IPs, or partners associated with repeated valid DMCA
            notices will be terminated and barred from further use of iku.gg in
            accordance with 17 U.S.C. § 512(i).
          </p>

          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            7. Related
          </h2>
          <p>
            See also our{" "}
            <Link href="/2257" style={{ color: "var(--color-accent)" }}>
              18 U.S.C. § 2257 Compliance Statement
            </Link>{" "}
            and{" "}
            <Link href="/terms" style={{ color: "var(--color-accent)" }}>
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
