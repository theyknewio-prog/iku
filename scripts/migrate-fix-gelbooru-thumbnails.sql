-- One-shot data fix: 19,640 videos rows have thumbnail URLs pointing at the
-- bare gelbooru.com domain (e.g. https://gelbooru.com/thumbnails/xx/yy/foo.webp)
-- which returns 404. The correct subdomain is img3.gelbooru.com (verified
-- during the 2026-04-05 audit via Playwright E2E on /explore).
--
-- Visible symptom: ~11% broken images on /explore, ~8% on /character.
--
-- Run once:
--   psql $DATABASE_URL -f scripts/migrate-fix-gelbooru-thumbnails.sql
--
-- Idempotent: re-running is a no-op because matched rows have already been
-- rewritten to img3.gelbooru.com.

BEGIN;

UPDATE videos
SET thumbnail = REPLACE(thumbnail, 'https://gelbooru.com/', 'https://img3.gelbooru.com/')
WHERE thumbnail LIKE 'https://gelbooru.com/thumbnails/%';

-- Same fix for the preview column (large thumbnails use the same CDN).
UPDATE videos
SET preview = REPLACE(preview, 'https://gelbooru.com/', 'https://img3.gelbooru.com/')
WHERE preview LIKE 'https://gelbooru.com/thumbnails/%'
   OR preview LIKE 'https://gelbooru.com/images/%'
   OR preview LIKE 'https://gelbooru.com/samples/%';

COMMIT;
