import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard, TIERS } from "@/lib/gamification";

export const metadata: Metadata = {
  title: "Leaderboard — iku.gg",
  description: "Top 100 iku.gg fans by score. Compete, climb the ranks, earn rewards.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic"; // PG not available at build time
export const revalidate = 300;

export default async function LeaderboardPage() {
  const entries = await getLeaderboard(100);

  return (
    <main className="lb-page">
      <div className="lb-container">
        <div className="lb-hero">
          <h1 className="lb-title">
            🏆 Leaderboard
          </h1>
          <p className="lb-sub">
            The top 100 iku.gg fans ranked by total score. Earn points by watching
            clips, adding favorites, and keeping your daily streak alive.
          </p>
          <div className="lb-tiers">
            {TIERS.map((t) => (
              <div key={t.name} className="lb-tier-pill" style={{ color: t.color, borderColor: `${t.color}55` }}>
                <span>{t.emoji}</span>
                <span className="lb-tier-pill__name">{t.name}</span>
                <span className="lb-tier-pill__threshold">{t.threshold.toLocaleString()}+</span>
              </div>
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="lb-empty">
            <p>No one has scored yet. Be the first — start watching and climbing.</p>
            <Link href="/" className="lb-empty-btn">Browse clips</Link>
          </div>
        ) : (
          <ol className="lb-list">
            {entries.map((e, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
              const isTop3 = i < 3;
              return (
                <li
                  key={e.user_id}
                  className={`lb-row ${isTop3 ? "lb-row--top3" : ""}`}
                  style={isTop3 ? { borderColor: `${e.tier.color}66` } : undefined}
                >
                  <div className="lb-row__rank">{medal}</div>
                  <div className="lb-row__avatar" style={{ background: `linear-gradient(135deg, ${e.tier.color}, #c084fc)` }}>
                    {e.avatar_emoji || "🌸"}
                  </div>
                  <div className="lb-row__info">
                    <div className="lb-row__name">{e.username}</div>
                    <div className="lb-row__tier" style={{ color: e.tier.color }}>
                      {e.tier.emoji} {e.tier.name}
                    </div>
                  </div>
                  <div className="lb-row__stats">
                    <div className="lb-row__score">{e.score.toLocaleString()}<span>pts</span></div>
                    {e.current_streak > 0 && (
                      <div className="lb-row__streak">🔥 {e.current_streak}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="lb-cta">
          <p>Want to climb the ranks?</p>
          <div className="lb-cta-buttons">
            <Link href="/" className="lb-cta-btn lb-cta-btn--primary">Start watching</Link>
            <Link href="/profile" className="lb-cta-btn">Your profile</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
