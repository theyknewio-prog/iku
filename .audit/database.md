# Database audit — 2026-04-05

Scope: `scripts/init-*.sql`, `scripts/db.ts`, `src/lib/db.ts`, `src/lib/content.ts`,
`src/lib/gamification.ts`, `src/lib/daily-quests.ts`.

---

## 🔴 BLOCKERS (data loss / corruption / integrity)

### B1. `upsertVideos` DO UPDATE does NOT update `page_url`, `site`, `title`

`scripts/db.ts:77-85` — the `ON CONFLICT DO UPDATE` set list is missing `page_url`,
`site`, and `title`. When a scraper re-ingests an existing Rule34Video / WP row and
the source has since fixed/updated the title or moved the page URL, the UPDATE
**silently drops** those columns. New inserts work; re-ingestion mutates everything
EXCEPT those three. For Rule34Video/WP (where `page_url` is the key used by
`/api/video-stream` to resolve the real MP4), a stale `page_url` = broken playback.

**Fix**:

```sql
ON CONFLICT (source, source_id) DO UPDATE SET
  slug = EXCLUDED.slug, url = EXCLUDED.url,
  page_url = EXCLUDED.page_url, site = EXCLUDED.site, title = EXCLUDED.title,
  thumbnail = EXCLUDED.thumbnail, preview = EXCLUDED.preview,
  ...
```

### B2. `slug` is `UNIQUE` but scrapers can collide across sources re-using the same id

`scripts/init-db.sql:27` — `UNIQUE(slug)` combined with `UNIQUE(source, source_id)`.
If two different sources ever happen to produce an identical slug (e.g. a
collision between a Gelbooru `gel-123-abc` and a hand-edited WP slug), the second
INSERT crashes the whole batch because `upsertVideos` only has `ON CONFLICT
(source, source_id)` — the `UNIQUE(slug)` path has **no conflict clause**, so the
entire multi-row INSERT rolls back.

**Fix**: either drop `UNIQUE(slug)` (slugs are already deterministic with source
prefixes — `gel-`, `r34-`, `r34v-`, `hmm-`, etc.) OR add a second `ON CONFLICT
(slug) DO NOTHING` path. Recommend: keep the uniqueness as an invariant and log
slug collisions loudly, but make the upsert resilient:

```sql
ON CONFLICT ON CONSTRAINT videos_source_source_id_key DO UPDATE SET ...
```

and add a pre-insert de-dup on `slug` inside `upsertVideos`.

### B3. `daily_quest` scoring is a re-entrant loop that can deadlock

`src/lib/daily-quests.ts:210` calls `recordScore({ event: "daily_quest" })` from
within `advanceDailyQuests()`. `recordScore()` then calls `advanceDailyQuests()`
via the `/api/score` path? Actually it does NOT currently, so today it is safe,
but the code in `gamification.ts:253-279` runs `UPDATE user_stats` + `INSERT
user_score_events` without a transaction — if the process crashes between them,
the score is incremented but there is no audit row. Conversely, if the badge
INSERT loop (`gamification.ts:283-291`) runs after the stats update and the
request is aborted, badges can be "earned but not awarded" or vice versa on
retry.

**Fix**: wrap `recordScore` in `BEGIN/COMMIT` using a single client checked out
from the pool. Same for `advanceDailyQuests` (the UPDATE on quests + downstream
`recordScore` call must be atomic per quest completion).

### B4. `user_stats.score` has no `CHECK (score >= 0)` and no overflow guard

`scripts/init-gamification.sql:7` — `score INTEGER NOT NULL DEFAULT 0`. Nothing
prevents negative values. A future refund/undo path, or a negative-points event
type, could push it below zero silently. Also `INTEGER` is signed 32-bit; at
~50k score-per-year ceiling per user it's fine for now but a bug in the daily
cap could compound.

**Fix**: `ALTER TABLE user_stats ADD CONSTRAINT score_non_negative CHECK (score

> = 0);`and same for`total_views`, `total_completes`, `total_favorites`,
`current_streak`, `longest_streak`, `daily_points`, `streak_freezes`.

### B5. `stripe_events` has no timestamp index for cleanup

`scripts/init-subscriptions.sql:17-23` — PK on `id` (good, dedup works), but
`stripe_events` will grow forever. The two secondary indexes are
`(user_id, received_at DESC)` and `(type, received_at DESC)` — no plain
`received_at` index and no retention job. Over a year at 1k events/day = 365k
rows with full JSONB payloads (~several GB). Not immediate data loss, but
becomes a latent scaling bomb.

**Fix**: add `CREATE INDEX stripe_events_received_at_idx ON stripe_events
(received_at)` and document a 90-day purge job (`DELETE FROM stripe_events WHERE
received_at < NOW() - INTERVAL '90 days'`).

### B6. `migrate-json-to-pg.ts` lacks the `upsertVideos` banned-content safety net

`scripts/migrate-json-to-pg.ts:65` — the migration script writes its own INSERT
instead of using `upsertVideos()`, so it bypasses the `BANNED_TAGS` + `hasBannedTitle`
guard in `scripts/db.ts:41-47`. The migration was already run once (the 277 banned
rows purged on 2026-04-04 were exactly this pathway), but if it's ever re-run
(recovery, dev bootstrap, new environment) it will reinsert legacy banned rows
from any stale JSON snapshot.

**Fix**: either route through `upsertVideos()` or inline the same filter before
the INSERT.

---

## 🟠 HIGH IMPACT (slow queries, missing indexes on hot paths)

### H1. No covering index for `getVideos({ order: "score" })` + banned filter

`src/lib/content.ts:139` — every `getVideos()` call does
`WHERE NOT (tags && $1::text[]) ORDER BY score DESC, created_at DESC`. The
existing indexes are:

- `idx_videos_score` on `(score DESC)` — btree
- `idx_videos_tags` on `(tags)` — GIN

The GIN index can serve `tags && ARRAY[...]` but NOT the negated form `NOT (tags
&& ...)`. Postgres will either:

1. Seq-scan + filter (at 351k rows this is ~1-2 s cold, ~300 ms warm), or
2. Use `idx_videos_score` for the ORDER BY and filter out banned inline (fine
   for small LIMIT, bad for pagination deep).

**Fix (recommended)**: partial index that excludes banned content at build time:

```sql
CREATE INDEX idx_videos_clean_score ON videos (score DESC, created_at DESC)
  WHERE NOT (tags && ARRAY['loli','lolicon','shota','shotacon','child',
             'children','minor','underage','toddler','cub','baby',
             'young_girl','young_boy','loli_focus','shota_focus',
             'lolidom','shotadom','toddlercon','infant','child_on_child',
             'oppai_loli','legal_loli','elementary_school','kindergarten',
             'randoseru']::text[]);
```

This turns the hot-path homepage/trending/explore queries into a pure index scan.
Same pattern for `created_at DESC` (for `/new`) and `favorites DESC`.

### H2. `source_score` composite index is a close duplicate of `score` — trending per-source is uncovered

`idx_videos_source_score` on `(source, score DESC)` exists, which is good for
`WHERE source = 'danbooru' ORDER BY score DESC`. But `getVideos()` uses `source
= 'danbooru'` only as filter, not in sort — the real hot path is "all sources
merged, sort by score". No gap there. However the reverse pattern — **per
source by date** for the daily scrape deltas + admin dashboards — has no index.
Low prio.

### H3. `getThumbnailForTag` query forces a seq scan

`src/lib/content.ts:44-53` — the `WHERE` clause is
`(source='danbooru' OR source='gelbooru') AND thumbnail != '' AND ($1 =
ANY(characters) OR $1 = ANY(copyrights) OR $1 = ANY(tags)) AND NOT (tags &&
...)` sorted by `score DESC LIMIT 1`. The three `= ANY(...)` across separate
array columns cannot all use the GIN indexes simultaneously. Postgres will pick
one (probably characters) and filter the rest. Mitigated by the 1h memoize, so
low user impact — but cold cache hits are ~400-800 ms each and the homepage
calls this ~20 times in parallel on first render post-deploy.

**Fix**: rewrite as a `UNION ALL` of three targeted queries, each using its own
GIN index, then `ORDER BY score DESC LIMIT 1` over the union. Or add a
materialized view `tag_top_thumb(tag, thumbnail)` refreshed hourly.

### H4. `/api/signup` + login `LOWER(email)` — index exists but `auth.ts:41` is covered, `signup:117` is too

Good: `users_email_lower_idx` on `LOWER(email)` exists and matches. ✅ No action.

### H5. `user_favorites` / `user_history` — no index on `video_slug` for "who favorited X" queries

PK is `(user_id, video_slug)` which covers user-first lookups. There is no
reverse index for `video_slug` alone, so "how many users favorited this video"
is a seq scan. Not used today but will be wanted for aggregate video popularity.

**Fix (defer)**: `CREATE INDEX user_favorites_slug_idx ON user_favorites
(video_slug);` when needed.

### H6. `email_log` has `(template, sent_at DESC)` but no `(user_id, template, sent_at)` for winback dedup

The quickref docs mention "winback dedup queries". Checking `WHERE user_id = $1
AND template = 'winback_j3'` will use `email_log_user_idx (user_id, sent_at
DESC)` and filter by template inline. Fine at low volume, but a
`(user_id, template)` composite would make it index-only.

**Fix**: `CREATE INDEX email_log_user_template_idx ON email_log (user_id,
template, sent_at DESC);`

### H7. Pool size vs. server capacity

`src/lib/db.ts:15` — `max: 20` connections per Node process. The app runs
standalone, single container. PG 16 default `max_connections` = 100. Fine for
one container. If a second worker is ever added (e.g. Next.js cluster), 20 × N
workers could starve Postgres. Document that scaling horizontally requires
either (a) dropping `max` to ~10, or (b) introducing pgBouncer.

Also: `scripts/db.ts:17` uses `max: 5` for scrapers, which is sensible. But all
scraper scripts that import this share one pool per Node process — `await pool.end()`
is not called anywhere I can see, so the script may hang on exit until idle
timeout expires. Low-impact (GH Actions kills the runner) but ugly.

---

## 🟡 NICE TO FIX (schema improvements, defaults)

### N1. `file_size INTEGER` caps out at 2 GB

`scripts/init-db.sql:23` — `file_size INTEGER NOT NULL DEFAULT 0`. A 4K 60 min
hentai clip can exceed 2 GB. Use `BIGINT`. Same for potential future counters.

### N2. `videos.title` can be NULL but `slug` cannot — inconsistent nullable policy

Some text fields default to `''` (url, thumbnail, preview), others default to
NULL (`title`, `page_url`, `site`). Pick one convention for optional strings to
avoid `IS NOT NULL AND <> ''` double-checks sprinkled across the codebase (see
`content.ts:145`, `content.ts:286`).

### N3. `user_oauth_accounts` PK is `(provider, provider_user_id)` — good — but no unique guard on (user_id, provider)

A user could theoretically link two Discord accounts to the same iku user. Not
exploitable today because `findOrCreateDiscordUser` checks first, but a race
could produce duplicates.

**Fix**: `CREATE UNIQUE INDEX user_oauth_one_per_provider ON user_oauth_accounts
(user_id, provider);`

### N4. `user_daily_quests` PK `(user_id, quest_date, quest_code)` — no enforcement that a user has exactly 3 per day

If `getOrCreateTodayQuests()` is interrupted mid-insert (Promise.all of 3
inserts — one succeeds, two fail), `rows.length !== 3` on next call triggers a
DELETE + re-insert that picks different quests because `pickDaily` is
deterministic per day but the `DELETE` path rechooses the same 3 — OK, stable.
But if two concurrent requests race, both can pass the `rows.length === 3`
check mid-flight and both insert → unique violation → request error. This is
actually handled (PK prevents duplicates, the second INSERT throws), but the
error surfaces to the user rather than being swallowed.

**Fix**: wrap `getOrCreateTodayQuests` body in a single `INSERT ... ON CONFLICT
DO NOTHING` batch to make it idempotent under concurrency.

### N5. `email_verification_tokens` / `password_reset_tokens` — no cleanup job

Unused tokens accumulate forever. Add a cron `DELETE FROM
email_verification_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`.

### N6. `resolved_urls` expires_at indexed, but no cleanup query run

`idx_resolved_urls_expires` exists but nothing deletes expired rows. Table
grows unbounded at ~500 rows/30 min × 48 = 24k/day in the warmup loop. Even a
year = 8.7M rows, still small. Add
`DELETE FROM resolved_urls WHERE expires_at < NOW() - INTERVAL '1 day'` as a
daily job, or call it from the warmup loop.

### N7. `videos.created_at DEFAULT NOW()` overrides source timestamps if scraper forgets to set it

`scripts/db.ts:70` — `r.created_at ?? new Date().toISOString()`. If a scraper
bug passes `undefined`, the video gets "today" as creation date and surfaces on
`/new`. Not hypothetical — this means a failed field extraction pollutes the
"new releases" feed. Worth logging a warning when `created_at` is missing.

### N8. No `updated_at` trigger on `users`

`users.updated_at DEFAULT NOW()` is set on insert but never auto-updated. Every
UPDATE path needs to remember `updated_at = NOW()`. Add a trigger:

```sql
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

### N9. `BANNED_TAGS_ARRAY` is hardcoded in JS — no DB-side enforcement

A ROW LEVEL filter via a generated column `is_banned BOOLEAN GENERATED ALWAYS
AS (...)` + a partial index (see H1) would move the filter into the schema and
make it impossible to forget at the query level. Ties into H1 fix.

### N10. Banned content slug/title pattern check is only in `upsertVideos`, not in the runtime query path

`src/lib/content.ts:139` filters tags only. A row that made it past the scraper
with a clean tag array but a `slug: "loli-whatever"` (extremely unlikely given
the 2026-04-04 safety net, but not impossible on pre-safety-net legacy data)
would still be returned. Consider adding `AND slug !~* 'loli|shota|child|...'`
to `getVideos()` OR run a one-shot cleanup that deletes on slug/title pattern.

### N11. No backup strategy documented

Docker volume `iku_pgdata` is not snapshotted anywhere I can find. The entire
351K video catalog + all user data is one `rm -rf` or corrupted write away
from gone. Coolify has no built-in PG backup. Recommend:

- Daily `pg_dump -Fc` via cron cron job on the host → pushed to
  Hetzner Storage Box or B2.
- Enable PG WAL archiving for PITR if user data grows critical.
- Document in CLAUDE.md. Currently the word "backup" does not appear.

### N12. `stripe_events.user_id ON DELETE SET NULL` loses attribution

If a user is deleted, their Stripe event history becomes anonymous rows. Given
this is an audit + tax trail, you probably want `ON DELETE NO ACTION` and
instead soft-delete users (add `deleted_at`). Low prio — adult site deletion
compliance may actually require this anonymization.

---

## ✅ Verified solid

- `videos` primary key + `UNIQUE(source, source_id)` composite correctly models
  the identity of a video across sources.
- GIN indexes on `tags`, `characters`, `copyrights` are correct for the `= ANY`
  / `&&` operator patterns used.
- `users_email_lower_idx` + `users_username_lower_idx` are functional indexes
  that match the `WHERE LOWER(email) = LOWER($1)` query in `src/auth.ts:41` and
  `src/app/api/signup/route.ts:117`. Case-insensitive login works and is
  indexed. ✅
- All foreign keys from user-owned tables (`user_stats`, `user_badges`,
  `user_daily_quests`, `user_score_events`, `user_favorites`, `user_history`,
  `user_oauth_accounts`, `email_verification_tokens`, `password_reset_tokens`)
  use `ON DELETE CASCADE` — no orphan rows on user deletion. ✅
- `stripe_events.id` is `TEXT PRIMARY KEY` on the Stripe event id → webhook
  dedup is atomic and correct. ✅
- All SQL in `src/lib/*.ts` uses parameterized `$1, $2, ...` — no string
  interpolation found in query bodies. SQL injection safe. ✅
- Pool singleton pattern in `src/lib/db.ts` survives Next.js hot reload and
  prevents connection storms in dev. ✅
- `recordScore()` uses a single UPDATE with `GREATEST(longest_streak, $6)` to
  atomically bump the longest streak. ✅
- Daily cap logic in `gamification.ts:216-220` correctly resets on date
  rollover and prevents farming. ✅
- Streak milestone bonus gating (`stats.current_streak < threshold`) correctly
  awards once — comment matches code. ✅
- Rate limiters are not racy (mono-thread Node, no await between check and
  increment) — confirmed by code audit, matches CLAUDE.md note.
- Schema files are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF
NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Re-runnable on recovery. ✅
- `resolved_urls` L2 cache table is correctly keyed by `page_url` (the Rule34Video
  page URL) so it survives container restarts and IP-bound token expiries.
