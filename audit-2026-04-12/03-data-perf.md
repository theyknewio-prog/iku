# Agent 3 — Data pipeline + perf audit (2026-04-11)

## P0 findings

### 1. Character browse empty for NEW content — root cause confirmed

Both hentaicity + hentaigasm scrapers **hardcode empty arrays** for characters/copyrights:

- `scripts/scrape-hentaigasm.ts` line 206-207: `characters: [] as string[], copyrights: [] as string[]`
- `scripts/scrape-hentaicity.ts`: same pattern

DB confirms:
```
Source          With Characters  Total   % Enriched
danbooru        15,809           17,093  92.5%  ✓
rule34video     0                276,878 0.0%   ✗
rule34          0                19,997  0.0%   ✗
gelbooru        0                19,640  0.0%   ✗
wp              0                13,049  0.0%   ✗
hentaicity      0                4,582   0.0%   ✗
hentaigasm      0                2,697   0.0%   ✗
```

**Only Danbooru has character data**. The entire "character browse" feature runs on ~15K Danbooru rows out of 353K total. Sab's exact complaint: "la page character browse hentai est meme pas enrichi avec le nouveau contenu d'hier".

**Fix**: scrapers need HTML parsing for character/copyright extraction, then re-run to backfill the 7,279 new videos + ideally backfill the 330K+ existing videos from other sources.

### 2. Main scrapers STALE 8+ days

| Source | Count | Last Updated | Status |
|--------|-------|--------------|--------|
| rule34video | 276,878 | **2026-04-03** | 8 days stale |
| rule34 | 19,997 | **2026-04-04** | 7 days stale |
| gelbooru | 19,640 | **2026-04-03** | 8 days stale |
| danbooru | 17,093 | **2026-04-03** | 8 days stale |
| wp | 13,049 | **2026-04-04** | 7 days stale |
| hentaicity | 4,582 | 2026-04-11 | FRESH |
| hentaigasm | 2,697 | 2026-04-11 | FRESH |

Only hentaicity + hentaigasm ran in the last 3 days. The 5 GitHub Actions cron scrapers (`.github/workflows/daily-scrape.yml`) have either not run or are silently failing. Need to check Actions tab + logs.

**Why this matters**: site advertises "353K+ fresh hentai daily" but the main catalog hasn't moved in over a week. Every visitor who came from a hentaicity/hentaigasm keyword sees fresh content, but Rule34Video users (~78% of catalog) see a frozen index.

### 3. Homepage TTFB 1.1s

Sab said "tout est redevenu lent" — confirmed. TTFB measured from server itself:
```
HTTP/2 200 → 1.128s
```

Root cause: `src/app/page.tsx` lines 95-108 do sequential `await getVideos(...)` calls before any rendering. No `<Suspense>`, no streaming. Combined with:
- App container CPU 102% single-core (Next.js is mono-thread)
- PG container CPU 235% (2+ cores sustained)

Fix: split into priority tiers + wrap each section in `<Suspense>` with a fallback skeleton so hero ships immediately and lower-fold streams in. Target <500ms TTFB.

## P1 findings

### 4. WP scraper crashing with DNS error

Log:
```
[Error] EAI_AGAIN: temporary DNS resolution failure for 'iku-postgres'
```
WP scraper can't reach the PG container. Transient but recurring. Docker network flake. Needs investigation — either rescrapes run before PG is ready, or network aliasing broke.

### 5. Corrupted timestamps in `resolved_urls`

```sql
SELECT MIN(expires_at), MAX(expires_at) FROM resolved_urls;
→ min: 2026-04-11 17:17, max: 3025-04-11
```

Some cached entries have `expires_at` set to year 3025. Pure bug in the URL resolution code that writes invalid timestamps. No functional harm (they're just "never expire"), but it's a real latent bug.

### 6. 582 expired cache entries not being refreshed

5.3% of `resolved_urls` are stale. Warmup loop runs every 30 min, 500 URLs at a time, but isn't rotating through the stale ones. Need to prioritize expired entries in the warmup query.

## P2 findings

### 7. No slow query logging on PG

- `pg_stat_statements` not installed
- `log_min_duration_statement` not set

Can't diagnose which query is eating the 235% CPU without enabling logging.

### 8. Sustained PG CPU 235%

Probably caused by the stale warmup loop re-resolving the same 500 URLs every 30 min + the sequential homepage queries. Should improve once (3) is fixed. Needs re-measurement after.

## Healthy ✓

- **Crons alive**: Discord bots (daily-drop, new-releases, hidden-gems, weekly-top, character), Reddit karma, link-building, SEO autopilot, Telegram autopost, weekly monitoring — all ran in the last 24h.
- **Scraper completeness**: hentaicity + hentaigasm both logged clean complete runs (0 errors, banned content filtered).
- **Cache warmup**: resolved 496/500 URLs in 34.4s last run. 99% success rate.
- **Indexes**: GIN on tags (30M tuple reads), copyrights, characters all heavily used and appropriate.
- **DB size**: `videos` table 509 MB. Not concerning.
- **Tags**: 95,419 distinct tags, properly populated across all sources.
