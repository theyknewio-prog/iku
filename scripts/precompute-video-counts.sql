-- precompute-video-counts.sql
--
-- Cron-computed cache for the expensive COUNT(*) query. See
-- audit-speed-2026-04-18/FINDINGS.md. Run every 15 min:
--   docker exec iku-postgres psql -U iku -d iku -f /tmp/precompute-video-counts.sql
--
-- Key format matches buildCountCacheKey() in src/lib/content.ts:
--   v={all|hentai|3d}|s=all|rt={0|1}|lf={0|1}|t=

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
  hentai_sources TEXT[] := ARRAY['danbooru','gelbooru','rule34','wp','hentaicity','hentaigasm'];
  threed_sources TEXT[] := ARRAY['rule34video'];
  long_sources TEXT[] := ARRAY['hentaicity','hentaigasm'];
  cnt BIGINT;
BEGIN
  -- v=all|s=all|rt=0|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=0|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=all|s=all|rt=1|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> '';
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=1|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=all|s=all|rt=0|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=0|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=all|s=all|rt=1|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> ''
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=all|s=all|rt=1|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=0|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(hentai_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=0|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=1|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> ''
     AND source = ANY(hentai_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=1|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=0|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=0|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=hentai|s=all|rt=1|lf=1
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND thumbnail IS NOT NULL AND thumbnail <> ''
     AND source = ANY(long_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=hentai|s=all|rt=1|lf=1|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=3d|s=all|rt=0|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
     AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
     AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
     AND source = ANY(threed_sources);
  INSERT INTO videos_count_cache(key, count) VALUES ('v=3d|s=all|rt=0|lf=0|t=', cnt)
    ON CONFLICT (key) DO UPDATE SET count = EXCLUDED.count, computed_at = NOW();

  -- v=3d|s=all|rt=1|lf=0
  SELECT COUNT(*) INTO cnt FROM videos
   WHERE NOT (tags && banned)
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

SELECT key, count, computed_at FROM videos_count_cache ORDER BY key;
