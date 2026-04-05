"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="auth-error">
        Missing or invalid reset token. Request a new link from{" "}
        <Link href="/forgot-password" style={{ color: "#ff6b9d" }}>
          forgot password
        </Link>
        .
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login?reset=1"), 2000);
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Password updated</p>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 8 }}>
          Redirecting to sign in…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label className="auth-label">
        <span>New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="auth-input"
          placeholder="At least 8 characters"
        />
      </label>

      <label className="auth-label">
        <span>Confirm password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="auth-input"
        />
      </label>

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" disabled={loading} className="auth-submit">
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
