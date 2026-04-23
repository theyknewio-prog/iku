-- precompute-aggregates.sql
--
-- Hourly cron: refresh heavy aggregation queries used by homepage + footer.
-- Previously _getCuratedGenreCounts, _getPopularTagsFromPg,
-- _getPopularCharactersFromPg, _getTopGames, _getTopTags, _getTopCharacters
-- ran live unnest(tags|chars|copyrights) over 150K+ rows (=1.5M+ expanded
-- rows) on every cache miss. Result: 10s statement_timeouts, 500s to users,
-- Googlebot marks iku.gg as unreliable. See investigation 2026-04-23.
--
-- Pattern mirrors precompute-video-counts.sql. Statement timeout bounded so
-- auto-heal doesn't fire. Safe to run alongside the counts precompute.

SET statement_timeout = '4min';

CREATE TABLE IF NOT EXISTS precompute_aggregates (
  kind TEXT NOT NULL,
  rank INT NOT NULL,
  name TEXT NOT NULL,
  count INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kind, rank)
);

CREATE INDEX IF NOT EXISTS idx_precompute_aggregates_kind_rank
  ON precompute_aggregates(kind, rank);

-- Shared banned-tag + filter variables. Keep in sync with scripts/banned-tags.ts
-- and src/lib/content.ts buildBannedSqlCondition().
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
  curated_names TEXT[] := ARRAY[
    'yuri','yaoi','vanilla','netorare','mind_control','monster','schoolgirl',
    'mature','teacher','nurse','maid','futa','milf','elf','catgirl','tentacles',
    'cosplay','bondage','group','ahegao','creampie','oral','threesome'
  ];
  footer_tag_blacklist TEXT[] := ARRAY[
    'animated','sound','1girl','1boy','solo','hetero','video','tagme','highres',
    'absurdres','long_hair','short_hair','breasts','small_breasts','commentary',
    'english_commentary','japanese_text','artist_name','signature','with','the',
    'and','1girls','2girls','multiple_girls','looking_at_viewer','nipples',
    'pussy','penis','completely_nude','nude','naked'
  ];
BEGIN
  -- === 1. curated_genres: count videos per curated tag name =================
  DELETE FROM precompute_aggregates WHERE kind = 'curated_genres';

  INSERT INTO precompute_aggregates(kind, rank, name, count)
  SELECT 'curated_genres',
         ROW_NUMBER() OVER (ORDER BY count DESC, tag ASC),
         tag,
         count
  FROM (
    SELECT tag, COUNT(*)::int AS count
    FROM (
      SELECT unnest(tags) AS tag
      FROM videos
      WHERE dead_at IS NULL
        AND NOT (tags && banned)
        AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
        AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
    ) t
    WHERE tag = ANY(curated_names)
    GROUP BY tag
  ) agg
  WHERE count > 0;

  -- === 2. popular_tags: top 200 tags globally ================================
  DELETE FROM precompute_aggregates WHERE kind = 'popular_tags';

  INSERT INTO precompute_aggregates(kind, rank, name, count)
  SELECT 'popular_tags',
         ROW_NUMBER() OVER (ORDER BY count DESC, tag ASC),
         tag,
         count
  FROM (
    SELECT tag, COUNT(*)::int AS count
    FROM (
      SELECT unnest(tags) AS tag
      FROM videos
      WHERE dead_at IS NULL
        AND NOT (tags && banned)
        AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
        AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
    ) t
    WHERE tag <> '' AND tag <> ANY(banned)
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 200
  ) agg;

  -- === 3. popular_chars: top 100 characters globally =========================
  DELETE FROM precompute_aggregates WHERE kind = 'popular_chars';

  INSERT INTO precompute_aggregates(kind, rank, name, count)
  SELECT 'popular_chars',
         ROW_NUMBER() OVER (ORDER BY count DESC, ch ASC),
         ch,
         count
  FROM (
    SELECT ch, COUNT(*)::int AS count
    FROM (
      SELECT unnest(characters) AS ch
      FROM videos
      WHERE dead_at IS NULL
        AND NOT (tags && banned)
        AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
        AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
        AND characters IS NOT NULL
        AND array_length(characters, 1) > 0
    ) t
    WHERE ch <> '' AND ch <> ANY(banned)
    GROUP BY ch
    ORDER BY count DESC
    LIMIT 100
  ) agg;

  -- === 4. top_games: top 100 copyrights (minus 'original') ====================
  DELETE FROM precompute_aggregates WHERE kind = 'top_games';

  INSERT INTO precompute_aggregates(kind, rank, name, count)
  SELECT 'top_games',
         ROW_NUMBER() OVER (ORDER BY count DESC, copy ASC),
         copy,
         count
  FROM (
    SELECT copy, COUNT(*)::int AS count
    FROM (
      SELECT unnest(copyrights) AS copy
      FROM videos
      WHERE dead_at IS NULL
        AND NOT (tags && banned)
        AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
        AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
        AND array_length(copyrights, 1) > 0
    ) t
    WHERE copy <> '' AND copy NOT IN ('original')
    GROUP BY copy
    ORDER BY count DESC
    LIMIT 100
  ) agg;

  -- === 5. top_tags_footer: 120 tags, then filtered to 48 in app ==============
  DELETE FROM precompute_aggregates WHERE kind = 'top_tags_footer';

  INSERT INTO precompute_aggregates(kind, rank, name, count)
  SELECT 'top_tags_footer',
         ROW_NUMBER() OVER (ORDER BY count DESC, tag ASC),
         tag,
         count
  FROM (
    SELECT tag, COUNT(*)::int AS count
    FROM (
      SELECT unnest(tags) AS tag
      FROM videos
      WHERE dead_at IS NULL
        AND NOT (tags && banned)
        AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
        AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
    ) t
    WHERE tag <> ''
      AND NOT (tag = ANY(banned))
      AND NOT (tag = ANY(footer_tag_blacklist))
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 120
  ) agg;

  -- === 6. top_chars_footer: top 48 characters (same query as popular_chars but
  --        stored separately so the /character index and footer can diverge if
  --        we later want different filters) ===================================
  DELETE FROM precompute_aggregates WHERE kind = 'top_chars_footer';

  INSERT INTO precompute_aggregates(kind, rank, name, count)
  SELECT 'top_chars_footer',
         ROW_NUMBER() OVER (ORDER BY count DESC, ch ASC),
         ch,
         count
  FROM (
    SELECT ch, COUNT(*)::int AS count
    FROM (
      SELECT unnest(characters) AS ch
      FROM videos
      WHERE dead_at IS NULL
        AND NOT (tags && banned)
        AND NOT (COALESCE(characters, ARRAY[]::text[]) && banned)
        AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && banned)
        AND array_length(characters, 1) > 0
    ) t
    WHERE ch <> '' AND ch <> ANY(banned)
    GROUP BY ch
    ORDER BY count DESC
    LIMIT 48
  ) agg;
END$$;

-- Sanity: report what got stored
SELECT kind, COUNT(*) AS rows, MIN(computed_at) AS refreshed_at
FROM precompute_aggregates
GROUP BY kind
ORDER BY kind;
