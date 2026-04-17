"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MagneticButton } from "@/components/MagneticButton";

const EARLY_ADOPTER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const EARLY_ADOPTER_KEY = "iku-early-adopter-deadline";

function useEarlyAdopterCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let deadline: number;
    try {
      const stored = localStorage.getItem(EARLY_ADOPTER_KEY);
      if (stored) {
        deadline = Number(stored);
        if (!Number.isFinite(deadline) || deadline < Date.now()) {
          // expired — reseed a fresh 7-day window
          deadline = Date.now() + EARLY_ADOPTER_WINDOW_MS;
          localStorage.setItem(EARLY_ADOPTER_KEY, String(deadline));
        }
      } else {
        deadline = Date.now() + EARLY_ADOPTER_WINDOW_MS;
        localStorage.setItem(EARLY_ADOPTER_KEY, String(deadline));
      }
    } catch {
      deadline = Date.now() + EARLY_ADOPTER_WINDOW_MS;
    }

    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return remaining;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

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
  const earlyAdopterMs = useEarlyAdopterCountdown();

  async function checkout(planId: string) {
    setError(null);

    if (!isAuthenticated) {
      router.push("/login?callbackUrl=/pricing");
      return;
    }

    setLoading(planId);
    // PostHog: user started Pro checkout
    import("@/lib/analytics").then(({ track, EVENTS }) => {
      track(EVENTS.PRO_CHECKOUT_START, { plan: planId });
    });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (data.error === "email_not_verified") {
          setError(
            data.message ||
              "Please verify your email address before upgrading. Check the banner at the top of this page.",
          );
        } else {
          setError(data.error || "Checkout failed");
        }
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
      {earlyAdopterMs !== null && earlyAdopterMs > 0 && (
        <div className="pricing-urgency">
          <span className="pricing-urgency__dot" aria-hidden />
          <span className="pricing-urgency__label">Early adopter price</span>
          <span className="pricing-urgency__timer">
            ends in {formatCountdown(earlyAdopterMs)}
          </span>
        </div>
      )}
      {canceled && (
        <div className="pricing-alert">
          Checkout canceled. No charge was made.
        </div>
      )}
      {error && (
        <div className="pricing-alert pricing-alert--error">{error}</div>
      )}

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
                <span className="pricing-card__price-value">
                  {plan.priceLabel}
                </span>
                {plan.interval !== "lifetime" && (
                  <span className="pricing-card__price-interval">
                    / {plan.interval}
                  </span>
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
                <div className="pricing-card__current">✓ Your current plan</div>
              ) : !plan.available ? (
                <button type="button" className="pricing-card__cta" disabled>
                  Coming soon
                </button>
              ) : (
                <MagneticButton>
                  <button
                    type="button"
                    className="pricing-card__cta"
                    onClick={() => checkout(plan.id)}
                    disabled={loading !== null}
                  >
                    {loading === plan.id
                      ? "Loading…"
                      : isAuthenticated
                        ? "Get Pro"
                        : "Sign in to subscribe"}
                  </button>
                </MagneticButton>
              )}
            </div>
          );
        })}
      </div>

      <p className="pricing-small-print">
        Secure payments via Stripe. Cancel anytime from your{" "}
        <Link href="/profile" style={{ color: "#ff6b9d" }}>
          profile
        </Link>
        .
      </p>
    </>
  );
}
