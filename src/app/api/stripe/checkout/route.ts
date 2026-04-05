/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a Pro plan and returns the URL.
 * Requires the user to be authenticated.
 *
 * Body: { plan: "monthly" | "yearly" | "lifetime" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe, PLANS, getPlan } from "@/lib/stripe";
import pool from "@/lib/db";
import { getVerifyStatus } from "@/lib/email-verify-guard";
import { createRateLimiter } from "@/lib/rate-limit";

// Keyed by userId — not ip — since checkout requires auth anyway.
const limiter = createRateLimiter({ name: "checkout", max: 10, windowMs: 3600_000 });

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Email verification gate — block checkout until user confirms their address.
  // Discord-synthetic emails (@discord.iku.gg) are exempt (can't verify).
  const vStatus = await getVerifyStatus(session.user.id);
  if (!vStatus.passed) {
    return NextResponse.json(
      {
        error: "email_not_verified",
        message: "Please verify your email address before upgrading to Pro.",
      },
      { status: 403 }
    );
  }

  const userId = session.user.id;
  if (limiter.consume(userId)) {
    return NextResponse.json({ error: "too many checkout attempts" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { plan: planId } = (body ?? {}) as { plan?: string };
  if (!planId || !PLANS.find((p) => p.id === planId)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const plan = getPlan(planId);
  if (!plan.priceId) {
    return NextResponse.json(
      { error: "plan not yet available — price not configured" },
      { status: 500 }
    );
  }

  // Fetch user details (email, existing stripe_customer_id if any)
  const { rows } = await pool.query(
    `SELECT email, username, stripe_customer_id FROM users WHERE id = $1`,
    [userId]
  );
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Discount check: Waifu Scholar tier (15k+ points) gets 30% off
  // (only on recurring plans, not lifetime)
  let discounts: Array<{ coupon: string }> | undefined;
  if (plan.id !== "lifetime" && process.env.STRIPE_COUPON_TIER_DISCOUNT) {
    const { rows: statsRows } = await pool.query(
      `SELECT score FROM user_stats WHERE user_id = $1`,
      [userId]
    );
    if (statsRows[0]?.score >= 15000) {
      discounts = [{ coupon: process.env.STRIPE_COUPON_TIER_DISCOUNT }];
    }
  }

  // Never trust the Origin header for redirect URLs — an attacker can forge
  // `Origin: https://evil.gg` and have Stripe redirect the user to their
  // phishing page after a real payment. Use a server-side constant.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://iku.gg";

  // Reject double-buying: if the user already has lifetime or an active
  // subscription on the same plan, return 409 (prevents webhook mangling).
  const { rows: proRows } = await pool.query(
    `SELECT pro_status, pro_plan FROM users WHERE id = $1`,
    [userId]
  );
  const proStatus = proRows[0]?.pro_status as string | null;
  const proPlan = proRows[0]?.pro_plan as string | null;
  if (proStatus === "lifetime") {
    return NextResponse.json(
      { error: "already_lifetime", message: "You already have lifetime Pro access." },
      { status: 409 }
    );
  }
  if (proStatus === "active" && proPlan === plan.id) {
    return NextResponse.json(
      { error: "already_subscribed", message: `You are already on the ${plan.id} plan.` },
      { status: 409 }
    );
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: plan.id === "lifetime" ? "payment" : "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: plan.priceId, quantity: 1 }],
        customer: user.stripe_customer_id || undefined,
        customer_email: user.stripe_customer_id ? undefined : user.email,
        client_reference_id: userId,
        // `allow_promotion_codes` and `discounts` are MUTUALLY EXCLUSIVE in the
        // Stripe API — sending both throws StripeInvalidRequestError. Prefer
        // auto-applied server-side discounts (Waifu Scholar) when present;
        // otherwise let the user enter promo codes manually.
        ...(discounts ? { discounts } : { allow_promotion_codes: true }),
        success_url: `${origin}/profile?upgraded=1`,
        cancel_url: `${origin}/pricing?canceled=1`,
        metadata: {
          user_id: userId,
          plan: plan.id,
        },
        subscription_data:
          plan.id !== "lifetime"
            ? {
                metadata: { user_id: userId, plan: plan.id },
              }
            : undefined,
      },
      {
        // Idempotency: dedupe double-clicks within a 1-minute window.
        idempotencyKey: `checkout-${userId}-${plan.id}-${Math.floor(Date.now() / 60_000)}`,
      }
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("stripe checkout error:", msg);
    return NextResponse.json({ error: "checkout failed", detail: msg }, { status: 500 });
  }
}
