import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact | iku.gg",
  description:
    "Contact iku.gg — support, legal, privacy, DMCA, abuse, compliance, and business inquiries.",
  alternates: { canonical: "https://iku.gg/contact" },
};

type ContactRow = {
  label: string;
  email: string;
  desc: string;
  href?: string;
};

const rows: ContactRow[] = [
  {
    label: "General support",
    email: "hello@iku.gg",
    desc: "Questions about the site, bug reports, feature requests.",
  },
  {
    label: "Abuse / illegal content",
    email: "abuse@iku.gg",
    desc: "Report content that violates our zero-tolerance policy. Reviewed within 24 hours.",
  },
  {
    label: "DMCA / copyright",
    email: "dmca@iku.gg",
    desc: "Copyright takedown notices. See our DMCA page for requirements.",
    href: "/dmca",
  },
  {
    label: "Privacy & data requests",
    email: "privacy@iku.gg",
    desc: "GDPR / CCPA access, correction, deletion, and export requests.",
    href: "/privacy",
  },
  {
    label: "Compliance (18 U.S.C. § 2257)",
    email: "compliance@iku.gg",
    desc: "Records-keeping and compliance inquiries.",
    href: "/2257",
  },
  {
    label: "Business / partnerships",
    email: "business@iku.gg",
    desc: "Advertising, partnerships, press, and other commercial inquiries.",
  },
];

export default function ContactPage() {
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
          <span style={{ color: "var(--color-text-secondary)" }}>Contact</span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          Contact
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginBottom: 32 }}>
          Pick the inbox that matches your request for the fastest response.
        </p>

        <section
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: 1.7,
            fontSize: 15,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            {rows.map((r) => (
              <div
                key={r.email}
                style={{
                  padding: 16,
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 10,
                  background:
                    "var(--color-bg-secondary, rgba(255,255,255,0.02))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>
                    {r.label}
                  </strong>
                  <a
                    href={`mailto:${r.email}`}
                    style={{
                      color: "var(--color-accent)",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {r.email}
                  </a>
                </div>
                <p style={{ marginTop: 6, fontSize: 14 }}>
                  {r.desc}
                  {r.href && (
                    <>
                      {" "}
                      <Link
                        href={r.href}
                        style={{ color: "var(--color-accent)" }}
                      >
                        Learn more →
                      </Link>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>

          <h2
            style={{
              color: "var(--color-text-primary)",
              fontSize: 20,
              fontWeight: 700,
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            Response times
          </h2>
          <ul style={{ marginLeft: 24 }}>
            <li>Abuse / illegal content: within 24 hours</li>
            <li>
              DMCA notices: acknowledged within 48 hours, resolved within 72
              hours for valid notices
            </li>
            <li>Privacy requests: within 30 days (GDPR / CCPA)</li>
            <li>General &amp; business: typically 2–5 business days</li>
          </ul>

          <p
            style={{
              marginTop: 24,
              fontSize: 13,
              color: "var(--color-text-tertiary)",
            }}
          >
            iku.gg does not provide a phone number. All correspondence is
            handled over email so we can keep an auditable record of every
            request.
          </p>
        </section>
      </div>
    </main>
  );
}
