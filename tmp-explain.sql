SET statement_timeout = 30000;
-- UNION ALL rewrite: each branch uses GIN index, planner combines efficiently
EXPLAIN (ANALYZE, BUFFERS)
WITH matches AS MATERIALIZED (
  SELECT pk FROM videos WHERE tags && ARRAY['naruto']::text[]
  UNION
  SELECT pk FROM videos WHERE characters && ARRAY['naruto']::text[]
  UNION
  SELECT pk FROM videos WHERE copyrights && ARRAY['naruto']::text[]
)
SELECT v.pk, v.source, v.source_id, v.slug, v.url, v.page_url, v.site, v.title,
       v.thumbnail, v.preview, v.score, v.favorites,
       v.tags, v.characters, v.copyrights, v.artists,
       v.width, v.height, v.file_size, v.duration, v.created_at
FROM videos v
JOIN matches m ON m.pk = v.pk
WHERE NOT (v.tags && ARRAY['loli','lolicon','lolidom','loli_focus','shota','shotacon','shotadom','shota_focus','child','children','minor','underage','toddler','toddlercon','infant','young_girl','young_boy','child_on_child','cub','baby','oppai_loli','legal_loli','elementary_school','kindergarten','randoseru']::text[])
  AND v.thumbnail IS NOT NULL AND v.thumbnail <> ''
ORDER BY v.score DESC, v.created_at DESC
LIMIT 21;
