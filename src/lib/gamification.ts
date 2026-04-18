/**
 * gamification.ts — scoring, tiers, streaks, badges for iku.gg
 *
 * Core model:
 *   - Every meaningful action grants points (capped per-day on passive actions)
 *   - Points accumulate into a lifetime score
 *   - Score maps to a tier (Wanderer → Hentai Sage)
 *   - Daily active = streak +1 (max 1 per UTC day)
 *   - Badges auto-awarded at milestones
 *
 * Only called when a user is authenticated. For anon users, no stats are tracked.
 */

import pool from "@/lib/db";

// ─────────────────────────────────────────────────────────────
// CONFIG — scoring + tiers + daily cap
// ─────────────────────────────────────────────────────────────

/** Points per event type */
export const POINTS: Record<string, number> = {
  video_view: 2, // watched >30s
  video_complete: 5, // watched >80%
  favorite_add: 8,
  daily_quest: 15,
  video_of_day: 20,
  new_character: 10,
  share_click: 5,
  streak_7_bonus: 50,
  streak_30_bonus: 200,
  streak_100_bonus: 500,
};

export type ScoreEventType =
  | "video_view"
  | "video_complete"
  | "favorite_add"
  | "daily_quest"
  | "video_of_day"
  | "new_character"
  | "share_click"
  | "streak_7_bonus"
  | "streak_30_bonus"
  | "streak_100_bonus";

/** Max points earnable per day from passive (view-based) actions.
 *  Quality actions (favorites, quests) are uncapped. */
const DAILY_VIEW_CAP = 100;
const PASSIVE_EVENTS = new Set<ScoreEventType>([
  "video_view",
  "video_complete",
]);

/** Tier definitions — anime-themed, 6 levels */
export interface Tier {
  index: number;
  name: string;
  emoji: string;
  threshold: number;
  color: string;
  perks: string[];
}

export const TIERS: Tier[] = [
  {
    index: 0,
    name: "Wanderer",
    emoji: "🌙",
    threshold: 0,
    color: "#64748b",
    perks: ["Welcome aboard"],
  },
  {
    index: 1,
    name: "Kouhai",
    emoji: "🌸",
    threshold: 200,
    color: "#ff6b9d",
    perks: ["Animated profile badge", "Personal stats page"],
  },
  {
    index: 2,
    name: "Senpai",
    emoji: "⭐",
    threshold: 1000,
    color: "#c084fc",
    perks: [
      "Gradient profile border",
      "Extended history (90 days)",
      "+1 streak freeze",
    ],
  },
  {
    index: 3,
    name: "Otaku",
    emoji: "🎮",
    threshold: 5000,
    color: "#818cf8",
    perks: [
      "Visible Discord role",
      "Priority video resolve",
      "Early access to new sources",
    ],
  },
  {
    index: 4,
    name: "Waifu Scholar",
    emoji: "💎",
    threshold: 15000,
    color: "#fbbf24",
    perks: [
      "30% off Pro subscription",
      "Custom avatar border",
      "Weekly Curator Picks",
    ],
  },
  {
    index: 5,
    name: "Hentai Sage",
    emoji: "🔥",
    threshold: 50000,
    color: "#ef4444",
    perks: [
      "SAGE animated badge",
      "VIP Discord channel",
      "Vote on featured characters",
      "Name in credits",
    ],
  },
];

export function tierFromScore(score: number): Tier {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (score >= tier.threshold) current = tier;
    else break;
  }
  return current;
}

export function nextTierFor(score: number): Tier | null {
  const current = tierFromScore(score);
  return TIERS[current.index + 1] ?? null;
}

// ─────────────────────────────────────────────────────────────
// BADGES — auto-awarded at milestones
// ─────────────────────────────────────────────────────────────

export interface Badge {
  code: string;
  name: string;
  emoji: string;
  description: string;
  /** Predicate: does this stats row qualify for the badge? */
  check: (stats: UserStats) => boolean;
}

export const BADGES: Badge[] = [
  {
    code: "first_view",
    name: "First Watch",
    emoji: "👀",
    description: "Watched your first clip",
    check: (s) => s.total_views >= 1,
  },
  {
    code: "centurion",
    name: "Centurion",
    emoji: "💯",
    description: "Watched 100 clips",
    check: (s) => s.total_views >= 100,
  },
  {
    code: "first_fav",
    name: "Love at First Sight",
    emoji: "💖",
    description: "Added your first favorite",
    check: (s) => s.total_favorites >= 1,
  },
  {
    code: "collector",
    name: "Collector",
    emoji: "📚",
    description: "Added 50 favorites",
    check: (s) => s.total_favorites >= 50,
  },
  {
    code: "hoarder",
    name: "Hoarder",
    emoji: "🏰",
    description: "Added 200 favorites",
    check: (s) => s.total_favorites >= 200,
  },
  {
    code: "streak_7",
    name: "Week Devotee",
    emoji: "🔥",
    description: "7 day streak",
    check: (s) => s.current_streak >= 7 || s.longest_streak >= 7,
  },
  {
    code: "streak_30",
    name: "Monthly Devotee",
    emoji: "🔥🔥",
    description: "30 day streak",
    check: (s) => s.current_streak >= 30 || s.longest_streak >= 30,
  },
  {
    code: "streak_100",
    name: "Century Streak",
    emoji: "💀",
    description: "100 day streak — absolute devotee",
    check: (s) => s.current_streak >= 100 || s.longest_streak >= 100,
  },
  {
    code: "tier_senpai",
    name: "Senpai",
    emoji: "⭐",
    description: "Reached Senpai tier",
    check: (s) => s.score >= 1000,
  },
  {
    code: "tier_otaku",
    name: "Otaku",
    emoji: "🎮",
    description: "Reached Otaku tier",
    check: (s) => s.score >= 5000,
  },
  {
    code: "tier_sage",
    name: "Hentai Sage",
    emoji: "🔥",
    description: "Reached the highest tier — legend status",
    check: (s) => s.score >= 50000,
  },
];

// ─────────────────────────────────────────────────────────────
// CORE — user stats fetch + update
// ─────────────────────────────────────────────────────────────

export interface UserStats {
  user_id: number;
  score: number;
  total_views: number;
  total_completes: number;
  total_favorites: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: Date | null;
  streak_freezes: number;
  daily_points: number;
  daily_points_date: Date | null;
}

/** Returns the stats row for a user, creating a zero row if needed. */
export async function getOrCreateUserStats(
  userId: string | number,
): Promise<UserStats> {
  const { rows } = await pool.query(
    `INSERT INTO user_stats (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId],
  );
  return rows[0];
}

/** Read-only stats fetch. Returns null if user doesn't exist yet. */
export async function getUserStats(
  userId: string | number,
): Promise<UserStats | null> {
  const { rows } = await pool.query(
    `SELECT * FROM user_stats WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// SCORING — record an event + update totals + check badges
// ─────────────────────────────────────────────────────────────

interface RecordScoreOptions {
  userId: string | number;
  event: ScoreEventType;
  meta?: Record<string, unknown>;
}

/**
 * Records a scoring event for a user. Handles:
 *   - Daily cap on passive events (view / complete)
 *   - Lifetime score increment
 *   - Category counter updates (total_views, total_favorites, etc.)
 *   - Daily streak refresh (first activity of UTC day)
 *   - Streak milestone bonuses (+50 at 7, +200 at 30, +500 at 100)
 *   - Badge auto-award on new milestones
 */
export async function recordScore(opts: RecordScoreOptions): Promise<{
  awarded: number;
  newBadges: Badge[];
  newTier: Tier | null;
  stats: UserStats;
}> {
  const { userId, event, meta } = opts;
  const basePoints = POINTS[event];

  // Fetch current stats (creates row if needed)
  let stats = await getOrCreateUserStats(userId);
  const previousTier = tierFromScore(stats.score);

  // ── Daily cap for passive events ──
  let pointsToAward = basePoints;
  const today = new Date().toISOString().slice(0, 10);
  const statsDateStr = stats.daily_points_date
    ? new Date(stats.daily_points_date).toISOString().slice(0, 10)
    : null;

  if (PASSIVE_EVENTS.has(event)) {
    const dailyPoints = statsDateStr === today ? stats.daily_points : 0;
    const remaining = Math.max(0, DAILY_VIEW_CAP - dailyPoints);
    pointsToAward = Math.min(basePoints, remaining);
  }

  // ── Streak update (first activity of UTC day) ──
  const lastActiveStr = stats.last_active_date
    ? new Date(stats.last_active_date).toISOString().slice(0, 10)
    : null;

  let streakBonus = 0;
  let newStreak = stats.current_streak;
  if (lastActiveStr !== today) {
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (lastActiveStr === yesterday) {
      newStreak = stats.current_streak + 1;
    } else {
      newStreak = 1; // broken streak
    }

    // Milestone bonuses on hitting thresholds exactly (first time)
    if (newStreak === 7 && stats.current_streak < 7)
      streakBonus += POINTS.streak_7_bonus;
    if (newStreak === 30 && stats.current_streak < 30)
      streakBonus += POINTS.streak_30_bonus;
    if (newStreak === 100 && stats.current_streak < 100)
      streakBonus += POINTS.streak_100_bonus;
  }

  const totalPoints = pointsToAward + streakBonus;
  const newDailyPoints = PASSIVE_EVENTS.has(event)
    ? (statsDateStr === today ? stats.daily_points : 0) + pointsToAward
    : stats.daily_points;

  // ── Update totals based on event type ──
  const viewDelta = event === "video_view" ? 1 : 0;
  const completeDelta = event === "video_complete" ? 1 : 0;
  const favDelta = event === "favorite_add" ? 1 : 0;

  // ── Single UPDATE query ──
  const { rows } = await pool.query(
    `UPDATE user_stats SET
       score              = score + $2,
       total_views        = total_views + $3,
       total_completes    = total_completes + $4,
       total_favorites    = total_favorites + $5,
       current_streak     = $6,
       longest_streak     = GREATEST(longest_streak, $6),
       last_active_date   = $7::date,
       daily_points       = $8,
       daily_points_date  = $7::date,
       updated_at         = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      totalPoints,
      viewDelta,
      completeDelta,
      favDelta,
      newStreak,
      today,
      newDailyPoints,
    ],
  );
  stats = rows[0];

  // ── Log raw event for audit ──
  if (totalPoints > 0) {
    await pool.query(
      `INSERT INTO user_score_events (user_id, event_type, points, meta)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, event, totalPoints, meta ? JSON.stringify(meta) : null],
    );
  }

  // ── Check badges ──
  const newBadges: Badge[] = [];
  for (const badge of BADGES) {
    if (badge.check(stats)) {
      const { rowCount } = await pool.query(
        `INSERT INTO user_badges (user_id, badge_code) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, badge.code],
      );
      if (rowCount && rowCount > 0) newBadges.push(badge);
    }
  }

  // ── Tier transition ──
  const currentTier = tierFromScore(stats.score);
  const newTier = currentTier.index > previousTier.index ? currentTier : null;

  return { awarded: totalPoints, newBadges, newTier, stats };
}

// ─────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  avatar_emoji: string;
  score: number;
  current_streak: number;
  tier: Tier;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { rows } = await pool.query(
    `SELECT s.user_id, s.score, s.current_streak, u.username, u.avatar_emoji
     FROM user_stats s
     JOIN users u ON u.id = s.user_id
     WHERE s.score > 0
     ORDER BY s.score DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    user_id: Number(r.user_id),
    username: r.username,
    avatar_emoji: r.avatar_emoji,
    score: r.score,
    current_streak: r.current_streak,
    tier: tierFromScore(r.score),
  }));
}

// ─────────────────────────────────────────────────────────────
// BADGES — list for a user
// ─────────────────────────────────────────────────────────────

export async function getUserBadges(userId: string | number): Promise<
  Array<{
    code: string;
    name: string;
    emoji: string;
    description: string;
    earned_at: Date;
  }>
> {
  const { rows } = await pool.query(
    `SELECT badge_code, earned_at FROM user_badges
     WHERE user_id = $1
     ORDER BY earned_at DESC`,
    [userId],
  );
  const byCode = new Map(BADGES.map((b) => [b.code, b]));
  return rows
    .map((r) => {
      const def = byCode.get(r.badge_code);
      if (!def) return null;
      return {
        code: def.code,
        name: def.name,
        emoji: def.emoji,
        description: def.description,
        earned_at: new Date(r.earned_at),
      };
    })
    .filter(Boolean) as Array<{
    code: string;
    name: string;
    emoji: string;
    description: string;
    earned_at: Date;
  }>;
}
