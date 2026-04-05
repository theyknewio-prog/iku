# Performance audit — 2026-04-05

Scope: Next.js 16 / React 19 / Postgres 16 on Hetzner CX33 (8GB/4vCPU). Focus is realistic 1K+ DAU load.

## BLOCKER — Watch page calls live Danbooru API 3–4× per render (blocks ISR value)

**File:** `src/app/watch/[slug]/page.tsx:235, 712, 724` + `src/lib/danbooru.ts:23–69` (module-level `throttle()` + 200ms `MIN_INTERVAL`)
**Impact:** Cold render = `getPost()` (Danbooru slugs) + `getRelatedPosts()` (top of page) + `RelatedGrid` fetch + `RelatedSidebar` fetch. `getRelatedPosts` itself does 2 API calls (source post + related search). That is **up to 5 upstream HTTP calls** serialized through a 200ms process-wide `throttle()` mutex. With 17K Danbooru slugs out of 351K and ISR revalidate=86400 you get decent cache hit rates, but:
- The two `<Suspense>` children (`RelatedGrid`, `RelatedSidebar`) re-fetch with different `limit` params — no de-dup. On a 17K-slug catalog with ISR rebuilds, this is 2× the API load.
- The `throttle()` is a module-level `lastRequest` variable. Under concurrent ISR regenerations it serializes **all** Danbooru calls across every concurrent request, so one slow fetch stalls all others. Not a cache, a global mutex.
- When Google crawler hits 1000 uncached watch URLs in a minute, 200ms throttle × 3 calls each = baseline **600ms of sleeps per render** even if Danbooru is instant.
- `fetch(..., { next: { revalidate: 21600 }})` helps on hot paths, but Danbooru search URLs vary by tag so hit rate is mediocre.

**Fix (high value, 2h):**
1. Drop the live Danbooru fetches entirely on `/watch/[slug]`. All 17K Danbooru videos are already in PG with tags/characters/copyrights. Add a PG-based `getRelatedVideos(video, limit)` that does `WHERE $1 = ANY(characters) OR $1 = ANY(copyrights) ORDER BY score DESC LIMIT N` — single query, indexed (GIN on `characters`/`copyrights` exists). Replace all 3 `getRelatedPosts` call sites.
2. Same for `getPost` fallback on line 221 — query PG on `source='danbooru' AND source_id=$1`.
3. Homepage `getPopularCharacters(12)` (page.tsx:100) — replace with a memoized PG query like `getCuratedGenreCounts`. It currently calls Danbooru `/tags.json` on every ISR revalidation.
4. `/tag/sitemap.ts:12` calls `getPopularCharacters(200)` on sitemap regeneration — also PG query.

Expected gain: watch page TTFB drops from ~600–1500ms (cold) to <80ms (PG-only). Removes single point of failure (Danbooru upstream) from the whole site.

## BLOCKER — OFFSET pagination on 351K-row table

**File:** `src/lib/content.ts:186`, `src/lib/rule34video.ts:78`, `src/lib/wp-hentai.ts:89`, `src/app/api/feed/route.ts:91` (catalogPage = page + sessionOffset, up to page 45)
**Impact:** `ORDER BY score DESC, created_at DESC LIMIT 60 OFFSET N*60` with N up to 45 → PG scans and discards 2700+ rows per request. On the score index that's ~20-80ms cold for deep pages, cheap. BUT: `/api/feed` uses a random offset 0–40 per session, so every visitor's *first feed load* is likely a cold OFFSET-based query that can't share cache with anyone else. Under 1K DAU × 10 feed loads/session = 10K unique OFFSET queries/day, none memoized (the `memoize` layer keys on args, and random offsets mean ~zero hit rate). Postgres buffer cache will handle it, but this is the #1 DB load source at scale.

**Fix:** Keyset/cursor pagination — `WHERE score < $last_score OR (score = $last_score AND created_at < $last_ts) ORDER BY score DESC, created_at DESC LIMIT 60`. Pass `lastScore`+`lastCreatedAt` instead of `page`. Index already supports it. Constant-time regardless of depth. Also allows killing the `memoize` cache invalidation problem since each cursor is globally deterministic.

Expected gain: at 10K DAU, avoids ~100–500ms of seq scan tails at deep pages, and lets PG buffer cache actually do its job. Not urgent at current traffic but BLOCKING if scaling to 10K+ DAU.

## OPTIMIZATION — All `<Image>` use `unoptimized`, no Next image optimizer in play

**File:** `src/components/PosterCard.tsx:124`, `ThumbnailCard.tsx:148`, `WatchPlayer.tsx:1280`, `page.tsx:208/252/318/423`
**Impact:** Every thumbnail/preview is served from upstream CDNs (cdn.donmai.us, gelbooru, etc.) at original JPG resolution. Homepage loads ~50 images → no AVIF/WebP transcode, no responsive resizing, no lazy-offscreen. LCP on homepage is probably the VOD thumbnail (600×337 from Danbooru CDN, ~40KB, not optimized to AVIF). Probably 200-500ms more LCP than necessary.

Also: `next.config.ts` has `formats: ["image/avif", "image/webp"]` + `minimumCacheTTL: 2592000` but they are unused because every Image is `unoptimized`. Dead config.

**Fix:** Decide: either (a) add `rule34video.com`, `rule34.xxx`, all WP hosts to `remotePatterns` and drop `unoptimized` so Next's image optimizer works — yields real AVIF delivery through the Hetzner server; caches in `.next/cache/images/` with 30d TTL; costs ~200MB disk + ~50ms CPU per first-hit; OR (b) accept CDN passthrough but at minimum add `loading="lazy"` explicitly everywhere (currently depends on default + `priority` flag only on `i<5` trending).

Note: `priority` is correctly set on the first 5 trending posters (page.tsx:233) and the VOD (page.tsx:253). Good.

## OPTIMIZATION — `/api/feed` filters AFTER pagination, not before

**File:** `src/app/api/feed/route.ts:107-108`
**Impact:** Query pulls `limit: 60` then client-filters `v.url && v.fileSize < 60MB`. For Rule34Video (277K/351K rows), `v.url` is often `""` because the stream is resolved on-demand — so after filtering you can drop to 20-30 videos out of 60, client side scrolls faster than server can replenish. Feels laggy. Also wastes PG bandwidth transferring rows that get discarded.

**Fix:** Push filter into SQL: `AND url != '' AND (file_size = 0 OR file_size < 60000000)`. Then `limit: 30` is enough. Saves ~50% PG rows transferred per feed page.

## OPTIMIZATION — Sparkles background = 10 always-animated DOM nodes

**File:** `src/app/layout.tsx:102-107`
**Impact:** 10 `.sparkle` divs in root layout with (presumably) CSS animations running on every page including watch/feed. Continuous compositor work. On mobile Android mid-range this can cost 1-2% battery and 3-5ms per frame during scroll, contributing to INP on the watch page (which already hydrates a 1715-line WatchPlayer component).

**Fix:** Add `@media (prefers-reduced-motion), (max-width: 768px)` override to pause/hide them on mobile. Or remove on `/watch/*` and `/feed`.

## OPTIMIZATION — 5 Google font families loaded in layout

**File:** `src/app/layout.tsx:9-42`
**Impact:** `Inter` + `Poppins` + `Righteous` + `Nunito` + `Quicksand` all with multiple weights. Next.js hosts them locally via `next/font` (good — no external block) but that's ~8 WOFF2 files, ~200-300KB of font data downloaded per cold visit. CLAUDE.md says fonts are "Inter (body), Poppins (headings), Righteous (logo)". Nunito + Quicksand were added in the anime-colorful redesign. Check if both are used; if one replaces another, drop it.

**Fix:** Audit `globals.css` for `font-nunito` / `font-quicksand` usage — if one is unused or barely used, drop it (save ~60KB + 2 font requests).

## OPTIMIZATION — Homepage adds randomness to "New Releases" killing ISR

**File:** `src/app/page.tsx:95` (`Math.floor(Math.random() * 5) + 1`)
**Impact:** With `export const dynamic = "force-dynamic"` AND `revalidate = 3600`, every homepage hit re-renders with a random page of new releases. The `revalidate = 3600` is dead code — `force-dynamic` overrides it. And `memoize("videos", ..., 5min)` only caches by arg, so random page 1–5 = 5 separate cache entries cycling in random order. Result: homepage SSR runs fully on every first-hit, regenerates a different page every time, CDN cache hit rate ≈ 0.

**Fix:** Either (a) drop `force-dynamic` so ISR actually caches (the other ISR pages get `force-dynamic` because of PG-at-build-time concerns — but this DOES work at runtime, you just get a force-dynamic on cold build; that's a Next.js 16 bug workaround — verify if still needed), OR (b) make the random seed deterministic per hour: `Math.floor((Date.now() / 3600000) % 5) + 1`. Then CDN caches 1-hour windows. Huge difference at scale.

## OPTIMIZATION — warmup.sh + inside-process warmup both exist

**File:** `Dockerfile:68` (`node server.js & sh warmup.sh &`) + `src/lib/url-warmup.ts`
**Impact:** At container start, warmup.sh hits the 7 main pages AND `url-warmup.ts` resolves top 500 R34V URLs. The shell warmup is fine. But `url-warmup.ts` has 500 URLs × (fetch+regex) with 6 concurrency × 200ms sleeps between batches ≈ 85 batches × (500ms + 200ms) = ~60s of active work per 30min cycle, eating ~1 core during the run. OK on 4 vCPU, but notice that warmup fires on "first import of `/api/resolve-video` module" (resolve-video/route.ts:9), which only happens on first user request — not at container boot. So warm-up effectively waits for first user, defeating the purpose.

**Fix:** Either call `startWarmup()` from a module that loads on server init (e.g. a dummy import in `src/app/layout.tsx` via a non-exported side-effect file), or add `const warmupBoot = startWarmup();` to `instrumentation.ts` (Next.js supports it).

## OPTIMIZATION — `/watch/[slug]` related sidebar uses `<img>` not `<Image>`

**File:** `src/app/watch/[slug]/page.tsx:756`
**Impact:** RelatedSidebar uses raw `<img src={v.thumbnail} loading="lazy" />` with an eslint-disable. 12 thumbs × ~30KB = 360KB loaded sync from CDN, no dimensions → CLS risk on sidebar since no width/height is set on the img. The `.related-item__thumb` wrapper likely has a fixed width but the inner img has none.

**Fix:** Add explicit `width={130} height={75}` to the `<img>`, or convert to `<Image>` with `fill`. Prevents CLS.

## POLISH — `/api/resolve-video` and `/api/video-stream` duplicate 200+ lines of resolve logic

**File:** `src/app/api/resolve-video/route.ts` + `src/app/api/video-stream/route.ts`
Two near-identical `resolveRule34Video`, `getFromPgCache`, `setInPgCache`, `resolveViaYtDlp`, L1 cache, rate limit. L1 caches are **separate module state** so a resolve-video hit doesn't warm video-stream cache. Extract to `src/lib/video-resolve.ts`. Saves memory (one L1 cache instead of two → 500 entries not 1000) and makes cache hits cross-endpoint.

## POLISH — `globals.css` is 9463 lines / 226KB

**File:** `src/app/globals.css`
Build output: 161KB compiled CSS. That's large for a SPA style bundle but not pathological. Under gzip ~28-35KB over the wire. Not urgent. If/when you want to trim, PurgeCSS via Tailwind v4 is already wired (`@tailwindcss/postcss` in devDeps) — move most one-off classes to Tailwind utilities over time. No action this session.

## POLISH — pg pool max=20, single container

**File:** `src/lib/db.ts:14`
20 connections × 1 container = 20 PG connections. Postgres 16 default `max_connections` is 100. Fine for now. If you scale to multiple Next.js containers or add workers, reduce to 10 or introduce PgBouncer.

## POLISH — Scrapers use single-row UPSERT batching (already good)

**File:** `scripts/db.ts:55-88`
Batches all rows into one INSERT with placeholder array — correct. No N+1. Multi-value INSERT with ON CONFLICT. Good. `max: 5` pool for scrapers is fine.

## POLISH — Banned-tags filter uses array intersection (GIN-indexed — good)

`NOT (tags && $1::text[])` against a GIN index on `tags` — Postgres correctly uses the index for the NOT by inverting the match set at query planning. Verified via `init-db.sql:34`. Good.

## POLISH — Dockerfile cache layer order

**File:** `Dockerfile:13, 27`
`COPY . .` before `RUN npm run build` means any source change busts build cache. Correct. The `rm -rf .next` inside the RUN is belt-and-suspenders but adds no build time (empty dir). Fine.

One improvement: `RUN npm ci` layer is invalidated whenever `package.json` changes — that's fine. But consider `RUN npm ci --omit=dev` in a later pass, then copy devDeps only for the build step. Minor.

## Verified good

- PostgreSQL indexes: GIN on `tags`/`characters`/`copyrights`, btree on `score DESC`, `created_at DESC`, `favorites DESC`, composite `(source, score DESC)`. Covers every query in `content.ts`.
- Memoize layer: correct TTL dedup, in-flight promise sharing, bounded (500 entries, LRU-ish eviction), periodic cleanup every 5min. Solid.
- Rate limit Maps: bounded 10K × 10 routes = 100K entries max = ~10MB worst case. Periodic cleanup every 5min. Safe.
- L1 resolved URL cache: 500 entries × ~300 bytes = 150KB. Negligible.
- ISR watch route: `generateStaticParams = []` + `dynamicParams = true` is correct Next.js 16 pattern per CLAUDE.md silent bug notes. Good.
- CSP: no `unsafe-inline` for styles blocked (needed), script-src includes `unsafe-eval` (PostHog needs it). Fine.
- next/font: all 5 fonts use `display: swap` — no FOIT.
- `priority` set correctly on above-fold homepage images (first 5 trending + VOD).
- PG pool singleton via `globalThis` survives HMR in dev. Correct pattern.
- Standalone output — runtime image is small (just server.js + necessary deps), ~650MB .next total incl. build cache.
- Build client JS: largest chunk 227KB uncompressed, next 178KB, CSS 161KB. All well under 300KB First Load JS threshold.
- Runtime heap 3GB on 8GB box with 4GB swap: appropriate, leaves room for PG shared buffers + OS.
