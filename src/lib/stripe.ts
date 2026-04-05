/**
 * stripe.ts — Stripe SDK singleton + plan config for iku.gg Pro
 *
 * Pricing:
 *   - Monthly  : 4.99€ (recurring)
 *   - Annual   : 39.99€ (recurring, -33%)
 *   - Lifetime : 69.99€ (one-time, limited spots)
 *
 * Products are created in Stripe Dashboard or via the create-products script.
 * Price IDs are stored in env vars.
 */

import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret && typeof window === "undefined") {
  // Warn at import time in server context — we still export a dummy to let
  // the pricing page render, but anything calling stripe will throw.
  console.warn("STRIPE_SECRET_KEY is not set — Stripe calls will fail");
}

export const stripe = secret
  ? new Stripe(secret, { apiVersion: "2025-09-30.clover" })
  : null;

export interface PricingPlan {
  id: "monthly" | "yearly" | "lifetime";
  name: string;
  priceCents: number;
  currency: string;
  interval: "month" | "year" | "lifetime";
  priceId: string | undefined;
  mostPopular?: boolean;
  discount?: string;
  description: string;
}

export const PLANS: PricingPlan[] = [
  {
    id: "monthly",
    name: "Monthly",
    priceCents: 499,
    currency: "eur",
    interval: "month",
    priceId: process.env.STRIPE_PRICE_MONTHLY,
    description: "Cancel anytime. 4.99€ per month.",
  },
  {
    id: "yearly",
    name: "Annual",
    priceCents: 3999,
    currency: "eur",
    interval: "year",
    priceId: process.env.STRIPE_PRICE_YEARLY,
    mostPopular: true,
    discount: "Save 33%",
    description: "Billed yearly. Effective 3.33€/month.",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    priceCents: 6999,
    currency: "eur",
    interval: "lifetime",
    priceId: process.env.STRIPE_PRICE_LIFETIME,
    discount: "Launch only — 500 spots",
    description: "One-time payment. Forever Pro access.",
  },
];

export function formatPrice(cents: number, currency = "eur"): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Returns the pricing plan config for a given plan id, throwing if unknown. */
export function getPlan(id: string): PricingPlan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}
