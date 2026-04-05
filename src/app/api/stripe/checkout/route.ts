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

const rateLimit = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimit) if (now > v.resetAt) rateLimit.delete(k);
}, 5 * 60_000);

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

  // Rate limit: 10 checkout attempts per hour per user (anti-abuse)
  const userId = session.user.id;
  const now = Date.now();
  const rl = rateLimit.get(userId);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 10) {
      return NextResponse.json({ error: "too many checkout attempts" }, { status: 429 });
    }
    rl.count++;
  } else {
    rateLimit.set(userId, { count: 1, resetAt: now + 3600_000 });
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

  const origin = request.headers.get("origin") || "https://iku.gg";

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: plan.id === "lifetime" ? "payment" : "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      customer: user.stripe_customer_id || undefined,
      customer_email: user.stripe_customer_id ? undefined : user.email,
      client_reference_id: userId,
      allow_promotion_codes: true,
      discounts,
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
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("stripe checkout error:", msg);
    return NextResponse.json({ error: "checkout failed", detail: msg }, { status: 500 });
  }
}
