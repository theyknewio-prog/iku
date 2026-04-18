/**
 * daily-quests.ts — daily quest system for iku.gg
 *
 * Each authenticated user gets 3 quests per day (reset at UTC midnight).
 * Quests are auto-generated deterministically per-user-per-day so the
 * same user gets the same quests within a day but different across days.
 *
 * Progress is tracked in user_daily_quests. When a quest completes,
 * award +15 points (via POINTS.daily_quest) + a toast notification.
 *
 * Quest types:
 *   - watch_n        : watch N clips
 *   - favorite_n     : add N favorites
 *   - explore_genre  : watch a clip from a specific genre (tag)
 *   - new_character  : discover a clip of a character you haven't watched before
 *
 * The quest is ONE line of text + target number. Progress is incremented
 * by the same scoring events that grant points.
 */

import pool from "@/lib/db";
import { recordScore } from "@/lib/gamification";

export interface DailyQuest {
  code: string;
  title: string;
  emoji: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardPoints: number;
}

// Pool of quest templates to pick from
// Each day we pick 3 using a deterministic hash(user_id + date) as seed
const QUEST_TEMPLATES: Array<
  Omit<DailyQuest, "progress" | "completed" | "rewardPoints">
> = [
  { code: "watch_3", title: "Watch 3 clips today", emoji: "👀", target: 3 },
  { code: "watch_5", title: "Watch 5 clips today", emoji: "👀", target: 5 },
  {
    code: "favorite_1",
    title: "Add your first favorite today",
    emoji: "💖",
    target: 1,
  },
  {
    code: "favorite_2",
    title: "Add 2 favorites today",
    emoji: "💖",
    target: 2,
  },
  {
    code: "explore_anal",
    title: "Watch 1 clip tagged #anal",
    emoji: "🍑",
    target: 1,
  },
  {
    code: "explore_3d",
    title: "Watch 1 clip tagged #3d",
    emoji: "🎮",
    target: 1,
  },
  {
    code: "explore_vanilla",
    title: "Watch 1 clip tagged #vanilla",
    emoji: "💗",
    target: 1,
  },
  {
    code: "explore_futa",
    title: "Watch 1 clip tagged #futa",
    emoji: "✨",
    target: 1,
  },
  {
    code: "explore_uncens",
    title: "Watch 1 uncensored clip",
    emoji: "🔥",
    target: 1,
  },
  {
    code: "explore_monster",
    title: "Watch 1 clip tagged #monster",
    emoji: "👹",
    target: 1,
  },
  {
    code: "complete_1",
    title: "Finish 1 clip (80% watched)",
    emoji: "🏁",
    target: 1,
  },
  {
    code: "new_character",
    title: "Discover a new character",
    emoji: "⭐",
    target: 1,
  },
];

const REWARD_POINTS = 15;

// ─────────────────────────────────────────────────────────────
// Pick 3 quests deterministically for a given user/date
// ─────────────────────────────────────────────────────────────

function hashSeed(userId: string, date: string): number {
  const s = `${userId}-${date}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickDaily(userId: string, date: string): typeof QUEST_TEMPLATES {
  const seed = hashSeed(userId, date);
  const templates = [...QUEST_TEMPLATES];
  const picked: typeof QUEST_TEMPLATES = [];

  // Pick 3 using seed + linear congruence
  let state = seed;
  for (let i = 0; i < 3 && templates.length > 0; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const idx = state % templates.length;
    picked.push(templates[idx]);
    templates.splice(idx, 1);
  }
  return picked;
}

// ─────────────────────────────────────────────────────────────
// Ensure today's quests exist in the DB for a user
// ─────────────────────────────────────────────────────────────

export async function getOrCreateTodayQuests(
  userId: string | number,
): Promise<DailyQuest[]> {
  const today = new Date().toISOString().slice(0, 10);

  // Try to fetch existing
  const { rows } = await pool.query(
    `SELECT quest_code, progress, target, completed_at
     FROM user_daily_quests
     WHERE user_id = $1 AND quest_date = $2::date`,
    [userId, today],
  );

  if (rows.length === 3) {
    // Already exists — return with template metadata
    const byCode = new Map(QUEST_TEMPLATES.map((t) => [t.code, t]));
    return rows.map((r) => {
      const tpl = byCode.get(r.quest_code);
      return {
        code: r.quest_code,
        title: tpl?.title || r.quest_code,
        emoji: tpl?.emoji || "🎯",
        target: r.target,
        progress: r.progress,
        completed: Boolean(r.completed_at),
        rewardPoints: REWARD_POINTS,
      };
    });
  }

  // Generate fresh — clear any partial state first
  if (rows.length > 0) {
    await pool.query(
      `DELETE FROM user_daily_quests WHERE user_id = $1 AND quest_date = $2::date`,
      [userId, today],
    );
  }

  const picked = pickDaily(String(userId), today);
  const inserts = picked.map((p) =>
    pool.query(
      `INSERT INTO user_daily_quests (user_id, quest_date, quest_code, progress, target)
       VALUES ($1, $2::date, $3, 0, $4)`,
      [userId, today, p.code, p.target],
    ),
  );
  await Promise.all(inserts);

  return picked.map((p) => ({
    code: p.code,
    title: p.title,
    emoji: p.emoji,
    target: p.target,
    progress: 0,
    completed: false,
    rewardPoints: REWARD_POINTS,
  }));
}

// ─────────────────────────────────────────────────────────────
// Progress update — called by score handlers
// ─────────────────────────────────────────────────────────────

/** Quest codes this event type can advance */
function getRelevantQuests(
  event: string,
  meta?: { tags?: string[] },
): string[] {
  const matches: string[] = [];
  const tags = meta?.tags || [];

  if (event === "video_view") {
    matches.push("watch_3", "watch_5");
    if (tags.includes("anal")) matches.push("explore_anal");
    if (tags.includes("3d")) matches.push("explore_3d");
    if (tags.includes("vanilla")) matches.push("explore_vanilla");
    if (tags.includes("futa")) matches.push("explore_futa");
    if (tags.includes("uncensored")) matches.push("explore_uncens");
    if (tags.includes("monster")) matches.push("explore_monster");
  }
  if (event === "video_complete") {
    matches.push("complete_1");
  }
  if (event === "favorite_add") {
    matches.push("favorite_1", "favorite_2");
  }
  if (event === "new_character") {
    matches.push("new_character");
  }
  return matches;
}

/**
 * Advance daily quests for a user based on a scoring event.
 * Returns the list of quests that just got completed (for toast notifications).
 */
export async function advanceDailyQuests(
  userId: string | number,
  event: string,
  meta?: { tags?: string[] },
): Promise<Array<{ code: string; title: string; emoji: string }>> {
  const today = new Date().toISOString().slice(0, 10);
  const relevant = getRelevantQuests(event, meta);
  if (relevant.length === 0) return [];

  // Ensure quests exist for today
  await getOrCreateTodayQuests(userId);

  // Atomic increment on each relevant quest (only if not yet completed)
  const { rows } = await pool.query(
    `UPDATE user_daily_quests
     SET progress = LEAST(progress + 1, target),
         completed_at = CASE
           WHEN progress + 1 >= target AND completed_at IS NULL THEN NOW()
           ELSE completed_at
         END
     WHERE user_id = $1
       AND quest_date = $2::date
       AND quest_code = ANY($3::text[])
       AND completed_at IS NULL
     RETURNING quest_code, progress, target, completed_at`,
    [userId, today, relevant],
  );

  // Quests that just completed (completed_at set on this update)
  const justCompleted = rows.filter(
    (r) => r.completed_at && r.progress >= r.target,
  );

  // Award +15 pts per completed quest via recordScore
  const byCode = new Map(QUEST_TEMPLATES.map((t) => [t.code, t]));
  const toasted: Array<{ code: string; title: string; emoji: string }> = [];
  for (const r of justCompleted) {
    await recordScore({
      userId,
      event: "daily_quest",
      meta: { quest: r.quest_code },
    });
    const tpl = byCode.get(r.quest_code);
    toasted.push({
      code: r.quest_code,
      title: tpl?.title || r.quest_code,
      emoji: tpl?.emoji || "🎯",
    });
  }

  return toasted;
}
