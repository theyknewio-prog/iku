import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — iku.gg",
  description:
    "Sign in to iku.gg to save your favorite hentai videos and sync your history.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/profile");

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Welcome back ✨</h1>
        <p className="auth-sub">Sign in to sync your favorites and history</p>
        <LoginForm />
      </div>
    </main>
  );
}
