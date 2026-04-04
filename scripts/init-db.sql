-- PostgreSQL schema for iku.gg
-- Run: psql $DATABASE_URL -f scripts/init-db.sql

CREATE TABLE IF NOT EXISTS videos (
  pk          SERIAL PRIMARY KEY,
  source      TEXT NOT NULL,
  source_id   INTEGER NOT NULL,
  slug        TEXT NOT NULL,
  url         TEXT NOT NULL DEFAULT '',
  page_url    TEXT,
  site        TEXT,
  title       TEXT,
  thumbnail   TEXT NOT NULL DEFAULT '',
  preview     TEXT NOT NULL DEFAULT '',
  score       INTEGER NOT NULL DEFAULT 0,
  favorites   INTEGER NOT NULL DEFAULT 0,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  characters  TEXT[] NOT NULL DEFAULT '{}',
  copyrights  TEXT[] NOT NULL DEFAULT '{}',
  artists     TEXT[] NOT NULL DEFAULT '{}',
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  file_size   INTEGER NOT NULL DEFAULT 0,
  duration    REAL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, source_id),
  UNIQUE(slug)
);

CREATE INDEX IF NOT EXISTS idx_videos_source ON videos(source);
CREATE INDEX IF NOT EXISTS idx_videos_score ON videos(score DESC);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_favorites ON videos(favorites DESC);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_videos_characters ON videos USING GIN(characters);
CREATE INDEX IF NOT EXISTS idx_videos_copyrights ON videos USING GIN(copyrights);
CREATE INDEX IF NOT EXISTS idx_videos_source_score ON videos(source, score DESC);

-- Persistent cache for resolved video URLs (rule34video, WP sites).
-- Survives container restarts and unlimited size.
CREATE TABLE IF NOT EXISTS resolved_urls (
  page_url    TEXT PRIMARY KEY,
  video_url   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolved_urls_expires ON resolved_urls(expires_at);
