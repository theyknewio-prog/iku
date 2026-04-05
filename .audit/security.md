# Security audit — 2026-04-05

Scope: full review of banned-content integrity, Stripe, auth, rate limiters, XSS/CSP, SSRF, SQLi, and PII for iku.gg going live with Pro subscriptions. Focus on findings NOT already listed in CLAUDE.md "Sécurité" section.

---

## 🔴 EXPLOITABLE (real attacker can abuse this today)

### 1. BLOCKER — Banned content check is fundamentally broken: only inspects `tags`, ignores `characters`, `copyrights`, `title`, `slug`
**Severity:** CRITICAL — existential / legal risk
**Files:**
- `src/lib/content.ts:33-35` — `containsBannedContent()`
- `src/app/watch/[slug]/page.tsx:228` — sole runtime gate for direct-access protection
- `scripts/db.ts:41-46` — `upsertVideos()` safety net

**Attack scenario:**
1. Danbooru/Gelbooru classify subjects as characters/copyrights, not general tags. A post can have `tag_string_character = "young_girl marie_rose"` and `tag_string_general = "animated 1girl solo"` — nothing in `general`. After `mapPostToVideo`, the returned `Video` has `tags = ["animated","1girl","solo"]` and `characters = ["young_girl","marie_rose"]`.
2. The watch page calls `containsBannedContent(video)` which does `video.tags.some(t => BANNED_TAGS.has(t.toLowerCase()))`. `tags` does not contain `young_girl`. The check **returns false**. Page renders.
3. Same flaw exists server-side in `getVideos()` SQL filter (`NOT (tags && $1::text[])`) — it only checks the `tags` column, not `characters`, `copyrights`, or `title`. A row can be banned by character/copyright but still be returned by carousels, explore, search, `/character/[slug]`, etc.
4. `scripts/db.ts > upsertVideos` safety net (lines 41-46) has the exact same bug: only checks `r.tags`, `r.slug`, `r.title` — no `r.characters`, `r.copyrights`. Scrapers happen to check all three today, but the LAST line of defense still has the hole.
5. The live Danbooru API calls in `src/lib/danbooru.ts > getPost()` (line 124) bypass the DB filter entirely and feed straight into the watch page with only the broken `containsBannedContent` as gate.

**Fix:**
```ts
// src/lib/content.ts
export function containsBannedContent(video: {
  tags: string[]; characters?: string[]; copyrights?: string[];
  slug?: string; title?: string | null;
}): boolean {
  const lists = [video.tags, video.characters ?? [], video.copyrights ?? []];
  for (const list of lists) {
    for (const t of list) if (BANNED_TAGS.has(t.toLowerCase())) return true;
  }
  const hay = `${video.slug ?? ""} ${video.title ?? ""}`.toLowerCase();
  for (const t of BANNED_TAGS) if (hay.includes(t.replace(/_/g, " ")) || hay.includes(t)) return true;
  return false;
}
```
Apply the same character/copyright check to the SQL in `getVideos()`, `getThumbnailForTag`, `getCuratedGenreCounts`, `getVideoOfTheDay`, `getUserFavorites`, `getUserHistory`, and to `upsertVideos()` in `scripts/db.ts`.

---

### 2. BLOCKER — `getRelatedPosts()` (Danbooru live API) serves unfiltered content into the player's autoplay-next + sidebar related grid
**Severity:** CRITICAL — banned content exposure path
**File:** `src/lib/danbooru.ts:253-306` — `getRelatedPosts`
**Callers:** `src/app/watch/[slug]/page.tsx:235` (autoplay), `:712`, `:724` (related sidebar)

**Attack scenario:**
`getRelatedPosts` calls Danbooru live, maps raw posts via `mapPostToVideo`, and returns them. No banned filter. No `containsBannedContent`. The watch page feeds these directly to `<WatchPlayer relatedVideos={...}/>` and renders the sidebar `<ThumbnailCard>` grid. A legitimate parent post's tag search (character/copyright of the current video) can pull back banned posts if Danbooru indexed any. These appear to the user, and clicking one loads `/watch/[slug]` which then fails the broken `containsBannedContent` check (finding #1) — so users can land on banned pages that slipped through both layers.

**Fix:** wrap all source-module return paths with the fixed `containsBannedContent` filter:
```ts
// danbooru.ts, gelbooru.ts, rule34.ts, rule34video.ts, wp-hentai.ts
import { containsBannedContent } from "./content";
// after mapping posts:
return posts.filter(v => !containsBannedContent(v));
```
And the SQL-level filter must be added to `getRule34VideoPost`, `searchRule34Video`, `getWPHentaiPost`, `getWPHentaiPost` (currently zero banned filter — see finding #3).

---

### 3. BLOCKER — `rule34video.ts` and `wp-hentai.ts` query PG with zero banned-content filter
**Severity:** CRITICAL
**Files:**
- `src/lib/rule34video.ts:32-47` (`getRule34VideoPost`, `getRule34VideoPageUrl`)
- `src/lib/rule34video.ts:56-87` (`searchRule34Video`)
- `src/lib/wp-hentai.ts` — same pattern (verified by grep: no `BANNED` references in file)

**Attack scenario:** 78% of the catalog is Rule34Video + WP. CLAUDE.md says 277 legacy banned rows were already purged from PG, but the `upsertVideos` safety net has the character/copyright hole (finding #1). Any future scrape that slips past the scraper-level filter reaches PG, and these two modules return it unchecked. The watch page still catches it via `containsBannedContent` (if tags match) but carousels calling these modules directly show banned thumbnails.

**Fix:** add `AND NOT (tags && $N::text[]) AND NOT (characters && $N::text[]) AND NOT (copyrights && $N::text[])` to every SELECT in both files, with the same BANNED_TAGS parameter. Better: centralize through `content.ts > getVideos()` and deprecate the per-source fetchers except where strictly needed (e.g. page_url lookup).

---

### 4. HIGH — Stripe webhook open-redirect via user-controlled `Origin` header leaks verification/checkout links to attacker domains
**Severity:** Medium-High — phishing / credential interception
**Files:**
- `src/app/api/stripe/checkout/route.ts:101` — `const origin = request.headers.get("origin") || "https://iku.gg"`
- `src/app/api/auth/verify/route.ts:15` — same pattern

**Attack scenario:**
1. An attacker hosts `https://evil.com/checkout.html` which POSTs to `https://iku.gg/api/stripe/checkout` from the victim's authenticated browser with credentials (CSRF is partially mitigated by SameSite, but `Origin` header is sent by the browser regardless).
2. Actually more direct: an attacker fetches with `Origin: https://evil.gg`. Result: `success_url = https://evil.gg/profile?upgraded=1`. Stripe redirects the user to `evil.gg` after a real payment, enabling phishing (fake "payment confirmation" page that harvests credentials).
3. Same bug on `/api/auth/verify`: when a user clicks the link in their email, some mail clients set `Origin`/`Referer` to the webmail domain. The code would redirect to `mail.google.com/profile?verified=1` — broken UX and reveals the verification token in the Referer to the webmail host (minor).

**Fix:** never trust `Origin` for building absolute redirect URLs. Use `process.env.NEXT_PUBLIC_SITE_URL` (already defined) or hardcode `https://iku.gg`:
```ts
const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://iku.gg";
```

---

### 5. HIGH — Discord OAuth can hijack any iku.gg account that was never email-verified
**Severity:** High — account takeover
**File:** `src/auth.ts:74-86`

**Attack scenario:**
1. Victim signs up with `victim@gmail.com` but never clicks the verification email. Their row exists in `users` with `email_verified = false` and a `password_hash`.
2. Attacker creates a Discord account, sets email to `victim@gmail.com`. Discord historically allows unverified emails on the Discord side (the `verified` field in the profile can be false). The code `findOrCreateDiscordUser` does not check `profile.verified`.
3. Attacker initiates Discord OAuth on iku.gg. `findUserByEmail("victim@gmail.com")` finds the victim's row. `user_oauth_accounts` gets a row linking `discord:attacker_discord_id → victim_user_id`. The attacker is now logged in as the victim — with all favorites, history, Pro subscription, Stripe customer id, etc.
4. Works even against verified accounts if attacker can pass Discord's email verification (which is weak — Discord only requires clicking a link, and many users have Discord accounts on various emails).

**Fix:**
```ts
// auth.ts findOrCreateDiscordUser — before line 77 (byEmail lookup)
if (profile.email && (profile as any).verified !== true) {
  profile.email = null; // treat as no email
}
// And when linking, require the iku.gg account was already email-verified:
if (byEmail) {
  const { rows } = await pool.query(
    `SELECT email_verified FROM users WHERE id = $1`, [byEmail.id]
  );
  if (!rows[0]?.email_verified) {
    // Don't auto-link. Force explicit link flow from /profile for logged-in user.
    throw new Error("email_not_verified_link_required");
  }
  // ...link
}
```

---

### 6. HIGH — Password reset token consumption is a race: single leaked token allows two concurrent password resets
**Severity:** Medium-High
**File:** `src/app/api/auth/reset-password/route.ts:37-54`

**Attack scenario:** the token is SELECTed with `used_at IS NULL`, then later UPDATEd via `markPasswordResetTokenUsed`. Two concurrent requests both read `used_at IS NULL`, both proceed to `bcrypt.hash`, both `UPDATE users SET password_hash = ...`. The second write wins. If an attacker briefly intercepts the token (e.g. cleartext HTTP proxy at a coffee shop, malicious browser extension), the legitimate user could reset and the attacker could also reset within the same second — attacker wins the race and the user sees their "reset worked" but can't log in next time.

Also: `src/lib/email.ts:419-426` `consumePasswordResetToken` has a bug — `rows.length === 0 ? Number(rows[0]?.user_id) || null : Number(rows[0].user_id)` — the ternary is inverted (returns `Number(undefined)` when empty). Not exploited because the function isn't actually called (reset-password/route.ts uses its own query), but it's dead code that should be deleted or fixed.

**Fix:** atomic claim-and-update:
```ts
const { rows } = await pool.query(
  `UPDATE password_reset_tokens
   SET used_at = NOW()
   WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
   RETURNING user_id`,
  [token]
);
if (rows.length === 0) return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
const userId = Number(rows[0].user_id);
const hash = await bcrypt.hash(newPassword, 10);
await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
```

---

### 7. HIGH — CSP `script-src 'unsafe-inline' 'unsafe-eval'` = no XSS defense at all
**Severity:** Medium-High — turns every future XSS sink into a full account-takeover vector
**File:** `next.config.ts:14`

**Attack scenario:** if any future bug introduces an HTML injection sink (user-controlled content rendered via `dangerouslySetInnerHTML`, an unescaped title/description from a scraped video title, a markdown renderer, a forum feature, etc.), the CSP offers zero mitigation. `unsafe-inline` lets injected `<script>` tags execute, `unsafe-eval` lets `eval(...)` run. Combined with the Stripe checkout session cookies, Discord OAuth tokens in JWT, and the session bearing Pro access — an XSS is game-over.

Additionally: `strict-dynamic` is not used, and nonces are not emitted, so there is no graceful migration path without refactoring the JSON-LD scripts (which are the only legitimate inline scripts).

**Fix:** use a nonce-based CSP. Next.js middleware can generate per-request nonces and pass them to both the header and the inline `<script>` tags. Remove `'unsafe-eval'` immediately (nothing in the runtime needs it — PostHog, React 19, Next 16 all work without it). Remove `'unsafe-inline'` in a second pass after migrating JSON-LD scripts to use nonces.

```ts
// minimal first step: drop unsafe-eval
"script-src 'self' 'unsafe-inline' https://*.i.posthog.com"
```

---

## 🟠 HIGH RISK (not directly exploitable today but one mistake away)

### 8. `/api/resolve/route.ts` rate-limit map has NO size cap
**File:** `src/app/api/resolve/route.ts:6-12`
Cleanup interval only removes expired entries; it never caps the map at 10k. A coordinated attack (or just organic IP diversity over weeks) can grow the map unboundedly → OOM. Other rate limiters in the repo have the `if (rateLimit.size > 10000)` guard — just copy it here.

### 9. `getVideos()` tag search uses unescaped `ILIKE '%' || $N || '%'` — user can brute the index with `%` wildcards
**File:** `src/lib/content.ts:164`
Not SQL injection (parameterized), but a user can send `?tag=a` (single char) and trigger a full-table ILIKE scan across 351k rows. DoS via expensive queries. The `memoize` helper dedups identical inputs but attacker can vary the char. Mitigation: escape `%` and `_` in the user input before passing to ILIKE, and/or require min 3 chars.

### 10. `/api/video-stream` proxies arbitrary bytes with NO output size cap
**File:** `src/app/api/video-stream/route.ts:276`
The 20s abort on upstream fetch caps initial latency, but once the stream is established bytes flow unbounded until the client disconnects. An attacker requesting many Range-less full videos in parallel (10 concurrent × 60MB = 600MB bandwidth per hit) can saturate the 20TB/mo Hetzner quota. The 30/min rate limit helps, but is per-IP and bypassable with a botnet. Add a hard byte ceiling (e.g. 200MB per request) and/or require Range header on videos >10MB.

### 11. `/api/favorites` and `/api/history` do NOT validate that the slug corresponds to a real video
**Files:** `src/app/api/favorites/route.ts:77`, `src/app/api/history/route.ts:65`
Any string ≤200 chars can be inserted. The tables will accumulate garbage. When `getUserFavorites()` does `JOIN videos ON v.slug = f.video_slug`, garbage rows just disappear from the result — so not directly exploitable, but enables storage bloat and tags-table poisoning. Add `WHERE EXISTS (SELECT 1 FROM videos WHERE slug = $N)` check or rely on a FK.

### 12. Session cookies persist for 30 days with no device tracking or revocation list
**File:** `src/auth.ts:122` — `session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }`
JWTs cannot be revoked server-side. If a user's device is stolen or a JWT leaks (XSS, malware, browser extension), the attacker has 30 days of access with no way to kick them out. Especially painful for Pro users. Consider: shorter maxAge (7 days), rotating refresh tokens, or server-side session table keyed by JTI for revocation.

### 13. Discord `profile.verified` flag not checked at all — see finding #5 but also relevant even without account linking
Even when creating a fresh user via Discord, `profile.email` may be an attacker-owned unverified address. Down the line, features that email these users (Pro receipts, password reset if they ever add one) will deliver to the wrong inbox.

### 14. `is18Plus()` uses local server time (no TZ normalization)
**File:** `src/app/api/signup/route.ts:38-48`
`new Date(dobStr)` interprets `"YYYY-MM-DD"` as UTC midnight. `new Date(now.getFullYear()-18, ...)` uses local time. On a server in UTC this is consistent, but a bug prone to break if the container tz changes. Use `Date.UTC(...)` explicitly for determinism.

---

## 🟡 HARDENING (defense in depth)

- **Bcrypt rounds = 10** (signup/reset-password). In 2026, minimum should be 12 for adult/payment sites. Increase to 12.
- **`/api/signup`** does `bcrypt.hash` after all validations — timing difference between "email taken" and "email available" is measurable (the clash query runs first, returns early before bcrypt). Minor enumeration vector. Not critical since password reset flow already anti-enumerates.
- **Welcome/winback emails interpolate `${username}` into subject lines** (`src/lib/email.ts:341, 383-384`). Username regex allows only `[a-zA-Z0-9_-]` so safe today, but if regex ever widens, the subject header is not escaped (SMTP header injection via CRLF would be possible). Add `escapeHeader(s) = s.replace(/[\r\n]/g, "")`.
- **`consumePasswordResetToken` in `src/lib/email.ts:419-426`** is dead code with an inverted ternary. Delete or fix.
- **`stripe_events` insert uses `ON CONFLICT DO NOTHING`** (good), but the INSERT happens BEFORE the handler runs. If the handler crashes, the event is marked processed and Stripe will not retry. Move the INSERT into the same transaction as the user-state update, or only INSERT after successful handling.
- **`handleSubscriptionUpdate` blindly trusts `sub.metadata.user_id`** — if an attacker ever gained access to a Stripe restricted key that can update subscription metadata, they could re-point a subscription at another user id. Low probability but consider verifying `customer_id` matches `users.stripe_customer_id`.
- **`/api/profile/password`** (not reviewed in detail — ensure it requires current password re-entry to prevent session-hijack → permanent lockout).
- **`scripts/db.ts > upsertVideos()` safety net**: also check `characters` and `copyrights` arrays, not just `tags`.
- **`BANNED_TAGS` comparison is exact-match on lowercase.** A tag like `Loli` → lowercased → caught. But `loli-focus` (hyphen) or `loli.pop` would not match. Scraper-level tagstring regex uses whitespace splitting and our banned list mostly uses underscores (`loli_focus`). Consider matching tag substrings for critical terms: `loli`, `shota`, `child`.
- **`/api/resolve-video`** and **`/api/video-stream`** have separate L1 caches despite identical semantics (line 29 in both). Consolidate into one module to avoid drift where one gets a fix the other doesn't.
- **CSP `connect-src`** still whitelists `eu.i.posthog.com` even though the project is US — minor footprint reduction by removing EU hosts.
- **`email_log` PII retention** — stores `to_email` indefinitely. Add a 90-day cleanup cron (GDPR minimization).
- **`resolved_urls` table** stores raw `page_url` with query strings — if any of those contain session tokens (they shouldn't, but verify), those get persisted 1h.
- **`/api/feed`** returns `videoUrl: v.url` for all sources. For `rule34video` / WP rows in the DB, `url` may be a stale resolved URL or empty — the filter `v.url && ...` is checked, but if a stale `v.url` is passed to the client, it 403s. Better: omit rule34video/WP entries from feed entirely unless a stream proxy URL is generated.

---

## ✅ Verified solid

- **Stripe webhook signature verification** — correct use of `constructEvent` with raw body and `STRIPE_WEBHOOK_SECRET`. Dedup via `stripe_events` with `ON CONFLICT DO NOTHING`.
- **Stripe checkout `client_reference_id` and `metadata.user_id`** come from `session.user.id`, never from request body. No IDOR.
- **Email verification token generation** — `crypto.randomBytes(32).toString("hex")` = 64 hex chars = 256 bits of entropy. Solid.
- **SQL queries** use parameterized `pool.query($1, $2, ...)` universally. No string interpolation of user input into SQL found.
- **`/api/signup` 18+ server-side check** is unbypassable (runs server-side, rejects future DOBs).
- **`/api/auth/forgot-password`** returns the same response regardless of whether the account exists (anti-enumeration). Rate-limited 5/h/IP.
- **Proxy/resolve-video/video-stream SSRF guards** — hostname whitelist + `https:` only + standard port check.
- **`/api/proxy`** has exact hostname match (ALLOWED_HOSTS.includes) — no wildcard subdomain confusion.
- **Rate limiter maps** in all routes except `/api/resolve` are bounded at 10k entries with periodic cleanup.
- **Security headers** — HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all present.
- **JSON-LD inline scripts** are JSON.stringified + `</` escaped to `\u003c`, preventing script-in-JSON-LD XSS.
- **Blog content sanitization** strips `<script>`, `on*=` handlers, `javascript:` — reasonable for author-controlled static content.
- **Username regex** `/^[a-zA-Z0-9_-]{3,20}$/` enforced on signup + profile update — no XSS via username renders.
- **`/api/resend-verification`** per-user cooldown via Map is correctly bounded (active session count).
- **Next.js 16 ISR fix** on `/watch/[slug]` (generateStaticParams = []) is in place per CLAUDE.md and verified at line 27.
- **`execFile` (not `exec`)** used for yt-dlp — no shell injection possible.

---

## Suggested triage order for going live

1. Fix findings #1, #2, #3 **BEFORE launch**. These are legal existential risks.
2. Fix #4 (open redirect), #5 (Discord hijack), #6 (token race) **in the same patch** — all small, all serious.
3. Remove `unsafe-eval` from CSP (#7) — one-line change, immediate hardening.
4. Add size cap to `/api/resolve` map (#8) — one-line fix.
5. Everything in 🟠 HIGH RISK within the first week post-launch.
6. 🟡 HARDENING over the next sprint.
