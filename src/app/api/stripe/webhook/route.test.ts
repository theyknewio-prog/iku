/**
 * Tests for the Stripe webhook handler.
 *
 * Covers the 10 blockers from the conversion-funnel audit:
 *   1. planFromPriceId — strict lookup, no substring magic
 *   2. resolveUserIdFromSub — metadata first, customer_id fallback
 *   3. handleSubscriptionUpdate — lifetime guard (no downgrade)
 *   4. handleSubscriptionDeleted — lifetime guard
 *   5. handleCheckoutCompleted — lifetime cancels prior sub
 *   6. handleCheckoutCompleted — NULLs pro_subscription_id on lifetime
 *   7. handleSubscriptionUpdate — correct plan from real price id
 *   8. handleSubscriptionUpdate — past_due mapping
 *   9. handleSubscriptionUpdate — canceled mapping
 *  10. handleSubscriptionUpdate — uses customer fallback when metadata missing
 *
 * The Postgres pool and Stripe SDK are fully mocked via vi.mock(). No real
 * services are touched. Run with: npm test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Stub env vars BEFORE the module under test imports them.
process.env.STRIPE_PRICE_MONTHLY = "price_test_monthly";
process.env.STRIPE_PRICE_YEARLY = "price_test_yearly";
process.env.STRIPE_PRICE_LIFETIME = "price_test_lifetime";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";

// ─── Mock Postgres ────────────────────────────────────────────
// vi.mock is hoisted so this runs before the route file imports `@/lib/db`.
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

// ─── Mock Stripe SDK ──────────────────────────────────────────
const mockCancelSubscription = vi.fn();
const mockRetrieveSubscription = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      cancel: (...args: unknown[]) => mockCancelSubscription(...args),
      retrieve: (...args: unknown[]) => mockRetrieveSubscription(...args),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

// ─── Mock dunning email (dependency of webhook route) ────────
const mockSendDunningEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email", () => ({
  sendDunningEmail: (...args: unknown[]) => mockSendDunningEmail(...args),
}));

// Now import the code under test (after mocks are set up).
import {
  planFromPriceId,
  resolveUserIdFromSub,
  handleCheckoutCompleted,
  handleSubscriptionUpdate,
  handleSubscriptionDeleted,
} from "./route";

// ─── Helpers ──────────────────────────────────────────────────

function makeSubscription(
  overrides: Partial<Stripe.Subscription> & {
    priceId?: string;
    metadata?: Record<string, string>;
    customerId?: string;
    currentPeriodEnd?: number;
    status?: Stripe.Subscription.Status;
  },
): Stripe.Subscription {
  const {
    priceId = "price_test_monthly",
    metadata = { user_id: "42", plan: "monthly" },
    customerId = "cus_test_123",
    currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 86400,
    status = "active",
    ...rest
  } = overrides;

  return {
    id: "sub_test_abc",
    metadata,
    customer: customerId,
    status,
    items: {
      data: [
        {
          price: { id: priceId },
        },
      ],
    },
    current_period_end: currentPeriodEnd,
    ...rest,
  } as unknown as Stripe.Subscription;
}

function makeCheckoutSession(overrides: {
  userId?: string;
  plan?: string;
  customerId?: string;
  mode?: "payment" | "subscription";
}): Stripe.Checkout.Session {
  const {
    userId = "42",
    plan = "monthly",
    customerId = "cus_test_123",
    mode = "subscription",
  } = overrides;
  return {
    id: "cs_test_123",
    mode,
    customer: customerId,
    client_reference_id: userId,
    metadata: { user_id: userId, plan },
  } as unknown as Stripe.Checkout.Session;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockCancelSubscription.mockReset();
  mockRetrieveSubscription.mockReset();
  mockSendDunningEmail.mockClear();
});

// ──────────────────────────────────────────────────────────────
// planFromPriceId
// ──────────────────────────────────────────────────────────────

describe("planFromPriceId", () => {
  it("returns 'monthly' for the monthly price id", () => {
    expect(planFromPriceId("price_test_monthly")).toBe("monthly");
  });

  it("returns 'yearly' for the yearly price id", () => {
    expect(planFromPriceId("price_test_yearly")).toBe("yearly");
  });

  it("returns 'lifetime' for the lifetime price id", () => {
    expect(planFromPriceId("price_test_lifetime")).toBe("lifetime");
  });

  it("returns null for an unknown price id", () => {
    expect(planFromPriceId("price_unknown")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(planFromPriceId(undefined)).toBeNull();
  });

  it("does NOT match via substring — a real Stripe id containing 'year' still resolves by exact match", () => {
    // Regression guard for the old `priceId?.includes("year")` bug which
    // classified every real price id (opaque strings) as monthly.
    expect(planFromPriceId("price_1TIsKwE6BjkfAdXjJnVBTyearAbc")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// resolveUserIdFromSub
// ──────────────────────────────────────────────────────────────

describe("resolveUserIdFromSub", () => {
  it("prefers metadata.user_id when present", async () => {
    const sub = makeSubscription({
      metadata: { user_id: "99", plan: "monthly" },
    });
    const result = await resolveUserIdFromSub(sub);
    expect(result).toBe("99");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("falls back to stripe_customer_id lookup when metadata is missing", async () => {
    const sub = makeSubscription({ metadata: {} });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 77 }] });
    const result = await resolveUserIdFromSub(sub);
    expect(result).toBe("77");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id FROM users WHERE stripe_customer_id"),
      ["cus_test_123"],
    );
  });

  it("returns null when neither metadata nor customer link resolves", async () => {
    const sub = makeSubscription({ metadata: {}, customerId: "cus_orphan" });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await resolveUserIdFromSub(sub);
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// handleSubscriptionUpdate
// ──────────────────────────────────────────────────────────────

describe("handleSubscriptionUpdate", () => {
  it("updates pro_status/pro_plan for an active user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pro_status: "active" }] }); // SELECT current
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
    const sub = makeSubscription({
      status: "active",
      priceId: "price_test_yearly",
      metadata: { user_id: "42", plan: "yearly" },
    });

    await handleSubscriptionUpdate(sub);

    // UPDATE was called with status=active, plan=yearly
    const updateCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE users SET"),
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual([
      "42",
      "active",
      "yearly",
      "sub_test_abc",
      expect.any(Date),
    ]);
  });

  it("BLOCKER #5 — does NOT downgrade a lifetime user from a trailing sub event", async () => {
    // SELECT returns pro_status='lifetime'
    mockQuery.mockResolvedValueOnce({ rows: [{ pro_status: "lifetime" }] });
    const sub = makeSubscription({
      status: "active",
      metadata: { user_id: "42", plan: "monthly" },
    });

    await handleSubscriptionUpdate(sub);

    // The SELECT ran, but NO UPDATE should have been issued.
    const updateCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE users SET"),
    );
    expect(updateCall).toBeUndefined();
  });

  it("maps past_due subscription status to 'past_due'", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pro_status: "active" }] });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const sub = makeSubscription({ status: "past_due" });

    await handleSubscriptionUpdate(sub);

    const updateCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE users SET"),
    );
    expect(updateCall![1][1]).toBe("past_due");
  });

  it("maps canceled subscription status to 'canceled'", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pro_status: "active" }] });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const sub = makeSubscription({ status: "canceled" });

    await handleSubscriptionUpdate(sub);

    const updateCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE users SET"),
    );
    expect(updateCall![1][1]).toBe("canceled");
  });

  it("BLOCKER #9 — classifies a real yearly price id as 'yearly' (not monthly fallback)", async () => {
    // Metadata missing — forces price-id resolution. This is the exact
    // regression from the old priceId?.includes("year") dead code.
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] }); // customer lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ pro_status: "active" }] });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const sub = makeSubscription({
      metadata: {}, // no plan in metadata
      priceId: "price_test_yearly",
    });

    await handleSubscriptionUpdate(sub);

    const updateCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE users SET"),
    );
    expect(updateCall![1][2]).toBe("yearly");
  });

  it("returns early without touching DB when user can't be resolved", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // customer lookup returns nothing
    const sub = makeSubscription({ metadata: {}, customerId: "cus_orphan" });

    await handleSubscriptionUpdate(sub);

    // Only the SELECT for customer lookup — no SELECT pro_status, no UPDATE.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────
// handleSubscriptionDeleted
// ──────────────────────────────────────────────────────────────

describe("handleSubscriptionDeleted", () => {
  it("flips pro_status to 'canceled' and clears subscription_id", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const sub = makeSubscription({ status: "canceled" });

    await handleSubscriptionDeleted(sub);

    const call = mockQuery.mock.calls[0];
    expect(String(call[0])).toContain("pro_status = 'canceled'");
    expect(String(call[0])).toContain("pro_subscription_id = NULL");
    expect(String(call[0])).toContain("pro_status != 'lifetime'"); // guard
  });

  it("BLOCKER #5 — SQL guard prevents lifetime users from being cancelled", async () => {
    // The SQL WHERE clause includes `pro_status != 'lifetime'`, so a lifetime
    // row passes through this handler untouched. We just verify the clause
    // is present in the query (the DB enforces it).
    mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // lifetime row not affected
    const sub = makeSubscription({});

    await handleSubscriptionDeleted(sub);

    expect(String(mockQuery.mock.calls[0][0])).toContain(
      "pro_status != 'lifetime'",
    );
  });
});

// ──────────────────────────────────────────────────────────────
// handleCheckoutCompleted
// ──────────────────────────────────────────────────────────────

describe("handleCheckoutCompleted", () => {
  it("activates lifetime and cancels any prior subscription", async () => {
    // UPDATE stripe_customer_id
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // SELECT pro_subscription_id — user had a prior sub
    mockQuery.mockResolvedValueOnce({
      rows: [{ pro_subscription_id: "sub_prior_xyz" }],
    });
    // UPDATE users SET pro_status='lifetime'
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    mockCancelSubscription.mockResolvedValueOnce({
      id: "sub_prior_xyz",
      status: "canceled",
    });

    const session = makeCheckoutSession({ plan: "lifetime", mode: "payment" });
    await handleCheckoutCompleted(session);

    // Prior sub was canceled so trailing webhooks can't downgrade lifetime.
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_prior_xyz");

    // Final UPDATE set pro_status='lifetime' and NULLed pro_subscription_id.
    const finalUpdate = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("pro_status = 'lifetime'"),
    );
    expect(finalUpdate).toBeDefined();
    expect(String(finalUpdate![0])).toContain("pro_subscription_id = NULL");
  });

  it("tolerates cancel failures (prior sub may already be inactive)", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // customer update
    mockQuery.mockResolvedValueOnce({
      rows: [{ pro_subscription_id: "sub_prior" }],
    });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // lifetime update
    mockCancelSubscription.mockRejectedValueOnce(new Error("already canceled"));

    const session = makeCheckoutSession({ plan: "lifetime", mode: "payment" });

    // Should not throw — cancel failure is logged and continues.
    await expect(handleCheckoutCompleted(session)).resolves.toBeUndefined();

    // Lifetime UPDATE still ran despite the cancel rejection.
    const finalUpdate = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes("pro_status = 'lifetime'"),
    );
    expect(finalUpdate).toBeDefined();
  });

  it("does nothing for subscription mode (subscription.updated event handles it)", async () => {
    // Only the customer_id UPDATE should fire — no lifetime logic.
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const session = makeCheckoutSession({
      plan: "monthly",
      mode: "subscription",
    });

    await handleCheckoutCompleted(session);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(String(mockQuery.mock.calls[0][0])).toContain("stripe_customer_id");
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("returns early when user_id metadata is missing", async () => {
    const session = {
      id: "cs_x",
      mode: "payment",
      customer: null,
      client_reference_id: null,
      metadata: {},
    } as unknown as Stripe.Checkout.Session;

    await handleCheckoutCompleted(session);

    expect(mockQuery).not.toHaveBeenCalled();
  });
});
