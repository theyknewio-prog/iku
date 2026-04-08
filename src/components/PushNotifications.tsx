"use client";

/**
 * PushNotifications — Soft-prompt web push opt-in via OneSignal.
 *
 * Flow:
 *   1. Mounts only for non-Pro users (data-pro="0" on <body>).
 *   2. Waits until the user has watched 2+ videos (iku_view_count in
 *      localStorage) before showing the prompt — avoids nagging a first-time
 *      visitor before they have seen any value.
 *   3. Shows a custom bottom-left toast (soft prompt) instead of the native
 *      browser permission dialog immediately. This keeps the experience warm
 *      and avoids the "block" reflex that a sudden native dialog triggers.
 *   4. On "Allow", triggers the real browser push permission request, which
 *      is what OneSignal needs to register the subscription.
 *   5. Persists dismissal in localStorage so the toast never re-appears after
 *      the user has made a choice (allow or dismiss).
 *
 * The OneSignal SDK is loaded via a plain <script> tag using next/script's
 * lazyOnload strategy — it fires after the page is fully interactive, so it
 * does not compete with critical resources.
 *
 * Replace "YOUR_ONESIGNAL_APP_ID" with your real App ID from the OneSignal
 * dashboard before deploying.
 */

import Script from "next/script";
import { useEffect, useState, useCallback } from "react";

// Replace this with your real OneSignal App ID from https://app.onesignal.com
const ONESIGNAL_APP_ID = "1a054f40-8068-4946-86a5-9b597e0b2f6d";

// localStorage keys
const LS_VIEW_COUNT = "iku_view_count";
const LS_PUSH_DISMISSED = "iku_push_dismissed";

// How many video views before we show the soft prompt
const VIEWS_THRESHOLD = 2;

// Extend the Window interface to include OneSignal — their SDK attaches itself
// to window.OneSignal after the script loads.
declare global {
  interface Window {
    OneSignal?: {
      init: (config: Record<string, unknown>) => Promise<void>;
      Notifications: {
        requestPermission: () => Promise<void>;
        permission: boolean;
        permissionNative: string;
      };
      User: {
        PushSubscription: {
          optedIn: boolean;
        };
      };
    };
    OneSignalDeferred?: Array<(onesignal: Window["OneSignal"]) => void>;
  }
}

export function PushNotifications() {
  const [isPro, setIsPro] = useState(true); // default true → hidden until hydrated
  const [sdkReady, setSdkReady] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Step 1: detect Pro status and prior dismissal on the client
  useEffect(() => {
    const pro = document.body.dataset.pro === "1";
    setIsPro(pro);
    if (pro) return;

    const alreadyDismissed = localStorage.getItem(LS_PUSH_DISMISSED) === "1";
    setDismissed(alreadyDismissed);
  }, []);

  // Step 2: once SDK is loaded, initialize OneSignal (autoRegister: false
  // means we control when the native dialog fires — only on user click)
  const handleSdkLoad = useCallback(() => {
    if (!window.OneSignal) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function (OneSignal) {
      OneSignal?.init({
        appId: ONESIGNAL_APP_ID,
        // Suppress the automatic slide-down prompt — we use our own soft prompt
        promptOptions: {
          slidedown: { enabled: false },
          autoPrompt: false,
        },
        // Allow localhost during development (remove for production-only builds)
        allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
      }).then(() => {
        setSdkReady(true);
      });
    });
  }, []);

  // Step 3: poll localStorage for view count and decide whether to show
  useEffect(() => {
    if (isPro || dismissed) return;

    const checkViews = () => {
      const raw = localStorage.getItem(LS_VIEW_COUNT);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= VIEWS_THRESHOLD) {
        setShowPrompt(true);
      }
    };

    // Check immediately
    checkViews();

    // Also re-check every 10 seconds in case the user started watching a video
    // on the same mount without navigating (single-page transitions)
    const interval = setInterval(checkViews, 10_000);
    return () => clearInterval(interval);
  }, [isPro, dismissed]);

  // Handler: user clicked "Allow notifications"
  const handleAccept = useCallback(async () => {
    if (!window.OneSignal) return;
    try {
      await window.OneSignal.Notifications.requestPermission();
    } catch {
      // User denied the native dialog — that is a valid outcome, just dismiss
    }
    // Either way, dismiss our soft prompt
    localStorage.setItem(LS_PUSH_DISMISSED, "1");
    setDismissed(true);
    setShowPrompt(false);
  }, []);

  // Handler: user clicked "Later"
  const handleDismiss = useCallback(() => {
    localStorage.setItem(LS_PUSH_DISMISSED, "1");
    setDismissed(true);
    setShowPrompt(false);
  }, []);

  // If Pro user, never render anything
  if (isPro) return null;

  return (
    <>
      {/* OneSignal SDK — loaded lazily after page interaction */}
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="lazyOnload"
        id="onesignal-sdk"
        onLoad={handleSdkLoad}
      />

      {/* Soft-prompt toast — only shown after threshold is met */}
      {showPrompt && !dismissed && sdkReady && (
        <div
          className="push-toast"
          role="dialog"
          aria-label="Enable push notifications"
          aria-modal="false"
        >
          <div className="push-toast__icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>

          <div className="push-toast__body">
            <p className="push-toast__title">Stay in the loop</p>
            <p className="push-toast__text">
              Get notified when new trending and character videos drop
            </p>
          </div>

          <div className="push-toast__actions">
            <button
              className="push-toast__btn push-toast__btn--accept"
              onClick={handleAccept}
              type="button"
            >
              Allow
            </button>
            <button
              className="push-toast__btn push-toast__btn--dismiss"
              onClick={handleDismiss}
              type="button"
              aria-label="Dismiss notification prompt"
            >
              Later
            </button>
          </div>

          <button
            className="push-toast__close"
            onClick={handleDismiss}
            type="button"
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
