-- One-shot migration: make the `users.email` UNIQUE constraint case-insensitive.
--
-- Why: Postgres `UNIQUE` on a TEXT column is case-sensitive. Signup checks
-- uniqueness via `LOWER(email)` but the constraint did not, allowing
-- `alice@x.com` and `Alice@x.com` to coexist. Login (`findUserByEmail`) uses
-- `LOWER(...)` and picks `LIMIT 1`, returning a nondeterministic row.
--
-- Run once against prod PG:
--   psql $DATABASE_URL -f scripts/migrate-email-case-insensitive.sql
--
-- Safe to re-run (idempotent).

BEGIN;

-- 1. Dedup any existing case-variant duplicates (keep the lowest-id row).
--    In prod there shouldn't be any, but belt-and-suspenders.
WITH dups AS (
  SELECT id, LOWER(email) AS lower_email,
         ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY id ASC) AS rn
  FROM users
)
DELETE FROM users
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- 2. Drop the old case-sensitive UNIQUE constraint.
--    The constraint name is auto-generated as `users_email_key` by Postgres.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- 3. Add the case-insensitive unique index. This replaces both the old
--    constraint and the existing non-unique `users_email_lower_idx`.
DROP INDEX IF EXISTS users_email_lower_idx;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq
  ON users (LOWER(email));

COMMIT;
