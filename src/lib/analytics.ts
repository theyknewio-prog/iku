/**
 * analytics.ts — PostHog client-side wrapper for iku.gg
 *
 * PostHog is initialized client-side only (no SSR), with lazy init so the
 * SDK bundle isn't blocking page load.
 *
 * ENV:
 *   NEXT_PUBLIC_POSTHOG_KEY  - project public API key
 *   NEXT_PUBLIC_POSTHOG_HOST - https://eu.i.posthog.com (EU) or https://us.i.posthog.com (US)
 *
 * Without the key, all calls are no-ops — the site works fine without analytics.
 */

import type { PostHog } from "posthog-js";

let client: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;

function getClient(): Promise<PostHog | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (initPromise) return initPromise;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key) return Promise.resolve(null);

  initPromise = import("posthog-js")
    .then((mod) => {
      const posthog = mod.default;
      posthog.init(key, {
        api_host: host,
        capture_pageview: "history_change", // auto pageviews on SPA nav
        autocapture: true,
        persistence: "localStorage+cookie",
        disable_session_recording: true, // no session replay by default (privacy for adult)
        respect_dnt: true,
        loaded: (ph) => {
          // Flag user as "iku_user" to filter bot traffic in funnels
          ph.register({ source: "iku.gg" });
        },
      });
      client = posthog;
      return posthog;
    })
    .catch((err) => {
      console.warn("posthog init failed:", err);
      return null;
    });

  return initPromise;
}

/** Capture a named event. Silent no-op if PostHog isn't configured. */
export async function track(
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = await getClient();
  if (!ph) return;
  ph.capture(event, properties);
}

/** Identify a logged-in user (call after signup/login). */
export async function identify(
  userId: string,
  traits?: Record<string, unknown>,
): Promise<void> {
  const ph = await getClient();
  if (!ph) return;
  ph.identify(userId, traits);
}

/** Reset the identity (call on logout). */
export async function reset(): Promise<void> {
  const ph = await getClient();
  if (!ph) return;
  ph.reset();
}

// Well-known event names — use constants so we don't typo
export const EVENTS = {
  // Auth
  SIGNUP: "signup",
  LOGIN: "login",
  LOGOUT: "logout",
  DISCORD_LINK: "discord_link",
  // Content
  VIDEO_VIEW: "video_view",
  VIDEO_COMPLETE: "video_complete",
  FAVORITE_ADD: "favorite_add",
  FAVORITE_REMOVE: "favorite_remove",
  SEARCH: "search",
  TAG_CLICK: "tag_click",
  CHARACTER_CLICK: "character_click",
  // Monetization
  PRO_CHECKOUT_START: "pro_checkout_start",
  PRO_PURCHASE: "pro_purchase",
  PRO_CANCEL: "pro_cancel",
  // Gamification
  BADGE_EARNED: "badge_earned",
  TIER_UP: "tier_up",
  // Discord
  DISCORD_INVITE_CLICK: "discord_invite_click",
} as const;
