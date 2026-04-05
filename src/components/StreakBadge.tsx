"use client";

/**
 * StreakBadge — small 🔥 indicator shown next to the user avatar in the topbar.
 * Only visible for logged-in users with a current streak of 1+.
 *
 * Fetches /api/user/stats once on mount + refreshes when a score event fires.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Stats {
  current_streak: number;
  score: number;
}

export function StreakBadge() {
  const { status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let canceled = false;

    async function load() {
      try {
        const res = await fetch("/api/user/stats");
        if (!res.ok) return;
        const data = await res.json();
        if (canceled) return;
        setStats({
          current_streak: data.stats.current_streak,
          score: data.stats.score,
        });
      } catch {
        /* silent */
      }
    }

    load();

    // Refresh every 2 min to catch streak updates after viewing videos
    const interval = window.setInterval(load, 2 * 60_000);
    return () => { canceled = true; window.clearInterval(interval); };
  }, [status]);

  if (status !== "authenticated" || !stats || stats.current_streak < 1) return null;

  const color =
    stats.current_streak >= 100 ? "#ef4444" :
    stats.current_streak >= 30  ? "#c084fc" :
    stats.current_streak >= 7   ? "#f97316" :
    "#fbbf24";

  return (
    <Link
      href="/profile"
      className="v2-streak-badge"
      title={`${stats.current_streak} day streak · ${stats.score.toLocaleString()} points`}
    >
      <span className="v2-streak-badge__icon" style={{ color }}>🔥</span>
      <span className="v2-streak-badge__count">{stats.current_streak}</span>
    </Link>
  );
}
