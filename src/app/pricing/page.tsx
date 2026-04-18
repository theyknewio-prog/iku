import type { Metadata } from "next";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { PLANS, formatPrice } from "@/lib/stripe";
import { PricingClient } from "./pricing-client";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

export const metadata: Metadata = {
  title: "iku.gg Pro — Remove ads, unlimited favorites, early access",
  description:
    "Unlock the best of iku.gg — zero ads, unlimited favorites, early access to new clips, Discord Pro channel, and more. From 4.99€/month.",
};

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "🚫",
    name: "Zero ads — ever",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "❤️",
    name: "Unlimited favorites",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "📚",
    name: "Extended watch history",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "🎯",
    name: "Early access (48h before public)",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "💎",
    name: "Pro badge on profile + Discord",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "📂",
    name: "Unlimited playlists",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "⚡",
    name: "Priority video loading",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "🎮",
    name: "Pro-only Discord channels",
    included: ["monthly", "yearly", "lifetime"],
  },
  {
    icon: "🏆",
    name: "Vote on featured content",
    included: ["yearly", "lifetime"],
  },
  { icon: "👑", name: "Lifetime access — forever", included: ["lifetime"] },
];

export default async function PricingPage() {
  const session = await auth();
  let currentPlan: string | null = null;
  let tierDiscount = false;
  let unverifiedEmail: string | null = null;

  if (session?.user?.id) {
    const { rows } = await pool.query(
      `SELECT u.pro_status, u.pro_plan, u.email, u.email_verified, s.score
       FROM users u
       LEFT JOIN user_stats s ON s.user_id = u.id
       WHERE u.id = $1`,
      [session.user.id],
    );
    const row = rows[0];
    if (row?.pro_status === "active" || row?.pro_status === "lifetime") {
      currentPlan = row.pro_plan;
    }
    // Waifu Scholar tier (15k+) gets 30% off auto-applied at checkout
    if (row?.score >= 15000) tierDiscount = true;
    // Unverified email + not a Discord-synthetic → show banner (checkout will
    // be blocked server-side by the checkout route until verified).
    if (
      row?.email &&
      !row.email_verified &&
      !String(row.email).endsWith("@discord.iku.gg")
    ) {
      unverifiedEmail = row.email;
    }
  }

  const plans = PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    priceLabel: formatPrice(p.priceCents, p.currency),
    interval: p.interval,
    mostPopular: p.mostPopular || false,
    discount: p.discount,
    description: p.description,
    features: FEATURES.filter((f) => f.included.includes(p.id)),
    available: Boolean(p.priceId),
  }));

  return (
    <main className="pricing-page">
      <div className="pricing-container">
        {unverifiedEmail && (
          <EmailVerificationBanner
            email={unverifiedEmail}
            blocking="upgrade to Pro"
          />
        )}
        <div className="pricing-hero">
          <h1 className="pricing-title">
            Go <span className="pricing-title__highlight">Pro</span> ✨
          </h1>
          <p className="pricing-sub">
            Zero ads, unlimited favorites, early access, and full Discord Pro
            perks. Cancel anytime.
          </p>
          {tierDiscount && (
            <div className="pricing-tier-badge">
              💎 Waifu Scholar discount: <strong>30% off</strong> auto-applied
            </div>
          )}
        </div>

        <PricingClient
          plans={plans}
          isAuthenticated={Boolean(session?.user?.id)}
          currentPlan={currentPlan}
        />

        <div className="pricing-features-table">
          <h2>What's included</h2>
          <ul>
            {FEATURES.map((f) => (
              <li key={f.name}>
                <span className="pricing-feature__icon">{f.icon}</span>
                <span className="pricing-feature__name">{f.name}</span>
                {f.included.length < 3 && (
                  <span className="pricing-feature__limit">
                    {f.included.includes("yearly") &&
                    !f.included.includes("monthly")
                      ? "Annual + Lifetime only"
                      : "Lifetime only"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="pricing-faq">
          <h2>Questions</h2>
          <details>
            <summary>Can I cancel anytime?</summary>
            <p>
              Yes — cancel from your profile or via Stripe. You keep Pro access
              until the end of your current billing period.
            </p>
          </details>
          <details>
            <summary>Is the lifetime deal really forever?</summary>
            <p>
              Yes. One-time payment, Pro access as long as iku.gg exists.
              Limited to 500 spots at launch — first come first served.
            </p>
          </details>
          <details>
            <summary>What payment methods do you accept?</summary>
            <p>
              All major credit and debit cards via Stripe. Payments are secure
              and processed with a neutral descriptor on your bank statement.
            </p>
          </details>
          <details>
            <summary>Do I need to enter my real name?</summary>
            <p>
              No — Stripe only requires a valid payment method. Your username on
              the site stays private.
            </p>
          </details>
          <details>
            <summary>Can I upgrade from monthly to annual?</summary>
            <p>
              Yes. Cancel the monthly plan, wait until the period ends, then
              subscribe annually. Or email us and we'll switch you over
              mid-cycle.
            </p>
          </details>
        </div>
      </div>
    </main>
  );
}
