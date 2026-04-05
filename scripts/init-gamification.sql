-- Gamification tables for iku.gg
-- Run: psql $DATABASE_URL -f scripts/init-gamification.sql

-- Per-user aggregated stats (1 row per user)
CREATE TABLE IF NOT EXISTS user_stats (
  user_id             BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score               INTEGER NOT NULL DEFAULT 0,
  total_views         INTEGER NOT NULL DEFAULT 0,
  total_completes     INTEGER NOT NULL DEFAULT 0,
  total_favorites     INTEGER NOT NULL DEFAULT 0,
  current_streak      INTEGER NOT NULL DEFAULT 0,
  longest_streak      INTEGER NOT NULL DEFAULT 0,
  last_active_date    DATE,
  streak_freezes      INTEGER NOT NULL DEFAULT 0,
  daily_points        INTEGER NOT NULL DEFAULT 0,
  daily_points_date   DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for leaderboard queries (top score)
CREATE INDEX IF NOT EXISTS user_stats_score_desc_idx ON user_stats (score DESC);
CREATE INDEX IF NOT EXISTS user_stats_streak_idx    ON user_stats (current_streak DESC);

-- Earned badges (1 row per badge per user)
CREATE TABLE IF NOT EXISTS user_badges (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code  TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_code)
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx ON user_badges (user_id, earned_at DESC);

-- Daily quests progress (1 row per quest per user per day)
-- quests are generated daily at midnight UTC, reset each day
CREATE TABLE IF NOT EXISTS user_daily_quests (
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_date   DATE NOT NULL,
  quest_code   TEXT NOT NULL,
  progress     INTEGER NOT NULL DEFAULT 0,
  target       INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, quest_date, quest_code)
);

CREATE INDEX IF NOT EXISTS user_daily_quests_today_idx
  ON user_daily_quests (user_id, quest_date);

-- Raw scoring events (for audit + anti-abuse + future analytics)
-- Capped per-day via anti-farm logic at the application layer
CREATE TABLE IF NOT EXISTS user_score_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  points      INTEGER NOT NULL,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_score_events_user_date_idx
  ON user_score_events (user_id, created_at DESC);
