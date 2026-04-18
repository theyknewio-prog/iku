import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "18 U.S.C. § 2257 Compliance Statement | iku.gg",
  description:
    "18 U.S.C. § 2257 Record-Keeping Requirements Compliance Statement for iku.gg. Animated content only — exempt under 28 C.F.R. § 75.1(c).",
  alternates: { canonical: "https://iku.gg/2257" },
};

const h2: React.CSSProperties = {
  color: "var(--color-text-primary)",
  fontSize: 20,
  fontWeight: 700,
  marginTop: 32,
  marginBottom: 12,
};

export default function Statement2257Page() {
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
            18 U.S.C. § 2257
          </span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          18 U.S.C. § 2257 Compliance Statement
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
          <h2 style={h2}>1. Exemption — Animated Content Only</h2>
          <p>
            All visual content displayed, embedded, or linked on iku.gg consists
            exclusively of{" "}
            <strong>
              animated, drawn, illustrated or computer-generated depictions of
              fictional characters
            </strong>
            . No real human beings are depicted in any content on iku.gg.
          </p>
          <p>
            For that reason, the records-keeping requirements of{" "}
            <strong>18 U.S.C. § 2257</strong> and{" "}
            <strong>28 C.F.R. Part 75</strong> do not apply, per the exemption
            at <strong>28 C.F.R. § 75.1(c)</strong>: the statute applies only to
            visual depictions of <em>actual human beings</em> engaged in
            sexually explicit conduct, and expressly excludes drawings,
            animations, cartoons, sculptures, paintings and other depictions
            that do not involve a real person.
          </p>

          <h2 style={h2}>2. No Depictions of Minors</h2>
          <p>
            iku.gg enforces a strict <strong>zero-tolerance policy</strong>{" "}
            against any content depicting minors, whether real or fictional, or
            content that would be obscene under applicable U.S. or international
            law. Multiple layers of automated keyword and tag filtering operate
            at content ingestion and at serving time to block any such material.
          </p>
          <p>
            To report content that violates this policy, email{" "}
            <strong>abuse@iku.gg</strong>. Reported material is reviewed and
            removed within 24 hours of a valid notice.
          </p>

          <h2 style={h2}>3. Copyright &amp; Takedowns</h2>
          <p>
            For copyright-related requests, see our{" "}
            <Link href="/dmca" style={{ color: "var(--color-accent)" }}>
              DMCA policy
            </Link>
            .
          </p>

          <h2 style={h2}>4. Contact</h2>
          <p
            style={{
              marginTop: 8,
              padding: 16,
              border: "1px solid var(--color-border-default)",
              borderRadius: 8,
            }}
          >
            <strong>Compliance email:</strong> compliance@iku.gg
            <br />
            <strong>Abuse / illegal content:</strong> abuse@iku.gg
            <br />
            <strong>DMCA agent:</strong> dmca@iku.gg
          </p>
        </section>
      </div>
    </main>
  );
}
