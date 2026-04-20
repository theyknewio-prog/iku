-- Decode HTML entities in video titles. Scrapers were storing raw HTML-encoded
-- text (e.g. "&#039;", "&amp;", "&quot;") straight from site <title>/<og:title>.
-- 1,970 rows affected as of 2026-04-20.
BEGIN;

CREATE TABLE IF NOT EXISTS videos_entity_backup_20260420 AS
SELECT pk, slug, title
FROM videos
WHERE title ~ '&(amp|quot|apos|lt|gt|#039|#39|Gt|Lt|nbsp|ndash|mdash|hellip);';

-- Decode the common set. Apply &amp; LAST so we don't double-decode (e.g.
-- "&amp;quot;" stays "&quot;" on the first pass and becomes `"` on the
-- second). Order matters.
UPDATE videos SET title = regexp_replace(title, '&#(0?39|apos);', '''', 'g')
WHERE title ~ '&#(0?39|apos);';

UPDATE videos SET title = replace(title, '&quot;', '"')
WHERE title LIKE '%&quot;%';

UPDATE videos SET title = regexp_replace(title, '&(gt|Gt);', '>', 'g')
WHERE title ~ '&(gt|Gt);';

UPDATE videos SET title = regexp_replace(title, '&(lt|Lt);', '<', 'g')
WHERE title ~ '&(lt|Lt);';

UPDATE videos SET title = replace(title, '&nbsp;', ' ')
WHERE title LIKE '%&nbsp;%';

UPDATE videos SET title = replace(title, '&ndash;', '-')
WHERE title LIKE '%&ndash;%';

UPDATE videos SET title = replace(title, '&mdash;', '—')
WHERE title LIKE '%&mdash;%';

UPDATE videos SET title = replace(title, '&hellip;', '…')
WHERE title LIKE '%&hellip;%';

-- &amp; last so "&amp;quot;" etc. now convert correctly (after the first
-- passes handle "quot" etc. as real entities, this cleans up the remaining
-- stray "&amp;").
UPDATE videos SET title = replace(title, '&amp;', '&')
WHERE title LIKE '%&amp;%';

COMMIT;

SELECT
  'remaining_encoded_titles' AS metric,
  COUNT(*) AS n
FROM videos
WHERE title ~ '&(amp|quot|apos|lt|gt|#039|#39|Gt|Lt|nbsp|ndash|mdash|hellip);'
UNION ALL
SELECT 'backup_rows', COUNT(*) FROM videos_entity_backup_20260420;
