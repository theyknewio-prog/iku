-- Auth + user sync tables for iku.gg
-- Run once against PG: psql $DATABASE_URL -f scripts/init-auth.sql

-- password_hash / dob are nullable for OAuth-only users (e.g. Discord)
-- NOTE: the `email` column does NOT have a UNIQUE constraint at the column
-- level because that would be case-sensitive. The functional unique index
-- `users_email_lower_uniq` below enforces case-insensitive uniqueness.
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  dob           DATE,
  avatar_emoji  TEXT NOT NULL DEFAULT '🌸',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OAuth provider links (Discord, etc)
CREATE TABLE IF NOT EXISTS user_oauth_accounts (
  provider          TEXT NOT NULL,
  provider_user_id  TEXT NOT NULL,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS user_oauth_user_idx ON user_oauth_accounts (user_id);

-- Case-insensitive unique email index. Replaces both the old column-level
-- UNIQUE constraint and the non-unique LOWER(email) index.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, video_slug)
);

CREATE INDEX IF NOT EXISTS user_favorites_user_idx ON user_favorites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_history (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_slug TEXT NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, video_slug)
);

CREATE INDEX IF NOT EXISTS user_history_user_idx ON user_history (user_id, watched_at DESC);
