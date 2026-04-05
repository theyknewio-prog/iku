# Conversion funnel audit — 2026-04-05

Scope: signup → email verify → login → pricing → Stripe checkout → webhook → Pro activation → post-purchase UX + supporting email/auth flows.

## 🔴 BLOCKERS (must fix before launching paid subscriptions)

### 1. Waifu Scholar checkout crashes — `allow_promotion_codes` + `discounts` are mutually exclusive
**File:** `src/app/api/stripe/checkout/route.ts:104-125`
**Problem:** Checkout session is created with BOTH `allow_promotion_codes: true` and `discounts: [{ coupon: "waifu_scholar_30" }]`. Stripe rejects this combination with `You may only specify one of these parameters: allow_promotion_codes, discounts`. Only fires when the logged-in user has `user_stats.score >= 15000` (exactly the Waifu Scholar tier the feature was built for).
**Impact:** Every Waifu Scholar tries to upgrade → 500 error, no checkout URL, `setError` shown on the pricing card. The feature announced on the homepage + pricing page is broken for 100% of the intended audience.
**Fix:** If `discounts` is present, drop `allow_promotion_codes` (set it to `undefined`). Prefer `discounts` for auto-applied server-side coupons; only send `allow_promotion_codes: true` when no discounts array is populated.

### 2. Lifetime purchase silently downgraded by subsequent subscription webhooks
**File:** `src/app/api/stripe/webhook/route.ts:130-146` + `148-194`
**Problem:** `handleCheckoutCompleted` sets `pro_status='lifetime'` on lifetime purchase but never cancels any pre-existing `pro_subscription_id`. When the user's prior monthly subscription next fires `invoice.payment_succeeded`, `customer.subscription.updated`, or even a trailing event still in Stripe's queue, `handleSubscriptionUpdate` unconditionally runs `UPDATE users SET pro_status = $2, pro_plan = $3, pro_current_period_end = $5` — overwriting `'lifetime'` → `'active'` and setting a period end. Same happens if events arrive out of order (subscription.updated after checkout.session.completed for the lifetime purchase).
**Impact:** User pays 69.99€ for lifetime, then after 24h their profile shows a regular monthly plan with an expiration date. Support nightmare + refund requests + chargeback risk.
**Fix:** In `handleSubscriptionUpdate`, first `SELECT pro_status FROM users WHERE id = $1`; if existing `pro_status = 'lifetime'`, return early (no-op). Also in `handleCheckoutCompleted` lifetime branch, cancel any existing `pro_subscription_id` via `stripe.subscriptions.cancel(existing)` before flipping the DB.

### 3. Discord OAuth hijacks unverified email accounts
**File:** `src/auth.ts:75-86` (`findOrCreateDiscordUser`, "Account by email?" branch)
**Problem:** If an attacker creates a Discord account with victim's email and signs in, `findOrCreateDiscordUser` happily links the Discord identity to the existing `users` row regardless of `email_verified`. Signup does NOT require verification before account creation; a pending-verification user row is claimable by anyone who can OAuth through Discord with that email.
**Impact:** Account takeover. Attacker gets the victim's favorites/history/Pro status/streak/stripe_customer_id.
**Fix:** In the email-link branch, require `byEmail.email_verified = TRUE`. Otherwise create a fresh user (with unique username suffix) and do not link.

### 4. `email` UNIQUE constraint is case-sensitive — allows duplicate accounts
**File:** `scripts/init-auth.sql` (`email TEXT NOT NULL UNIQUE`)
**Problem:** Postgres `UNIQUE` is case-sensitive. The signup route checks uniqueness via `LOWER(email)` but the DB constraint is not — so `alice@x.com` and `Alice@x.com` both insert successfully. Login (`findUserByEmail`) uses `LOWER(...)` and picks `LIMIT 1`, returning a nondeterministic row. Password reset, email verify, and Pro checkout all read by id — but a user who signs up with the capitalized variant can verify and take over the lowercase account's email space.
**Impact:** Duplicate accounts, nondeterministic login, pollution of `pro_status` between them, and trivial account squatting on any email.
**Fix:** Replace `email TEXT NOT NULL UNIQUE` with `email TEXT NOT NULL` + `CREATE UNIQUE INDEX users_email_lower_uniq ON users (LOWER(email));`. Dedup any existing dups before migrating (there shouldn't be any in prod yet).

### 5. `/profile?upgraded=1` does not show Pro state — user sees no proof of purchase
**File:** `src/app/profile/page.tsx` (entire file) + `profile-client.tsx:23`
**Problem:** After a successful Stripe checkout, the user is redirected to `/profile?upgraded=1`. The profile page never reads `pro_status`, `pro_plan`, or `pro_current_period_end` from the DB. The only acknowledgement is a silent PostHog event. There's no "You're Pro" banner, no badge change, no plan row, nothing. Combined with the (realistic) possibility of a 1-5s delay before the webhook fires and activates Pro, the user can also refresh and get even less feedback.
**Impact:** Every paying user lands on a page that looks identical to before they paid. Immediate "did my payment go through?" support tickets, refund requests, trust collapse at the most critical moment of the funnel.
**Fix:** Query `pro_status, pro_plan, pro_current_period_end` on the profile page. When `?upgraded=1` is present, show a loud confirmation card ("Welcome to Pro ✨") with the plan name and next-billing date. Show a `<meta http-equiv="refresh" content="3">` or poll-once if `pro_status IS NULL` to handle webhook lag. Also render an always-visible "Pro · Monthly / Yearly / Lifetime" row in the header block for any Pro user.

## 🟠 CRITICAL (high-risk but not guaranteed to fire)

### 6. Subscription handler silently no-ops when metadata is missing
**File:** `src/app/api/stripe/webhook/route.ts:148-153, 196-198`
**Problem:** Both `handleSubscriptionUpdate` and `handleSubscriptionDeleted` require `sub.metadata?.user_id` and early-return otherwise. Metadata is only populated at checkout creation time. If Stripe creates a subscription via any other path (customer portal upgrade, manual recreate after failed payment, dunning flow that swaps subscriptions, Stripe CLI test events, replayed webhook), `user_id` may be missing → no update → user stays at `past_due` forever or, worse, keeps Pro after cancellation. Also, the `customer.subscription.created` event is handled, but during a fresh checkout the `user_id` only lands on the sub because of the `subscription_data.metadata` echo; if checkout retries or the user switches plans, the old sub keeps its metadata but a new sub may not.
**Impact:** Lost cancellations (user cancels, stays Pro), lost reactivations, silent failures with no error visible to anyone.
**Fix:** When metadata is missing, fall back to `SELECT id FROM users WHERE stripe_customer_id = $1` and use that row. Log a warning but still process.

### 7. Plan fallback `priceId?.includes("year")` is dead — yearly subs default to monthly
**File:** `src/app/api/stripe/webhook/route.ts:175`
**Problem:** `sub.metadata?.plan || (priceId?.includes("year") ? "yearly" : "monthly")`. Real Stripe price IDs look like `price_1TIsKwE6BjkfAdXjJnVBTmyC` — they never contain the substring "year". Any code path where `sub.metadata.plan` is absent (see #6) misclassifies yearly subs as monthly in the DB.
**Impact:** Wrong `pro_plan` shown on profile / UI / support queries. Emails reference the wrong plan. Billing period math is wrong.
**Fix:** Compare `priceId === process.env.STRIPE_PRICE_YEARLY ? "yearly" : priceId === process.env.STRIPE_PRICE_MONTHLY ? "monthly" : "monthly"`.

### 8. Discord OAuth users with real email are blocked from checkout forever
**File:** `src/auth.ts:99` + `src/lib/email-verify-guard.ts:50-54`
**Problem:** When a Discord user has `profile.email` set (scope 'email' is requested), `findOrCreateDiscordUser` stores that real email but never sets `email_verified=TRUE`. The verify guard only exempts users whose email ends with `@discord.iku.gg` (synthetic). So a Discord OAuth user with a real email address: (a) is treated as unverified, (b) is blocked at checkout with "email_not_verified", (c) never received a verification email at signup (Discord path doesn't call `sendVerificationEmail`), (d) has to discover the resend-verification UI in the profile banner. Most will bounce.
**Impact:** Every Discord OAuth user who isn't a return visitor is blocked from buying Pro until they manually request a verification email. Meaningful chunk of the auth population.
**Fix:** Either (a) trust Discord's `verified` flag on the profile and set `email_verified=TRUE` in `findOrCreateDiscordUser` if `profile.verified === true`, or (b) auto-send a verification email on first Discord signup, or (c) treat any Discord OAuth login as sufficient for checkout (they clearly have a working account).

### 9. Double-click on checkout button creates duplicate Stripe sessions
**File:** `src/app/pricing/pricing-client.tsx:33-70`
**Problem:** `loading` state disables the button only for the clicked plan (`disabled={loading !== null}` — OK, actually disables all). But between the click and the state update, a user can double-click or tap multiple times fast enough on mobile. Also: `setLoading(planId)` happens AFTER the `import()` dynamic analytics call but the `fetch` isn't awaited in the event handler queue before the second tap. Additionally, if the user hits Back from Stripe's hosted checkout and clicks again, a fresh checkout session is created each time — you'll have 3-5 orphan sessions per user in Stripe dashboard.
**Impact:** Duplicate Stripe sessions (noise, not charges). Slight risk of racing two checkouts where the user ends up paying twice if they finish both quickly.
**Fix:** Use an idempotency key on `stripe.checkout.sessions.create({...}, { idempotencyKey: `checkout-${userId}-${planId}-${Math.floor(Date.now()/60000)}` })` — dedups within a 1-minute window. Also disable the button for 3s minimum on click regardless of fetch state.

### 10. Password reset token consumption is racy
**File:** `src/app/api/auth/reset-password/route.ts:37-54`
**Problem:** The route does `SELECT ... WHERE used_at IS NULL` → `bcrypt.hash` (slow, ~80ms) → `UPDATE password_hash` → `markPasswordResetTokenUsed`. Two parallel requests with the same token both see `used_at IS NULL`, both hash, both update. Last-write-wins. An attacker who intercepts the token link can race the user and set their own password.
**Impact:** Edge case — requires token interception — but the entire purpose of one-shot tokens is broken.
**Fix:** Use atomic claim: `UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1 AND used_at IS NULL AND expires_at > NOW() RETURNING user_id`. Only proceed if `rowCount > 0`.

### 11. `invoice.payment_failed` is not a no-op — `past_due` user keeps Pro UI
**File:** `src/app/api/stripe/webhook/route.ts:91-96`
**Problem:** The handler logs and returns. It relies on `customer.subscription.updated` to arrive and flip `pro_status` to `past_due`. That chain is usually fine, but (a) the UPDATE event is often NOT sent immediately by Stripe — it can be minutes late or delivered first if SMART retries reorder, (b) meanwhile the UI still says "active", (c) there is no dunning email to the user about the failed payment.
**Impact:** User's card fails, they don't know, they stop getting Pro features silently when the sub is eventually canceled, they blame the site.
**Fix:** On `invoice.payment_failed`, immediately `UPDATE users SET pro_status='past_due' WHERE pro_subscription_id = $1`. Queue a dunning email via Resend.

### 12. Stripe webhook handler swallows errors and returns 200
**File:** `src/app/api/stripe/webhook/route.ts:98-101`
**Problem:** Comment says "Still return 200 so Stripe doesn't retry indefinitely on bugs". But the event has already been inserted into `stripe_events` at line 51, so on retry the handler sees it as processed (dedup short-circuit at line 56). The combination: first delivery errors out (e.g., PG down for 3s) → returns 200 → retry never happens → DB write never occurred → user paid but no Pro access, forever. Fails open on payments.
**Impact:** Money leak — paying users don't get Pro when transient errors occur during webhook processing.
**Fix:** Only insert into `stripe_events` AFTER the handler body succeeds (or wrap both in a single transaction). On error, return 500 and let Stripe retry.

## 🟡 MINOR / NICE-TO-FIX

### 13. PostHog `pro_purchase` event fires on every refresh of `/profile?upgraded=1`
**File:** `src/app/profile/profile-client.tsx:22-29`
**Problem:** No dedup. If the user bookmarks the URL, refreshes, or shares it with a friend, the event fires multiple times, inflating conversion counts.
**Fix:** Write a sessionStorage flag `pro_purchase_tracked_{session_id}` or strip the `?upgraded=1` param via `router.replace("/profile")` right after tracking.

### 14. Verify route uses `request.headers.get("origin")` for redirects — always null on email click
**File:** `src/app/api/auth/verify/route.ts:15-41`
**Problem:** Browsers do NOT send an `Origin` header on top-level GET navigations from email clients. `origin` is always null, falls back to hardcoded `https://iku.gg`. Works in prod by coincidence, breaks in staging/dev.
**Fix:** Use `process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin`.

### 15. Verification token not invalidated on successful verify for a user's other pending tokens
**File:** `src/lib/email.ts:399-417`
**Problem:** A user who requests multiple resends has multiple valid tokens. Verifying one marks only that token used; the others remain valid for 24h. Minor info leak surface.
**Fix:** `UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id = $1 AND used_at IS NULL` in `consumeVerificationToken` after the first update succeeds.

### 16. `consumePasswordResetToken` helper has inverted-looking return but is effectively dead
**File:** `src/lib/email.ts:419-426`
**Problem:** The ternary is confusing: `rows.length === 0 ? Number(rows[0]?.user_id) || null : Number(rows[0].user_id)`. It happens to return `null` when empty (via `NaN || null`) but reads as a bug. Only kept because no caller uses it (reset-password route inlines its own SELECT).
**Fix:** Delete the helper or rewrite as `if (!rows[0]) return null; return Number(rows[0].user_id);`.

### 17. `/api/stripe/checkout` rate limiter is per-process, not shared
**File:** `src/app/api/stripe/checkout/route.ts:16-56`
**Problem:** Map-based rate limiter. A Next.js container restart (or multiple replicas under horizontal scaling) resets the window. Single-container prod is fine today but will silently become ineffective if scaled.
**Fix:** Note in code + use PG-backed rate limit if/when scaling horizontally.

### 18. Checkout route doesn't enforce "already Pro" guard
**File:** `src/app/api/stripe/checkout/route.ts:78-125`
**Problem:** An existing Pro user can buy another Pro plan (e.g., monthly on top of lifetime, yearly on top of active monthly). Stripe will charge them. The webhook then mangles plan state (see blocker #2).
**Fix:** Before creating the checkout session, `SELECT pro_status FROM users WHERE id = $1`. If `'lifetime'`, return 409. If `'active'` and the requested plan matches, return 409. If different plan, explicitly create a portal-upgrade flow instead.

### 19. Forgot-password rate limit is IP-based only, not email-based
**File:** `src/app/api/auth/forgot-password/route.ts:28-46`
**Problem:** 5 requests/hour/IP. Attacker with many IPs can spam any single user's inbox. Legitimate email enumeration is blocked, but deliverability reputation damage is not.
**Fix:** Add a secondary per-email rate limit (max 3/h per target email) via a simple PG table or Map keyed by `LOWER(email)`.

### 20. `EmailVerificationBanner` resend is not documented as sending to the current DB email
**File:** `src/app/api/auth/resend-verification/route.ts:51-69`
**Problem:** Sends to whatever `users.email` currently is. If the user typed a typo (`gmail.cm`), there's no way to change the email — they're locked out of verification and of checkout (blocker #8 scenario) forever.
**Fix:** Allow `PATCH /api/profile` to change email (with re-verification required). Or add a "change email" link in the verification banner.

### 21. `email_log` table is populated, but no audit check exposes it
**File:** `src/lib/email.ts:168-192`
**Problem:** Inserts work, but the status code looks for `status='sent'|'failed'` — there's no check for `template` uniqueness per user/day, so a resend spam via cooldown bypass would fill the table. Not a bug, just an absent guard.
**Fix:** Add index on `(user_id, template, created_at)` + periodic cleanup > 90 days.

### 22. Signup uniqueness check is TOCTOU-racy but caught by UNIQUE — see blocker #4
Covered by blocker #4.

## ✅ Verified correct
- Stripe webhook signature verification (`stripe.webhooks.constructEvent`) using `STRIPE_WEBHOOK_SECRET` on raw body. Solid.
- `stripe_events` table used for event dedup via `INSERT ... ON CONFLICT DO NOTHING` — correct pattern (but see blocker #12 for ordering with handler errors).
- Email verification gate on checkout: server-side enforced via `getVerifyStatus` (no client bypass).
- Signup 18+ check: `is18Plus` calculates correctly against today minus 18y, rejects < cutoff.
- Password hash: `bcrypt.hash(..., 10)` — standard cost factor, fine.
- Rate limit on signup (5/h/IP), forgot-password (5/h/IP), resend-verification (5min/user cooldown) — all present.
- Forgot-password anti-enumeration: always returns the same success message regardless of whether user exists.
- Webhook correctly prefers `session.metadata.user_id` over `client_reference_id` (both set, so safe).
- `customer.subscription.deleted` correctly flips to `canceled` (separate from `updated` to avoid clobbering `cancel_at_period_end` behavior).
- Pricing page Waifu Scholar detection threshold `score >= 15000` matches `gamification.ts` tier cutoff.
- CSRF on NextAuth routes handled by Auth.js v5 defaults.
- No SQL injection in any of the audited files (all queries use parameterized placeholders).
- Winback cron email dedup via `NOT EXISTS (SELECT 1 FROM email_log WHERE user_id = u.id AND template = $2)` — correct, and the `last_active_date` filter is precise (exact day match, not range).
- Winback cron excludes Discord-synthetic emails and unverified users.
- Pricing page correctly hides Waifu Scholar badge unless tier earned.
