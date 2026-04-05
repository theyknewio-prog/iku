-- Email verification + password reset tables

-- Add verification status + timestamps to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at     TIMESTAMPTZ;

-- Verification tokens (short-lived, one-shot)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token       TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx
  ON email_verification_tokens (user_id);

-- Password reset tokens (short-lived, one-shot)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token       TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id);

-- Email send log (for debug + rate limiting + tracking)
CREATE TABLE IF NOT EXISTS email_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  to_email      TEXT NOT NULL,
  template      TEXT NOT NULL, -- 'verification' | 'password_reset' | 'welcome' | 'winback_j3' | ...
  resend_id     TEXT,
  status        TEXT NOT NULL, -- 'sent' | 'failed'
  error         TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_log_user_idx ON email_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_log_template_idx ON email_log (template, sent_at DESC);
