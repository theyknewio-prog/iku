import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account — iku.gg",
  description:
    "Join iku.gg free. Save favorites, sync history across devices. 18+ only.",
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/profile");

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create your account 💖</h1>
        <p className="auth-sub">Save favorites, sync across devices</p>
        <SignupForm />
      </div>
    </main>
  );
}
