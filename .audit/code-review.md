# Code review — 2026-04-05

Reviewer: Senior Code Reviewer (Claude Opus 4.6)
Scope: architecture, code quality, maintainability, technical debt
Context: 4 days of mega-sessions, ~120K LoC, about to launch Stripe subscriptions.

**Overall grade: B-.** Architecture is mostly sound. TS strict mode is on, `any` usage is minimal, imports are consistent (`@/` everywhere, zero relative parent paths — impressive for this pace). The critical files (`auth.ts`, `content.ts`, `gamification.ts`) are well-commented and reasonably tight. But there are **three blocker-class bugs in the Stripe payment path** and a pile of accumulated debt that will bite hard in 6 months. Fix the 🔴 items before flipping the subscription switch on.

---

## 🔴 URGENT (must fix before subscription launch)

### 1. Stripe webhook dedup races the handler — can silently drop payments

**File:** `src/app/api/stripe/webhook/route.ts:49-62`

The INSERT into `stripe_events` happens **before** the handler runs. If the handler throws (PG down, network blip, bug), the event is marked processed, we return 200, and Stripe never retries. The user has paid and `users.pro_status` is never updated. Pure money-loss silent failure.

```ts
// Current flow (BROKEN):
INSERT stripe_events ... ON CONFLICT DO NOTHING  // marks "processed"
if (rowCount === 0) return 200                    // dedup ok
try { switch(event.type) { ... await handle... }  // <-- throws here
} catch (err) { console.error(err) }              // swallowed
return 200                                        // Stripe will NEVER retry
```

**Fix:** either (a) insert AFTER successful handling, or (b) add a `processed_at TIMESTAMPTZ` column and only set it after the switch succeeds; on retry, re-check `processed_at IS NULL` and re-run. Also, on handler exception return **500** so Stripe retries. Right now line 100 explicitly returns 200 on errors — wrong default for critical side-effects.

### 2. Stripe webhook handler errors are swallowed to console

**File:** `src/app/api/stripe/webhook/route.ts:98-101`

```ts
} catch (err) {
  console.error("stripe webhook handler error:", err);
  // Still return 200 so Stripe doesn't retry indefinitely on bugs
}
```

Comment justifies it as "don't retry indefinitely" — but that's what exponential backoff + max-retries is for in Stripe. Returning 200 on a broken handler means you will never know a payment wasn't applied unless you grep logs. Combined with bug #1, this is the top production risk on the site right now. At minimum: return 500 and add alerting (Sentry, Telegram bot, anything) on this log line.

### 3. `handleCheckoutCompleted` for subscriptions is a no-op

**File:** `src/app/api/stripe/webhook/route.ts:144-146`

```ts
// ── Subscription — the subscription.created event will handle the details ──
// Just mark stripe_customer_id above; subscription.updated will sync the rest.
```

This _assumes_ `customer.subscription.created` will fire AFTER `checkout.session.completed`. In practice, Stripe often delivers them out-of-order or in parallel. If `subscription.created` arrives first, the lookup by `sub.metadata.user_id` works, but if metadata isn't propagated (edge cases exist — e.g., `subscription_data.metadata` not set for the inaugural event), the subscription fires with no user_id and is silently dropped at line 151 (`console.error + return`). Test locally with Stripe CLI `stripe listen` + `stripe trigger checkout.session.completed` with a real subscription price before launch. Add a fallback: in `handleCheckoutCompleted`, if `session.mode === "subscription"`, fetch the subscription via API and call `handleSubscriptionUpdate` synchronously. Belt + braces.

### 4. `invoice.payment_succeeded` type coercion — Stripe deprecated `invoice.subscription`

**File:** `src/app/api/stripe/webhook/route.ts:82-89`

```ts
const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
if (invoice.subscription) { ... }
```

The `& { subscription?: string }` cast exists precisely because the modern Stripe types don't have `.subscription` on `Invoice` anymore (it moved to `invoice.parent.subscription_details.subscription` in 2024+ API versions). Depending on your pinned Stripe API version, this field may be `undefined` at runtime → the `if` fails → `pro_current_period_end` is never refreshed on renewals → users lose Pro when their period ends even though they paid. Verify against the API version Stripe is sending you (check `event.api_version`) and use the correct path.

### 5. Cast `subWithPeriodEnd` with optional `current_period_end`

**File:** `src/app/api/stripe/webhook/route.ts:177-180`

Same pattern — you're casting to work around types because in API 2025+, `current_period_end` moved to `sub.items.data[0].current_period_end`. If the cast fails at runtime, `periodEnd` is null → `pro_current_period_end` set to NULL → every "are they still Pro?" check that compares `NOW() < period_end` treats them as expired. Read from the correct path or pin the Stripe API version explicitly in `src/lib/stripe.ts` (`new Stripe(key, { apiVersion: "2024-06-20" })`) so you control the shape.

### 6. `/api/favorites` POST has no rate limit

**File:** `src/app/api/favorites/route.ts:32-84`

Every other API route has a rate limiter; this one doesn't. An authenticated user can POST 1 slug at a time in a tight loop to bloat the DB. Cap at something like 60/min or use the same Map pattern used elsewhere. Same goes for `/api/history` POST (verify). Not a data-loss issue, but trivial DoS of your own DB.

---

## 🟠 HIGH (big technical debt)

### 7. `src/data/*.json` — 121 MB of dead weight in the repo

```
rule34video-videos.json  84M
videos.json              12M
rule34-videos.json       11M
gelbooru-videos.json    9.7M
wp-hentai-videos.json   4.2M
```

Nothing imports these anymore (Grep for `@/data/gelbooru-videos` etc. — zero matches). The PG migration was done but the legacy files were never deleted. They inflate every `git clone`, every Docker build context, every GitHub Actions checkout. Delete them and commit. Instant 120 MB win across every layer.

Also `src/data/content-queue.json` (304K) — verify it's used by the publish-scheduled script; if not, same treatment.

### 8. Blog data mutation at module load time — bad smell, brittle

**Files:** `src/data/blog.ts:895-901`, `blog-new.ts`, `blog-seo-push.ts`

```ts
export const BLOG_ARTICLES: BlogArticle[] = [ ... big array ... ];

// Merge new articles
import { NEW_BLOG_ARTICLES } from "./blog-new";
BLOG_ARTICLES.push(...NEW_BLOG_ARTICLES);

import { SEO_PUSH_ARTICLES } from "./blog-seo-push";
BLOG_ARTICLES.push(...SEO_PUSH_ARTICLES);
```

Problems: (1) mutating an `export const` defeats the purpose of `const`; (2) module load order now matters — if anything imports `BLOG_ARTICLES` before this file finishes loading, they get a partial array; (3) hot-reload in dev can double-push and duplicate articles until full restart; (4) bundlers may tree-shake differently based on this side effect. Fix:

```ts
import { NEW_BLOG_ARTICLES } from "./blog-new";
import { SEO_PUSH_ARTICLES } from "./blog-seo-push";

const ORIGINAL_ARTICLES: BlogArticle[] = [ ... ];
export const BLOG_ARTICLES: readonly BlogArticle[] = [
  ...ORIGINAL_ARTICLES,
  ...NEW_BLOG_ARTICLES,
  ...SEO_PUSH_ARTICLES,
];
```

Better still, move each chunk to its own file and have `blog.ts` be a pure aggregator.

### 9. `globals.css` is 9,463 lines — needs splitting

One monolithic CSS file with BEM-prefix convention (`v2-`, `wp-`, `player-`, etc.). It works, but searching/editing is painful and any change requires rebuilding the full file. Split by feature into `src/app/globals/` + `@import` them from a small top-level `globals.css`, or migrate the most-changed areas (player, shell) to CSS Modules. Don't rewrite all of it — just bleed the pain out over time.

Minor: there was a legacy `.v2-topbar__search { display: none }` that silently broke search for months (documented in CLAUDE.md). Monolithic CSS makes these bugs harder to find. Adding a quick comment convention `/* @owner: watch-player */` before each section helps.

### 10. `WatchPlayer.tsx` is 1,715 lines — extract subcomponents

The 1650-line beast is noted in CLAUDE.md. Not a bug, but: extract `VolumeSliderPopup`, `AutoplayNextOverlay`, `HeartBurst`, `SeekOverlay` into sibling files. Each is self-contained. It cuts the main file by ~40% and makes the `useEffect` spaghetti much easier to reason about. Do it opportunistically — any time you touch the file, carve out one more piece.

### 11. No tests. Zero. Before payments ship this is indefensible.

No `__tests__/`, no `*.test.ts`, no `*.spec.ts` anywhere in the repo. For most of the app this is a calculated speed trade-off and fine. But **four paths absolutely need tests** before Stripe goes live:

1. `src/app/api/stripe/webhook/route.ts` — the handlers are pure-ish functions (userId + sub → UPDATE). Mock `pool.query` and assert the update SQL is called with the right args for every event type. ~50 lines of Vitest.
2. `src/lib/gamification.ts > recordScore` — streak math, daily cap, milestone bonuses. Trivial to unit test; impossible to validate by inspection alone. The `if (newStreak === 7 && stats.current_streak < 7)` trick is correct but fragile.
3. `src/lib/content.ts > containsBannedContent` + `BANNED_TAGS_ARRAY` consumption in `getVideos` — **legal risk**. A regression here is a CSAM liability. Snapshot test that ensures banned tags are always filtered.
4. `src/auth.ts > findOrCreateDiscordUser` — the 3-branch logic (already linked / email match / create new) is exactly the kind of code that gets regressed by a drive-by edit.

Add `vitest` + 4 test files = 1-2 hours of work. Do it this week.

### 12. No `updated_at` protection / no `WHERE id = $1 AND ...` guards on Stripe UPDATE

**File:** `src/app/api/stripe/webhook/route.ts:182-191`

```ts
UPDATE users SET pro_status = $2, ... WHERE id = $1
```

No check that the row exists (silent no-op on missing user), no updated_at check to prevent stale-event-overwriting-fresh-state races (e.g., a delayed `subscription.updated` with old status arriving after a fresh one). Add `RETURNING id` and log a warning if `rowCount === 0`. For ordering, Stripe includes `event.created`; store it in `stripe_events` and refuse to apply older events than the last-applied.

### 13. `rowToVideo` is duplicated and the schema shape is brittle

**File:** `src/lib/content.ts:92-113, 309-314`

Every field is individually cast from `row[X] as T`. One typo in a column name silently returns `undefined`. Consider building a small zod/valibot schema once, or at minimum share the SELECT string via a single `const` instead of the two separate `USER_VIDEO_SELECT` + inline SELECT definitions (currently three copies in this file alone).

---

## 🟡 MEDIUM (worth addressing in next sprint)

### 14. 17 `.catch(() => {})` silent swallows

Mostly in player code (`v.play().catch(() => {})`) where browser autoplay policy rejections are expected — fine. But one deserves attention: `src/app/api/resolve-video/route.ts:64` — `pool.query("DELETE FROM resolved_urls WHERE expires_at < NOW()").catch(() => {})`. If this query ever fails consistently (bad PG state), cache will grow unbounded silently. Log, don't swallow.

### 15. `src/app/browse/` and `src/app/v/[slug]/` exist only as redirects

Not dead code per se (they handle legacy URLs), but add a comment noting their status so they don't get "cleaned up" by a future pass. `browse/page.tsx` already has one; add to `v/[slug]/page.tsx`.

### 16. Inline rate-limit Maps duplicated across 9 files

**Files:** 9 API routes each define their own `const rateLimit = new Map(...); setInterval(cleanup)`.

Extract `src/lib/rate-limit.ts` with a `rateLimit(key: string, max: number, windowMs: number)` helper. DRYs up ~100 lines, centralizes IP detection (which currently has 7 copies), lets you tune from one place.

### 17. `as unknown as` casts in `AppShell.tsx` (4x)

`(DISCOVER_ITEMS as unknown as NavItem[]).map(...)` — either `DISCOVER_ITEMS` already matches `NavItem[]` (cast is useless) or it doesn't (cast hides a real type mismatch). Fix the source types instead.

### 18. IP detection pattern not centralized

Each route does its own `request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "unknown"`. Easy to get wrong (one route using `[0]` vs `.pop()` is exactly the silent spoofability bug you fixed once already — CLAUDE.md "IP detection" section). Move to `src/lib/rate-limit.ts`.

### 19. `getUserStats` vs `getOrCreateUserStats` — subtle footgun

`recordScore` calls `getOrCreateUserStats` (good). But `/api/user/stats` might call the read-only one; if so, first-time visitors see a 404 or null until they trigger any event. Not sure — verify the route. Consider collapsing to one function (always upsert on read is cheap with ON CONFLICT DO NOTHING).

### 20. 25 lib files — some worth merging, most fine

- `rule34.ts` (83 lines) + `rule34-search.ts` (126) + `rule34video.ts` (87) — three very thin files for the same vendor family. Could be one `rule34/` folder with `single.ts`, `search.ts`, `video.ts`. Minor.
- `favorites.ts` + `history.ts` + `blacklist.ts` — all localStorage wrappers with near-identical structure. A tiny `createLocalStorageStore<T>()` factory would DRY these up.
- `email.ts` at 433 lines is the odd one in `lib/` — it mixes HTML templates, token helpers, and send functions. Extract templates to `src/lib/email/templates.ts`.

### 21. `memo.ts` stores in-flight promise with `value: undefined as unknown as T`

Subtle hazard: if a caller reads `entry.value` without checking `entry.promise` first during the window between promise creation and resolution, they get `undefined` typed as `T`. Current code guards this correctly, but the next person to touch it won't notice. Use a discriminated union:

```ts
type MemoEntry<T> =
  | { state: "resolved"; value: T; expiresAt: number }
  | { state: "pending"; promise: Promise<T>; expiresAt: number };
```

### 22. JWT session contains username + avatar — stale data hazard

`src/auth.ts` puts username and avatar in the JWT (30-day TTL). When a user updates them via `/api/profile`, the session still shows the old values until re-login. Either force re-sign (harsh) or invalidate the token on profile change (ideal but complex) or simply read from PG in the session() callback (kills perf). Document the trade-off at least.

### 23. Error response shapes are inconsistent

Sampled: `{ error: "not authenticated" }`, `{ error: "Not authenticated" }`, `{ error: "email_not_verified", message: "..." }`, `{ error: "invalid json" }`. Lowercase snake vs title case vs mixed. Client-side handling has to guess. Define one shape:

```ts
type ApiError = { error: { code: string; message: string } };
```

### 24. No README for contributors (Sab)

`README.md` exists but I didn't read it — verify it has: local dev setup, env vars list, how to run scrapers, how to test, how to deploy. Sab is a beginner and will want this once he's juggling Stripe ops + dev work.

---

## 🟢 LOW (style / nit)

- `src/components/` has 26 files at the top level. Start grouping by feature (`cards/`, `watch/`, `shell/`, `auth/`) once you pass 40.
- `tsconfig.json`: `target: "ES2017"` — in 2026, bump to `ES2022`. Smaller bundle, native `??`, `?.`, class fields.
- `src/data/blog-new.ts` has 23 occurrences of `any` — mostly in HTML strings, false positives from the grep. Ignore.
- `content-generator.ts` (90 lines) is small enough to merge into `seo.ts` if you want one fewer file; or leave it.
- No `.vscode/settings.json` committed to enforce editor defaults (prettier, tab width). Optional but nice for a future team.
- `TIERS` array in `gamification.ts` is `Tier[]` but should be `readonly Tier[] as const` — currently nothing prevents a runtime `TIERS.push(...)`.
- Line 89 in `auth.ts`: `baseUsername = profile.username.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "user"` — if two Discord users both have unicode-only usernames, they both become "user" and the collision check only checks once. Use `_${randomId}` fallback.
- `url-warmup.ts` runs inside the Next.js process (noted in CLAUDE.md as intentional for IP binding). Make sure it respects `process.env.NEXT_PHASE === "phase-production-build"` and doesn't run during build. Verify.

---

## 🎯 Top 5 debts to prioritize AFTER launch is stable

1. **Tests on the 4 critical paths** (Stripe webhook handlers, `recordScore`, `containsBannedContent`, `findOrCreateDiscordUser`). Without these you cannot safely refactor anything else. Estimated 1-2 hours total with Vitest + mock pg.
2. **Delete `src/data/*.json` (121 MB dead weight)** and verify CI/Docker/clone times drop. 5-minute task, massive quality-of-life win.
3. **Extract `src/lib/rate-limit.ts`** — consolidates 9 duplicated Map-based limiters and 7 copies of IP-detection logic. Single source of truth for anti-abuse.
4. **Split `WatchPlayer.tsx` into 5-6 subcomponents** — extract `VolumeSliderPopup`, `AutoplayNextOverlay`, `HeartBurst`, `SeekOverlay`, `PlayerControls`. Incremental — one per week.
5. **Split `globals.css` by feature-prefix** — legacy CSS footguns are the #1 source of silent UI bugs on this codebase (documented in CLAUDE.md). Reducing the blast radius reduces the incidence.

### What to NOT touch

- `src/lib/content.ts` banned content filter — it's redundant at three levels intentionally. Don't "clean it up."
- Next.js 16 `generateStaticParams = async () => []` hack on `/watch/[slug]` — it's correct and documented.
- `memoize()` in-flight promise pattern — correct, just hard to read.
- `pool = globalThis.pgPool ?? ...` singleton — the HMR workaround is standard and correct.
