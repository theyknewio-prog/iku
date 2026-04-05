import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = {
  title: "Profile — iku.gg",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/profile");

  const { rows } = await pool.query(
    `SELECT id, email, username, avatar_emoji, dob, created_at,
            password_hash IS NOT NULL AS has_password
     FROM users WHERE id = $1`,
    [session.user.id]
  );
  const user = rows[0];
  if (!user) redirect("/login");

  return (
    <main className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">{user.avatar_emoji}</div>
        <div>
          <h1 className="profile-name">{user.username}</h1>
          <div className="profile-email">{user.email}</div>
          <div className="profile-joined">
            Joined {new Date(user.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </div>
        </div>
      </div>

      <ProfileClient
        initialUsername={user.username}
        initialAvatar={user.avatar_emoji}
        hasPassword={user.has_password}
      />
    </main>
  );
}
