"use client";

import { useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          Check your inbox
        </p>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.5 }}>
          If an account exists for <strong>{email}</strong>, we just sent a password reset link.
          The link expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="auth-submit"
          style={{ display: "inline-block", marginTop: 20, textAlign: "center", textDecoration: "none" }}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="auth-form">
        <label className="auth-label">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="auth-input"
            placeholder="you@example.com"
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="auth-switch">
        Remembered it? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}
