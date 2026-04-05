-- Stripe subscriptions table for iku.gg Pro tier
-- Run: psql $DATABASE_URL -f scripts/init-subscriptions.sql

-- Add subscription fields directly to users (1-to-1)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pro_status            TEXT,    -- null / 'active' / 'canceled' / 'past_due' / 'lifetime'
  ADD COLUMN IF NOT EXISTS pro_plan              TEXT,    -- null / 'monthly' / 'yearly' / 'lifetime'
  ADD COLUMN IF NOT EXISTS pro_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_subscription_id   TEXT,
  ADD COLUMN IF NOT EXISTS pro_started_at        TIMESTAMPTZ;

-- Index for fast "is this user Pro?" lookups
CREATE INDEX IF NOT EXISTS users_pro_status_idx ON users (pro_status) WHERE pro_status IS NOT NULL;

-- Full event history (Stripe webhook log) — useful for debug + analytics
CREATE TABLE IF NOT EXISTS stripe_events (
  id              TEXT PRIMARY KEY,          -- Stripe event id
  type            TEXT NOT NULL,
  user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw             JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS stripe_events_user_idx ON stripe_events (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS stripe_events_type_idx ON stripe_events (type, received_at DESC);
