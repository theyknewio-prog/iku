-- Strip "---hanime1me" suffix from hanime1 slugs (cosmetic artefact from the
-- hanime1 site's own slug convention). 16,586 rows affected.
--
-- Routing accepts any slug suffix on /watch/hn1-<id>-* (matched by ID), so the
-- old URLs still 200. We also add `/watch/<old_slug>` → `/watch/<new_slug>`
-- awareness via a canonical tag at render time (seo.ts).
BEGIN;

-- Backup (old_slug → new_slug) so we can restore if something breaks.
CREATE TABLE IF NOT EXISTS videos_slug_backup_20260420 (
  pk bigint PRIMARY KEY,
  old_slug text,
  new_slug text
);

INSERT INTO videos_slug_backup_20260420 (pk, old_slug, new_slug)
SELECT
  pk,
  slug AS old_slug,
  regexp_replace(slug, '-+hanime1me$', '') AS new_slug
FROM videos
WHERE source = 'hanime1' AND slug LIKE '%---hanime1me'
ON CONFLICT (pk) DO NOTHING;

-- Apply the cleanup. If a collision would occur (very rare — empty base slug)
-- skip the update by joining against a uniqueness filter.
WITH candidate AS (
  SELECT pk, regexp_replace(slug, '-+hanime1me$', '') AS new_slug
  FROM videos
  WHERE source = 'hanime1' AND slug LIKE '%---hanime1me'
),
safe AS (
  SELECT c.pk, c.new_slug
  FROM candidate c
  WHERE c.new_slug <> ''
    AND NOT EXISTS (
      SELECT 1 FROM videos v2
      WHERE v2.slug = c.new_slug AND v2.pk <> c.pk
    )
)
UPDATE videos v
SET slug = s.new_slug
FROM safe s
WHERE v.pk = s.pk;

COMMIT;

SELECT
  'remaining_slugs_with_suffix' AS metric,
  COUNT(*) AS n
FROM videos
WHERE source = 'hanime1' AND slug LIKE '%---hanime1me'
UNION ALL
SELECT 'backup_rows', COUNT(*) FROM videos_slug_backup_20260420;
