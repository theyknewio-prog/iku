-- precompute-video-counts.sql
--
-- Cron-computed cache for the expensive COUNT(*) query. See
-- audit-speed-2026-04-18/FINDINGS.md. Run every 1h:
--   docker exec iku-postgres psql -U iku -d iku -f /tmp/precompute-video-counts.sql
--
-- 2026-04-19: moved from 15min to 1h frequency. The top-100 tag query does
-- unnest(tags) on 400K rows (~4M expanded rows) and was saturating PG CPU
-- to 100%, which tripped auto-heal.sh (which restarts PG when CPU > 80%).
-- The kill mid-query explains the "terminating connection due to
-- administrator command" cascade. Counts don't move fast enough to justify
-- 15min freshness. Also now filters dead_at IS NULL to match getVideos().
--
-- Key format matches buildCountCacheKey() in src/lib/content.ts:
--   v={all|hentai|3d}|s=all|rt={0|1}|lf={0|1}|t=

-- Bail out if the precompute would run longer than 4 min. auto-heal has
-- a 30min cooldown, so we'd rather skip this cycle than get force-killed
-- mid-write and leave the cache in a half-updated state.
SET statement_timeout = '4min';

CREATE TABLE IF NOT EXISTS videos_count_cache (
  key TEXT PRIMARY KEY,
  count BIGINT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reusable banned tag array. Keep in sync with scripts/banned-tags.ts.
-- The NOT(arr && banned) filter matches content.ts buildBannedSqlCondition().
DO $$
DECLARE
  banned TEXT[] := ARRAY[
    'loli','lolicon','lolidom','loli_focus',
    'shota','shotacon','shotadom','shota_focus',
    'child','children','minor','underage',
    'toddler','toddlercon','infant',
    'young_girl','young_boy','child_on_child','cub','baby',
    'oppai_loli','legal_loli','elementary_school','kindergarten','randoseru'
  ];
  hentai_sources TEXT[] := ARRAY['danbooru','gelbooru','rule34','wp','hentaicity','hentaigasm','sfmcompile'];
  threed_sources TEXT[] := ARRAY['rule34video'];
  long_sources TEXT[] := ARRAY['hentaicity','hentaigasm'];
  cnt BIGINT;
BEGIN
  -- v=all|s=all|rt=0|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=0|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=all|s=all|rt=1|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> '';
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=1|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=all|s=all|rt=0|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=0|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=all|s=all|rt=1|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> ''
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=1|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=0|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(hentai_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=0|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=1|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> ''
     AND source = ANY(hentai_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=1|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=0|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=0|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=1|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> ''
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=1|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=3d|s=all|rt=0|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(threed_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=3d|s=all|rt=0|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=3d|s=all|rt=1|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE dead_at IS NULL
     AND NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> ''
     AND source = ANY(threed_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=3d|s=all|rt=1|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- 3d + longFormat combos are empty (rule34video != hentaicity/hentaigasm) — insert 0
  INSERT INTO videos_count_cache(key, count) VALUES ('v=3d|s=all|rt=0|lf=1|t=', 0)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();
  INSERT INTO videos_count_cache(key, count) VALUES ('v=3d|s=all|rt=1|lf=1|t=', 0)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();
END$$;

-- Top-100 tag counts (user /tag/<tag> pages). Without this, every user tag
-- lookup runs a seq scan + banned-array filter that saturates the PG pool.
-- Only requireThumbnail=1 (rt=1) is cached — that matches the page query.
-- Key format: v=all|s=all|rt=1|lf=0|t=<tag>
INSERT INTO videos_count_cache(key, count)
SELECT
  'v=all|s=all|rt=1|lf=0|t=' || tag AS key,
  COUNT(*) AS count
FROM (
  SELECT unnest(tags) AS tag
    FROM videos
   WHERE dead_at IS NULL
     AND thumbnail <> ''
     AND NOT (tags && ARRAY[
       'loli','lolicon','lolidom','loli_focus',
       'shota','shotacon','shotadom','shota_focus',
       'child','children','minor','underage',
       'toddler','toddlercon','infant',
       'young_girl','young_boy','child_on_child','cub','baby',
       'oppai_loli','legal_loli','elementary_school','kindergarten','randoseru'
     ]::text[])
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && ARRAY[
       'loli','lolicon','shota','shotacon'
     ]::text[])
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && ARRAY[
       'loli','lolicon','shota','shotacon'
     ]::text[])
) expanded
WHERE tag NOT IN (
  'loli','lolicon','lolidom','loli_focus',
  'shota','shotacon','shotadom','shota_focus',
  'child','children','minor','underage',
  'toddler','toddlercon','infant',
  'young_girl','young_boy','child_on_child','cub','baby',
  'oppai_loli','legal_loli','elementary_school','kindergarten','randoseru'
)
GROUP BY tag
ORDER BY count DESC
LIMIT 100
ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

SELECT key, count, computed_at FROM videos_count_cache
 WHERE key NOT LIKE 'v=all|s=all|rt=1|lf=0|t=%'
    OR key = 'v=all|s=all|rt=1|lf=0|t='
 ORDER BY key;
