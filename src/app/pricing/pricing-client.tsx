"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  priceLabel: string;
  interval: string;
  mostPopular: boolean;
  discount?: string;
  description: string;
  features: Array<{ icon: string; name: string }>;
  available: boolean;
}

interface Props {
  plans: Plan[];
  isAuthenticated: boolean;
  currentPlan: string | null;
}

export function PricingClient({ plans, isAuthenticated, currentPlan }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const canceled = search.get("canceled") === "1";
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(planId: string) {
    setError(null);

    if (!isAuthenticated) {
      router.push("/login?callbackUrl=/pricing");
      return;
    }

    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Checkout failed");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(null);
    }
  }

  return (
    <>
      {canceled && (
        <div className="pricing-alert">
          Checkout canceled. No charge was made.
        </div>
      )}
      {error && <div className="pricing-alert pricing-alert--error">{error}</div>}

      <div className="pricing-grid">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`pricing-card ${plan.mostPopular ? "pricing-card--popular" : ""} ${isCurrent ? "pricing-card--current" : ""}`}
            >
              {plan.mostPopular && (
                <div className="pricing-card__banner">Most popular</div>
              )}
              {plan.discount && (
                <div className="pricing-card__discount">{plan.discount}</div>
              )}

              <h3 className="pricing-card__name">{plan.name}</h3>

              <div className="pricing-card__price">
                <span className="pricing-card__price-value">{plan.priceLabel}</span>
                {plan.interval !== "lifetime" && (
                  <span className="pricing-card__price-interval">/ {plan.interval}</span>
                )}
              </div>

              <p className="pricing-card__desc">{plan.description}</p>

              <ul className="pricing-card__features">
                {plan.features.slice(0, 6).map((f) => (
                  <li key={f.name}>
                    <span>{f.icon}</span> {f.name}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="pricing-card__current">
                  ✓ Your current plan
                </div>
              ) : !plan.available ? (
                <button type="button" className="pricing-card__cta" disabled>
                  Coming soon
                </button>
              ) : (
                <button
                  type="button"
                  className="pricing-card__cta"
                  onClick={() => checkout(plan.id)}
                  disabled={loading !== null}
                >
                  {loading === plan.id ? "Loading…" : isAuthenticated ? "Get Pro" : "Sign in to subscribe"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="pricing-small-print">
        Secure payments via Stripe. Cancel anytime from your{" "}
        <Link href="/profile" style={{ color: "#ff6b9d" }}>profile</Link>.
      </p>
    </>
  );
}
