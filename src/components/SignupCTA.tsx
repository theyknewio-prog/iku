"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

/**
 * SignupCTA
 *
 * A conversion-focused banner that nudges anonymous visitors into creating
 * an account, framed around the concrete benefits they unlock:
 *   - gamification (streaks, points, tiers, leaderboard)
 *   - favorites + history sync across devices
 *   - Pro preview / Discord Pro lounge
 *
 * Renders nothing when the user is already signed in. Stateless otherwise.
 *
 * Variants:
 *   - "inline"  → rectangular card, fits inside a page-container
 *   - "compact" → single-line thin banner for dense pages
 */
export function SignupCTA({
  variant = "inline",
  placement = "generic",
}: {
  variant?: "inline" | "compact";
  placement?: string;
}) {
  const { data: session, status } = useSession();

  // Never render while the auth status is loading — avoids a flash on the
  // first paint for signed-in users.
  if (status === "loading") return null;
  if (session?.user) return null;

  const signupHref = `/signup?from=${encodeURIComponent(placement)}`;
  const loginHref = `/login?from=${encodeURIComponent(placement)}`;

  if (variant === "compact") {
    return (
      <div className="signup-cta signup-cta--compact" role="complementary">
        <span className="signup-cta__eyebrow">✨ Free account</span>
        <span className="signup-cta__headline-sm">
          Save favorites, earn points, climb the leaderboard
        </span>
        <Link href={signupHref} className="signup-cta__btn signup-cta__btn--sm">
          Create account
        </Link>
      </div>
    );
  }

  return (
    <section className="signup-cta signup-cta--inline" aria-label="Create a free account">
      <div className="signup-cta__glow" aria-hidden />
      <div className="signup-cta__content">
        <div className="signup-cta__eyebrow">💖 Free account · 30 seconds</div>
        <h3 className="signup-cta__headline">
          Unlock the <span className="signup-cta__headline-accent">full iku.gg experience</span>
        </h3>
        <p className="signup-cta__sub">
          Save unlimited favorites, sync history across devices, earn points
          every day, and climb through 6 anime tiers on the leaderboard.
        </p>
        <ul className="signup-cta__perks">
          <li><span aria-hidden>❤️</span> Unlimited favorites</li>
          <li><span aria-hidden>🔥</span> Daily streak + bonuses</li>
          <li><span aria-hidden>🎯</span> 3 daily quests · +15 pts each</li>
          <li><span aria-hidden>🏆</span> Leaderboard + 11 badges</li>
          <li><span aria-hidden>💎</span> 30% off Pro at tier 5</li>
          <li><span aria-hidden>🎮</span> Discord Pro channel access</li>
        </ul>
        <div className="signup-cta__actions">
          <Link href={signupHref} className="signup-cta__btn">
            Create my account ✨
          </Link>
          <Link href={loginHref} className="signup-cta__btn-ghost">
            Already have one?
          </Link>
        </div>
      </div>
    </section>
  );
}
