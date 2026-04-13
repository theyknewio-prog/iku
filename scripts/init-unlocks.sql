-- user_unlocks: free users can spend gamification points to unlock
-- individual Pro-gated videos. Persist forever (no re-charge on revisit).

CREATE TABLE IF NOT EXISTS user_unlocks (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_pk    INTEGER NOT NULL REFERENCES videos(pk) ON DELETE CASCADE,
  cost_points INTEGER NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, video_pk)
);

CREATE INDEX IF NOT EXISTS user_unlocks_user_idx ON user_unlocks (user_id);
CREATE INDEX IF NOT EXISTS user_unlocks_recent_idx ON user_unlocks (user_id, unlocked_at DESC);
