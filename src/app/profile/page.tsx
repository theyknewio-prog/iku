import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { ProfileClient } from "./profile-client";
import {
  getOrCreateUserStats,
  getUserBadges,
  tierFromScore,
  nextTierFor,
} from "@/lib/gamification";
import { getOrCreateTodayQuests } from "@/lib/daily-quests";

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

  // Gamification data
  const stats = await getOrCreateUserStats(session.user.id);
  const badges = await getUserBadges(session.user.id);
  const quests = await getOrCreateTodayQuests(session.user.id);
  const tier = tierFromScore(stats.score);
  const next = nextTierFor(stats.score);
  const progressPct = next
    ? Math.min(
        100,
        Math.round(
          ((stats.score - tier.threshold) / (next.threshold - tier.threshold)) * 100
        )
      )
    : 100;

  return (
    <main className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">{user.avatar_emoji}</div>
        <div style={{ flex: 1 }}>
          <h1 className="profile-name">{user.username}</h1>
          <div className="profile-email">{user.email}</div>
          <div className="profile-joined">
            Joined {new Date(user.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </div>
          <div className="profile-tier" style={{ color: tier.color }}>
            {tier.emoji} {tier.name}
            <span className="profile-tier__score">
              {stats.score.toLocaleString()} pts
            </span>
          </div>
        </div>
      </div>

      {/* Tier progress bar */}
      {next && (
        <div className="profile-section">
          <h2>Progress</h2>
          <div className="profile-progress">
            <div className="profile-progress__labels">
              <span>{tier.emoji} {tier.name}</span>
              <span style={{ opacity: 0.6 }}>
                {stats.score - tier.threshold} / {next.threshold - tier.threshold} to {next.name} {next.emoji}
              </span>
            </div>
            <div className="profile-progress__bar">
              <div
                className="profile-progress__fill"
                style={{
                  width: `${progressPct}%`,
                  background: `linear-gradient(90deg, ${tier.color}, #c084fc)`,
                }}
              />
            </div>
          </div>

          <ul className="profile-perks">
            {tier.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Daily quests */}
      <div className="profile-section">
        <h2>Daily Quests</h2>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px" }}>
          Complete 3 quests every day to earn bonus points · Resets at midnight UTC
        </p>
        <div className="profile-quests">
          {quests.map((q) => {
            const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
            return (
              <div key={q.code} className={`profile-quest ${q.completed ? "profile-quest--done" : ""}`}>
                <div className="profile-quest__header">
                  <span className="profile-quest__emoji">{q.emoji}</span>
                  <span className="profile-quest__title">{q.title}</span>
                  <span className="profile-quest__reward">+{q.rewardPoints}</span>
                </div>
                <div className="profile-quest__bar">
                  <div className="profile-quest__fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="profile-quest__progress">
                  {q.completed ? "✓ Complete" : `${q.progress} / ${q.target}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats grid */}
      <div className="profile-section">
        <h2>Your Stats</h2>
        <div className="profile-stats-grid">
          <div className="profile-stat">
            <div className="profile-stat__value">🔥 {stats.current_streak}</div>
            <div className="profile-stat__label">Current Streak</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__value">👑 {stats.longest_streak}</div>
            <div className="profile-stat__label">Longest Streak</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__value">👀 {stats.total_views.toLocaleString()}</div>
            <div className="profile-stat__label">Clips Watched</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__value">💖 {stats.total_favorites.toLocaleString()}</div>
            <div className="profile-stat__label">Favorites</div>
          </div>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="profile-section">
          <h2>Badges ({badges.length})</h2>
          <div className="profile-badges">
            {badges.map((b) => (
              <div key={b.code} className="profile-badge" title={b.description}>
                <div className="profile-badge__emoji">{b.emoji}</div>
                <div className="profile-badge__name">{b.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ProfileClient
        initialUsername={user.username}
        initialAvatar={user.avatar_emoji}
        hasPassword={user.has_password}
      />
    </main>
  );
}
