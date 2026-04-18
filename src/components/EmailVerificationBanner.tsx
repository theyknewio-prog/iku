"use client";

import { useState } from "react";

interface Props {
  /** User's email, for display in the banner. */
  email: string;
  /**
   * Optional context hint — shown as a second line when set (e.g. "checkout"
   * or "favorites"). Used to tell the user which action was blocked.
   */
  blocking?: string;
}

/**
 * EmailVerificationBanner — warns an unverified user and offers a resend CTA.
 *
 * Renders nothing on the server fallback (the parent server component decides
 * whether to include it based on getVerifyStatus). Handles the cooldown
 * response (429) and reflects state inline (sent / error / cooldown).
 */
export function EmailVerificationBanner({ email, blocking }: Props) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "cooldown"; retryAfter: number }
    | { kind: "error"; msg: string }
  >({ kind: "idle" });

  async function onResend() {
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as {
          retry_after?: number;
        };
        setState({ kind: "cooldown", retryAfter: body.retry_after ?? 300 });
        return;
      }
      if (!res.ok) {
        setState({
          kind: "error",
          msg: "Could not send. Try again in a minute.",
        });
        return;
      }
      setState({ kind: "sent" });
    } catch {
      setState({ kind: "error", msg: "Network error. Check your connection." });
    }
  }

  return (
    <div className="email-verify-banner" role="status" aria-live="polite">
      <div className="email-verify-banner__icon" aria-hidden>
        ✉️
      </div>
      <div className="email-verify-banner__body">
        <div className="email-verify-banner__title">
          Verify your email to unlock everything
        </div>
        <div className="email-verify-banner__sub">
          We sent a confirmation link to <strong>{email}</strong>.
          {blocking
            ? ` You need to verify it before you can ${blocking}.`
            : " Check your inbox (and spam folder)."}
        </div>
      </div>
      <div className="email-verify-banner__action">
        {state.kind === "idle" && (
          <button
            type="button"
            className="email-verify-banner__btn"
            onClick={onResend}
          >
            Resend email
          </button>
        )}
        {state.kind === "sending" && (
          <button type="button" className="email-verify-banner__btn" disabled>
            Sending…
          </button>
        )}
        {state.kind === "sent" && (
          <span className="email-verify-banner__ok">✓ Sent</span>
        )}
        {state.kind === "cooldown" && (
          <span className="email-verify-banner__muted">
            Wait {Math.ceil(state.retryAfter / 60)}m
          </span>
        )}
        {state.kind === "error" && (
          <span className="email-verify-banner__muted">{state.msg}</span>
        )}
      </div>
    </div>
  );
}
