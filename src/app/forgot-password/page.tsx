import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password — iku.gg",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Forgot your password?</h1>
        <p className="auth-sub">No worries — we'll send you a reset link</p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
