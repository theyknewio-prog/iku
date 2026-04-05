import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password — iku.gg",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Set a new password</h1>
        <p className="auth-sub">Pick something secure this time 💪</p>
        <Suspense fallback={<div style={{ color: "rgba(255,255,255,0.5)" }}>Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
