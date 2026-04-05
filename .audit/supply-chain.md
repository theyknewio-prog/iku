# Supply chain audit — 2026-04-05

Scope: npm deps (CVEs / abandoned / typosquats), leaked secrets in code, git history, Docker, CI/CD, runtime logs, CSP trust anchors.

Tool outputs: `npm audit --json` clean (0 vulns across 500 deps), `ghost-*` skills not invoked (findings obtainable via direct scan).

---

## 🔴 CRITICAL (leaked secret or exploitable CVE in prod path)

### C1 — Hardcoded Gelbooru API key in source + git history
- **File**: `scripts/scrape-gelbooru.ts:16`
- **Secret**: `API_KEY = "3ed16caf49d543883a94b9e8beeb56804c4bbdd577bbb22697579e11d84aca13c755ad81e6c3caf03c8b158f07b92097466280dfec9ea35313b61efd3bcc1a41"` + `USER_ID = "1943515"`
- **Exposure**: present in current `HEAD` AND in git history (confirmed via `git log --all -p`). Repo is private but the key is:
  - Committed in working tree — anyone with read access sees it
  - In the lockfile of history — even if removed today, still in the objects pack
- **Per CLAUDE.md**: "Gelbooru : pas de régénération possible (fixe par compte), risque faible (lecture seule, contenu public)" — acknowledged in the codebase docs, but still classified CRITICAL by scanner policy because it's a live credential committed to VCS.
- **Fix**: (1) Load from `process.env.GELBOORU_API_KEY` like every other script already does. (2) Purge from current file. (3) Since regeneration is impossible, consider isolating the scraper identity (new Gelbooru account) and retiring this one if the repo ever goes public.

### C2 — Hardcoded Rule34 API key in source + git history
- **File**: `scripts/scrape-rule34.ts:16`
- **Secret**: `API_KEY = "f230feb40110c4e896f9cb32fd4d8c08c13c476f4bf83d64036ad23887e482510b1a391cefab9dacdde28b51cd64c9695ed1fd06ad327753074c494d528f1790"` + `USER_ID = "6053223"`
- **Per CLAUDE.md**: "Clé Rule34 régénérée le 2026-04-03 (l'ancienne était dans l'historique git)" — the **old** key was supposedly rotated, but the **current hardcoded key** shown above is the NEW one, which is now ALSO in git. Rotation was only partially effective: the fresh key was committed to the same file, inheriting the same exposure pattern.
- **Fix**: Same — move to `process.env.RULE34_API_KEY` (the env var is already in `.env.example` and Coolify). Rotate again at Rule34, this time without re-committing the value.

### C3 — `scripts/scrape-rule34.ts` and `scripts/scrape-gelbooru.ts` run in GitHub Actions daily
The hardcoded values are the ones actively used in prod (the scripts don't read env). If the repo becomes public (or a collaborator is added with bad intent), both scraper accounts are immediately compromised.

---

## 🟠 HIGH (risky dep, secret in git history, weak CI config)

### H1 — Git history contains rotated secrets
`git log --all -p` shows the pre-rotation Rule34 key still present in older commits. Per policy, a rotated key in git history = the rotation is only valid if the provider actually invalidated the old key AND the new key isn't also in git. Verify at rule34.xxx that the old key is revoked.

### H2 — `next-auth@5.0.0-beta.30`
Beta versions of critical auth libraries on prod. `next-auth` v5 is still in beta (as of knowledge cutoff). Auth bugs at this layer = full account takeover. Pin to an exact version (not caret `^`) and track the release notes; upgrade to stable when v5.0.0 lands.

### H3 — CSP `script-src` uses `'unsafe-inline' 'unsafe-eval'`
- **File**: `next.config.ts:14`
- `'unsafe-eval'` is required by some analytics / animation libs but widens XSS impact significantly. Current allowlist (`eu-assets.i.posthog.com`, `us-assets.i.posthog.com`) is fine, but `'unsafe-inline' + 'unsafe-eval'` neutralizes most of the CSP benefit on script-src. Consider moving to nonces (`'strict-dynamic'` + per-request nonce) once the codebase allows it. This is already noted in iku's security posture as a known tradeoff.

### H4 — GitHub Actions `COOLIFY_HOST` used over HTTP
- **File**: `.github/workflows/daily-scrape.yml:93`, `.github/workflows/deploy.yml:30`
- Calls `http://${{ secrets.COOLIFY_HOST }}/api/v1/...` with a bearer token over plaintext. If an attacker MITMs the GitHub Actions → Coolify hop (unlikely but possible on a hosted runner's egress), the `COOLIFY_TOKEN` is exfiltrated in cleartext.
- **Fix**: Put Coolify behind HTTPS (self-signed + `curl -k` or a real cert) and use `https://`.

---

## 🟡 HYGIENE (abandoned deps, unused deps, noisy logs)

### Y1 — `console.log` leaks user data in Stripe webhook
- `src/app/api/stripe/webhook/route.ts:140` → `console.log(`pro lifetime activated for user ${userId}`);`
- `src/app/api/stripe/webhook/route.ts:193` → `console.log(`pro ${proStatus} for user ${userId} (${plan})`);`
- Only user_id (numeric DB id) is logged, not emails or payment details. Low sensitivity but user_id in logs = correlation across deploys. Move to structured logger with levels, and scrub in prod.

### Y2 — `email_log` PG table stores recipient email addresses
- `src/lib/email.ts:168-192` inserts `to_email` on every send into `email_log` table (plus resend_id + error message). This is personally identifying data under GDPR — acceptable with a retention policy + user right-to-erasure, but the current schema has no TTL / cleanup job.
- **Fix**: Add a nightly `DELETE FROM email_log WHERE created_at < NOW() - INTERVAL '90 days'` job, and ensure GDPR erasure flow wipes rows for a given user.

### Y3 — `.env.local` present on dev machine — verify it's git-ignored
`.gitignore` does cover `.env*` with an exception for `.env.example`. Confirmed no `.env.local` in git tracked files. Good.

### Y4 — Abandoned / stale dep check
Direct deps (`next 16.2.2`, `react 19.2.4`, `pg 8.20.0`, `stripe 22.0.0`, `resend 6.10.0`, `posthog-js 1.364.7`, `gsap 3.14.2`, `hls.js 1.6.15`, `bcryptjs 3.0.3`) are all actively maintained with recent releases. **No abandoned deps, no typosquats detected.**

### Y5 — `hls.js` is installed but CLAUDE.md says "not used"
Per project docs: "Pas de HLS.js (malgré ce qu'on croyait)". The package is in `dependencies` but the `WatchPlayer` uses vanilla `<video>`. Dead weight — ~180KB bundle risk if ever imported by accident. Remove with `npm uninstall hls.js` unless there's a planned future use.

### Y6 — `@tailwindcss/postcss` + `tailwindcss@4` in devDeps, project doesn't use Tailwind
CLAUDE.md: "Styling : CSS vanilla via `globals.css` (pas de Tailwind, pas de CSS Modules)". Same dead-weight pattern. Safe to remove if `globals.css` is truly the only source of styles.

### Y7 — Multiple dev tools logging to stdout
Lots of `console.error` calls across `src/` (30+ grep hits). None log secrets, request bodies, passwords, or stripe payloads — only error messages and user_id. Acceptable but consider a pino/winston wrapper for prod to gate verbosity.

---

## ✅ Verified clean

- **`npm audit`**: 0 vulns (info/low/moderate/high/critical all 0) across 500 deps.
- **Stripe secrets**: no `sk_live_…`, `pk_live_…`, or `whsec_…` literals in any `.ts/.tsx/.mjs/.js` file. All Stripe code reads from `process.env.STRIPE_*`.
- **Resend secrets**: no `re_…` literals. `src/lib/email.ts` reads from `process.env.RESEND_API_KEY`.
- **Discord bot tokens**: all 10+ Discord scripts read from `process.env.DISCORD_BOT_TOKEN`.
- **Database URLs**: no hardcoded `postgresql://user:pass@…` strings. All via `process.env.DATABASE_URL`.
- **PostHog personal API key (`phs_…`)**: referenced in `scripts/posthog-setup-dashboards.mjs` only in comments/docs; read from env at runtime.
- **AWS, GCP, GitHub PAT, Slack tokens**: none found in repo.
- **`.gitignore`**: properly excludes `.env*`, `.env.local`, `/.next/`, `/node_modules`, `.vercel`. `.env.example` is the only env file tracked, and contains only placeholder values (no real keys).
- **`Dockerfile`**: no baked secrets. `NEXT_PUBLIC_*` values correctly passed via `ARG` → `ENV` at build time (these are meant to be public). No `RUN echo $SECRET` patterns.
- **GitHub Actions workflows**: all 5 workflows (`daily-scrape`, `deploy`, `discord-bots`, `discord-emoji-sync`, `winback-email`) correctly reference secrets via `${{ secrets.X }}`. No `echo`/log of secret values, no `::add-mask` needed. `GITHUB_TOKEN` used with default scope only.
- **CSP trust anchors (script-src)**: only `self` + PostHog (`eu-assets.i.posthog.com`, `us-assets.i.posthog.com`). No Discord CDN, no Google Tag Manager, no random wildcards. Minimal attack surface on third-party JS execution.
- **`img-src` / `media-src` / `connect-src` wildcards**: properly paired bare + `*.domain` (per the known Gelbooru CSP trap documented in CLAUDE.md).
- **No typosquat indicators**: all package names match their well-known canonical publishers.

---

## Recommended remediation order

1. **NOW**: Remove hardcoded keys from `scripts/scrape-gelbooru.ts` + `scripts/scrape-rule34.ts`, load from `process.env.*` (C1, C2). Rotate Rule34 key again; for Gelbooru, spin up a fresh account if feasible.
2. **This week**: Add HTTPS on Coolify endpoint, update workflows (H4). Pin `next-auth` to exact version and track v5 stable (H2).
3. **This month**: Remove `hls.js`, `tailwindcss`, `@tailwindcss/postcss` from package.json (Y5, Y6). Add `email_log` retention job (Y2). Move prod logs behind a logger library (Y1, Y7).
4. **Ongoing**: Rerun `npm audit` after every `npm install`. Re-scan git history before ever flipping the repo to public.
