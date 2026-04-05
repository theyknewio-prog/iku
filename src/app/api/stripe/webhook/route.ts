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
 *   - invoice.payment_failed           → log but keep active (Stripe retries)
 *
 * The raw body signature is verified via STRIPE_WEBHOOK_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import pool from "@/lib/db";

export const runtime = "nodejs"; // Need raw body

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("stripe webhook signature verification failed:", msg);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Dedup via event id in stripe_events table
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO stripe_events (id, type, raw) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT DO NOTHING`,
      [event.id, event.type, JSON.stringify(event)]
    );
    if (rowCount === 0) {
      // Already processed
      return NextResponse.json({ received: true, dedup: true });
    }
  } catch (err) {
    console.error("stripe_events insert error:", err);
  }

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
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
        if (invoice.subscription) {
          // Fetch the fresh subscription to sync period_end
          const sub = await stripe.subscriptions.retrieve(String(invoice.subscription));
          await handleSubscriptionUpdate(sub);
        }
        break;
      }
      case "invoice.payment_failed": {
        // Keep active — Stripe auto-retries. Log only.
        const invoice = event.data.object as Stripe.Invoice;
        console.warn("stripe payment failed:", invoice.id);
        break;
      }
    }
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    // Still return 200 so Stripe doesn't retry indefinitely on bugs
  }

  return NextResponse.json({ received: true });
}

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id || session.client_reference_id;
  const plan = session.metadata?.plan;
  if (!userId) {
    console.error("checkout completed without user_id metadata");
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  // Store customer id on the user (so future checkouts reuse it)
  if (customerId) {
    await pool.query(
      `UPDATE users SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL`,
      [customerId, userId]
    );
  }

  // ── Lifetime (one-time payment) ──
  if (plan === "lifetime" || session.mode === "payment") {
    await pool.query(
      `UPDATE users SET
         pro_status = 'lifetime',
         pro_plan = 'lifetime',
         pro_started_at = COALESCE(pro_started_at, NOW()),
         pro_current_period_end = NULL
       WHERE id = $1`,
      [userId]
    );
    console.log(`pro lifetime activated for user ${userId}`);
    return;
  }

  // ── Subscription — the subscription.created event will handle the details ──
  // Just mark stripe_customer_id above; subscription.updated will sync the rest.
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) {
    console.error("subscription without user_id metadata:", sub.id);
    return;
  }

  // Status mapping: Stripe → our pro_status
  // active, trialing → 'active'
  // past_due, unpaid → 'past_due'
  // canceled, incomplete_expired → 'canceled' (but keep access until period_end)
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

  // Determine plan from the price lookup_key
  const priceId = sub.items.data[0]?.price.id;
  const plan = sub.metadata?.plan || (priceId?.includes("year") ? "yearly" : "monthly");

  const subWithPeriodEnd = sub as Stripe.Subscription & { current_period_end?: number };
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
     WHERE id = $1`,
    [userId, proStatus, plan, sub.id, periodEnd]
  );

  console.log(`pro ${proStatus} for user ${userId} (${plan})`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) return;

  await pool.query(
    `UPDATE users SET
       pro_status = 'canceled',
       pro_subscription_id = NULL
     WHERE id = $1`,
    [userId]
  );
  console.log(`pro canceled for user ${userId}`);
}
