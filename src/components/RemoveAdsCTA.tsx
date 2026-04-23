"use client";

/**
 * RemoveAdsCTA — Premium upsell card below the player.
 *
 * Replaces the stale "Tired of ads?" strip — ads were nuked in commit
 * ac04c45 so the old copy no longer made sense. Now positions Premium
 * around speed, quality and library perks. Hidden for Pro users
 * (body data-pro="1") and for users on plans that don't see ads.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

const PERKS: Array<{ emoji: string; label: string; sub: string }> = [
  {
    emoji: "✨",
    label: "Full HD · 4K when available",
    sub: "Max quality, no compression.",
  },
  {
    emoji: "⚡",
    label: "Priority fast streaming",
    sub: "No slowdowns on busy nights.",
  },
  {
    emoji: "💾",
    label: "Unlimited favorites + sync",
    sub: "Your library follows you across every device.",
  },
  {
    emoji: "🚀",
    label: "Early access to new uploads",
    sub: "See fresh clips before anyone else.",
  },
];

export function RemoveAdsCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (document.body.dataset.pro === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <aside className="premium-card" aria-labelledby="premium-card-title">
      <div className="premium-card__head">
        <span className="premium-card__badge">Premium</span>
        <h3 id="premium-card-title" className="premium-card__title">
          Watch iku without limits.
        </h3>
      </div>
      <ul className="premium-card__perks">
        {PERKS.map((p) => (
          <li key={p.label} className="premium-card__perk">
            <span aria-hidden className="premium-card__perk-emoji">
              {p.emoji}
            </span>
            <span>
              <strong>{p.label}</strong>
              <span className="premium-card__perk-sub">{p.sub}</span>
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/pricing"
        className="premium-card__cta"
        aria-label="Go Premium — see plans"
      >
        <span>Go Premium — from 4.99€/mo</span>
        <span aria-hidden>→</span>
      </Link>
      <p className="premium-card__support">
        Your subscription keeps iku.gg running and zero-ad.
      </p>
    </aside>
  );
}
