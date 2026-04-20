-- Fix hanime1 bilingual titles stored as "JP|EN" — keep the Latin portion.
-- 231 rows affected as of 2026-04-20.
BEGIN;

-- Backup
CREATE TABLE IF NOT EXISTS videos_title_backup_20260420 AS
SELECT pk, slug, title
FROM videos
WHERE source = 'hanime1' AND title LIKE '%|%';

-- For each bilingual title, pick the portion with the most Latin characters.
-- Postgres doesn't have a native "pick best by regex count" so we unnest
-- all parts, score them, and keep the top-scored one per row.
WITH scored AS (
  SELECT
    v.pk,
    part,
    length(regexp_replace(part, '[^a-zA-Z]', '', 'g')) AS latin_count,
    ROW_NUMBER() OVER (
      PARTITION BY v.pk
      ORDER BY length(regexp_replace(part, '[^a-zA-Z]', '', 'g')) DESC, ord
    ) AS rn
  FROM videos v,
       LATERAL unnest(string_to_array(v.title, '|')) WITH ORDINALITY AS t(part, ord)
  WHERE v.source = 'hanime1' AND v.title LIKE '%|%'
),
best AS (
  SELECT pk, trim(part) AS best_title FROM scored WHERE rn = 1
)
UPDATE videos v
SET title = b.best_title
FROM best b
WHERE v.pk = b.pk
  AND b.best_title <> ''
  AND b.best_title <> v.title;

COMMIT;

SELECT
  'bilingual_remaining' AS metric,
  COUNT(*) AS n
FROM videos
WHERE source = 'hanime1' AND title LIKE '%|%'
UNION ALL
SELECT 'backup_rows', COUNT(*) FROM videos_title_backup_20260420;
