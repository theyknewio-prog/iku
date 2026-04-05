/**
 * scripts/stripe-create-products.mjs
 *
 * Creates the iku.gg Pro products and prices in Stripe, idempotent via lookup_key.
 * Run once at launch, or re-run safely to re-create if deleted.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-create-products.mjs
 *
 * Outputs env vars to append to Coolify/.env:
 *   STRIPE_PRICE_MONTHLY=price_xxx
 *   STRIPE_PRICE_YEARLY=price_xxx
 *   STRIPE_PRICE_LIFETIME=price_xxx
 */

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) { console.error("Missing STRIPE_SECRET_KEY"); process.exit(1); }

const stripe = new Stripe(KEY, { apiVersion: "2025-09-30.clover" });

/** Create or find product by name. Returns the product. */
async function ensureProduct(name, description) {
  const list = await stripe.products.list({ limit: 100 });
  const existing = list.data.find((p) => p.name === name && p.active);
  if (existing) {
    console.log(`= product ${name} (${existing.id})`);
    return existing;
  }
  const created = await stripe.products.create({
    name,
    description,
    // Non-confidential metadata — for our own bookkeeping
    metadata: { iku_internal: "pro_tier" },
  });
  console.log(`+ product ${name} (${created.id})`);
  return created;
}

/** Create price by lookup_key if not exists. Returns the price. */
async function ensurePrice(productId, {
  lookupKey,
  unitAmount,
  currency,
  recurring,
  nickname,
}) {
  const list = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const existing = list.data.find((p) => p.lookup_key === lookupKey);
  if (existing) {
    console.log(`  = price ${lookupKey} (${existing.id})`);
    return existing;
  }
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency,
    lookup_key: lookupKey,
    nickname,
    recurring: recurring || undefined,
  });
  console.log(`  + price ${lookupKey} (${created.id})`);
  return created;
}

async function run() {
  console.log("💳 Creating iku.gg Pro products in Stripe\n");

  // ── Monthly / Yearly = same product "iku.gg Pro", different prices ──
  const proProduct = await ensureProduct(
    "iku.gg Pro",
    "Remove ads, unlock unlimited favorites, early access, Discord Pro channel, and more."
  );

  const monthly = await ensurePrice(proProduct.id, {
    lookupKey: "iku_pro_monthly",
    unitAmount: 499,
    currency: "eur",
    recurring: { interval: "month" },
    nickname: "Pro Monthly (4.99€/month)",
  });

  const yearly = await ensurePrice(proProduct.id, {
    lookupKey: "iku_pro_yearly",
    unitAmount: 3999,
    currency: "eur",
    recurring: { interval: "year" },
    nickname: "Pro Annual (39.99€/year)",
  });

  // ── Lifetime = separate product, one-time payment ──
  const lifetimeProduct = await ensureProduct(
    "iku.gg Pro Lifetime",
    "One-time payment for lifetime Pro access. Launch offer, limited spots."
  );

  const lifetime = await ensurePrice(lifetimeProduct.id, {
    lookupKey: "iku_pro_lifetime",
    unitAmount: 6999,
    currency: "eur",
    recurring: null,
    nickname: "Pro Lifetime (69.99€ one-time)",
  });

  console.log("\n✨ Done. Copy these env vars to Coolify:\n");
  console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
  console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);
  console.log(`STRIPE_PRICE_LIFETIME=${lifetime.id}`);
}

run().catch((err) => { console.error("❌", err); process.exit(1); });
