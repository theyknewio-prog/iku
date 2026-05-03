/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Processes subscription lifecycle events and updates
 * the users table (pro_status, pro_plan, pro_current_period_end, etc).
 *
 * Events handled:
 *   - checkout.session.completed       → activate Pro for the user
 *   - customer.subscription.updated    → sync status (active, past_due, canceled)
 *   - customer.subscription.deleted    → downgrade to free
 *   - invoice.payment_succeeded        → extend period_end
 *   - invoice.payment_failed           → flip to past_due immediately
 *
 * The raw body signature is verified via STRIPE_WEBHOOK_SECRET.
 *
 * Dedup: stripe_events table, INSERT only AFTER successful handling so that
 * transient errors (DB down, etc.) cause a 500 and Stripe retries automatically.
 * Guards: never overwrite pro_status='lifetime' from a subscription update.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import pool from "@/lib/db";
import { sendDunningEmail } from "@/lib/email";

export const runtime = "nodejs"; // Need raw body

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "stripe not configured" },
      { status: 500 },
    );
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 500 },
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig)
    return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("stripe webhook signature verification failed:", msg);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Dedup check (read-only) — if already processed, ack immediately.
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM stripe_events WHERE id = $1 LIMIT 1`,
      [event.id],
    );
    if (rows.length > 0) {
      return NextResponse.json({ received: true, dedup: true });
    }
  } catch (err) {
    console.error("stripe_events dedup check error:", err);
    // Fall through — handler may still succeed; Stripe retry will re-dedup next time.
  }

  // Process the event. On error, return 500 so Stripe retries (up to 3 days).
  // The stripe_events INSERT only runs AFTER successful handling, so transient
  // failures (DB down, network blip) don't poison the dedup set.
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string;
        };
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            String(invoice.subscription),
          );
          await handleSubscriptionUpdate(sub);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string;
          next_payment_attempt?: number | null;
        };
        console.warn("stripe payment failed:", invoice.id);
        // Immediately flip to past_due so UI reflects reality — don't wait for
        // a trailing subscription.updated event that may be minutes late.
        if (invoice.subscription) {
          const { rows } = await pool.query(
            `UPDATE users SET pro_status = 'past_due'
             WHERE pro_subscription_id = $1 AND pro_status IS DISTINCT FROM 'lifetime'
             RETURNING id, email, username, pro_plan`,
            [String(invoice.subscription)],
          );
          // Fire-and-forget dunning email — deduped server-side to 1/week.
          const user = rows[0];
          if (
            user &&
            user.email &&
            !String(user.email).endsWith("@discord.iku.gg")
          ) {
            const nextAttempt = invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000)
              : null;
            sendDunningEmail({
              userId: user.id,
              email: user.email,
              username: user.username,
              plan: user.pro_plan === "yearly" ? "yearly" : "monthly",
              nextAttemptAt: nextAttempt,
            }).catch((err) => console.error("dunning email failed:", err));
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    // Return 500 — Stripe will retry (up to 3 days). Event NOT inserted into
    // stripe_events, so the retry will re-attempt cleanly.
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  // Mark event as processed AFTER successful handling.
  try {
    await pool.query(
      `INSERT INTO stripe_events (id, type, raw) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT DO NOTHING`,
      [event.id, event.type, JSON.stringify(event)],
    );
  } catch (err) {
    console.error("stripe_events insert error (post-handler):", err);
    // Handler already succeeded — don't 500 the webhook. Stripe retry would
    // be a safe no-op (handlers are idempotent via upserts).
  }

  return NextResponse.json({ received: true });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Resolve a user_id from a subscription: prefer metadata, fallback to
 * stripe_customer_id lookup so subs created outside our checkout flow
 * (customer portal, manual recreate, dunning swap) still get routed.
 *
 * Exported for unit tests — do not import from app code (go through the POST
 * route so the full webhook pipeline is exercised).
 */
export async function resolveUserIdFromSub(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const metaUserId = sub.metadata?.user_id;
  if (metaUserId) return metaUserId;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  const { rows } = await pool.query(
    `SELECT id FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  );
  return rows[0] ? String(rows[0].id) : null;
}

/**
 * Strict price-id → plan mapping. No substring magic.
 * Exported for unit tests.
 */
export function planFromPriceId(
  priceId: string | undefined,
): "monthly" | "yearly" | "lifetime" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return "yearly";
  if (priceId === process.env.STRIPE_PRICE_LIFETIME) return "lifetime";
  return null;
}

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  const userId = session.metadata?.user_id || session.client_reference_id;
  const plan = session.metadata?.plan;
  if (!userId) {
    console.error("checkout completed without user_id metadata");
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  // Store customer id on the user (so future checkouts reuse it)
  if (customerId) {
    await pool.query(
      `UPDATE users SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL`,
      [customerId, userId],
    );
  }

  // ── Lifetime (one-time payment) ──
  if (plan === "lifetime" || session.mode === "payment") {
    // Cancel any pre-existing active subscription so trailing webhooks from
    // it can't downgrade the lifetime status.
    const { rows } = await pool.query(
      `SELECT pro_subscription_id FROM users WHERE id = $1`,
      [userId],
    );
    const existingSubId = rows[0]?.pro_subscription_id as string | null;
    if (existingSubId && stripe) {
      try {
        await stripe.subscriptions.cancel(existingSubId);
        console.log(
          `canceled prior sub ${existingSubId} for lifetime upgrade (user ${userId})`,
        );
      } catch (err) {
        // Non-fatal: sub may already be canceled. The guard in
        // handleSubscriptionUpdate (pro_status != 'lifetime') is the real safety net.
        console.warn(`could not cancel prior sub ${existingSubId}:`, err);
      }
    }

    await pool.query(
      `UPDATE users SET
         pro_status = 'lifetime',
         pro_plan = 'lifetime',
         pro_subscription_id = NULL,
         pro_started_at = COALESCE(pro_started_at, NOW()),
         pro_current_period_end = NULL
       WHERE id = $1`,
      [userId],
    );
    console.log(`pro lifetime activated for user ${userId}`);
    return;
  }

  // ── Subscription — the subscription.created event will handle the details ──
}

export async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const userId = await resolveUserIdFromSub(sub);
  if (!userId) {
    console.error(
      "subscription without user_id metadata or customer link:",
      sub.id,
    );
    return;
  }

  // GUARD: never overwrite a lifetime user's status from a subscription event.
  // Lifetime is a permanent state and any trailing monthly/yearly sub event
  // must not touch it (see conversion.md blocker #2).
  const { rows: currentRows } = await pool.query(
    `SELECT pro_status FROM users WHERE id = $1`,
    [userId],
  );
  if (currentRows[0]?.pro_status === "lifetime") {
    console.log(`skipping sub update for lifetime user ${userId}`);
    return;
  }

  // Status mapping: Stripe → our pro_status
  let proStatus: string;
  switch (sub.status) {
    case "active":
    case "trialing":
      proStatus = "active";
      break;
    case "past_due":
    case "unpaid":
      proStatus = "past_due";
      break;
    default:
      proStatus = "canceled";
  }

  // Determine plan from price ID (strict lookup, no substring guessing).
  const priceId = sub.items.data[0]?.price.id;
  const plan =
    (sub.metadata?.plan as "monthly" | "yearly" | "lifetime" | undefined) ||
    planFromPriceId(priceId) ||
    "monthly";

  const subWithPeriodEnd = sub as Stripe.Subscription & {
    current_period_end?: number;
  };
  const periodEnd = subWithPeriodEnd.current_period_end
    ? new Date(subWithPeriodEnd.current_period_end * 1000)
    : null;

  await pool.query(
    `UPDATE users SET
       pro_status = $2,
       pro_plan = $3,
       pro_subscription_id = $4,
       pro_current_period_end = $5,
       pro_started_at = COALESCE(pro_started_at, NOW())
     WHERE id = $1 AND pro_status IS DISTINCT FROM 'lifetime'`,
    [userId, proStatus, plan, sub.id, periodEnd],
  );

  console.log(`pro ${proStatus} for user ${userId} (${plan})`);
}

export async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = await resolveUserIdFromSub(sub);
  if (!userId) return;

  await pool.query(
    `UPDATE users SET
       pro_status = 'canceled',
       pro_subscription_id = NULL
     WHERE id = $1 AND pro_status IS DISTINCT FROM 'lifetime'`,
    [userId],
  );
  console.log(`pro canceled for user ${userId}`);
}
