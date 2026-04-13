# Agent 1 — Codebase walkthrough (2026-04-11)

## P0 findings

### Telegram missing from mobile nav drawer
- **File**: `src/components/AppShell.tsx`
- **Desktop sidebar** (lines 437-453): has Telegram + Discord
- **Mobile drawer "More" menu** (lines 684-698): has ONLY Discord
- **Fix**: add Telegram `<a href="https://t.me/ikudotgg">` button in the mobile drawer next to Discord

## P2 findings

### Orphaned components (defined, never imported)
- `src/components/CountUp.tsx`
- `src/components/HomePageClient.tsx`
- `src/components/SearchBar.tsx` (SearchAutocomplete used instead)
- `src/components/SiteFooter.tsx` (footers are inlined in page files)
- `src/components/SiteHeader.tsx` (AppShell handles nav)

### `<img>` without lazy loading
- `src/components/VideoCard.tsx` line 616 — missing `loading="lazy"` + `decoding="async"`

### Production `console.log` statements
- `src/app/api/stripe/webhook/route.ts` lines 230, 248, 270, 312, 326
- `src/lib/url-warmup.ts` lines 97, 101, 132

## Validated healthy

- **Monetization wiring**: all 12 ad components imported and rendering. Pro exclusions comprehensive. /feed exclusion correct.
- **Adsterra scripts**: 4 URLs present and fresh (grabbed 2026-04-11).
- **ExoClick zones**: all IDs present in `ad-config.ts`. Popunder intentionally disabled.
- **Gamification**: streak badge in topbar, leaderboard in nav, score system functional — all visible.
- **Email verification**: guard + banner + flow all wired.
- **OneSignal**: soft-prompt after 2 video views, respects Pro state, mounted in layout.
- **CSP**: ExoClick, Adsterra, AdultForce, Chaturbate, OneSignal all whitelisted.
- **ISR**: revalidate times appropriate (watch 24h, home 1h, blog 24h).
- **Auth**: NextAuth v5 + Discord OAuth + Credentials, Pro status synced client-side.

## Observations the agent could not verify statically

- **Footer "4km" bug**: agent read source, said footer looks normal. Needs live measurement (agent 2).
- **White ad squares**: agent said srcdoc iframes are set up correctly. Needs live rendering check (agent 2).
- **Trending/new releases "all black"**: agent said thumbnails are properly wired in VideoCard. Needs network/image load check (agent 2).
- **Explore not responsive**: agent said CSS uses `max-width: 100%`. Needs live viewport test (agent 2).
- **Shorts 0 ads**: FeedInterstitial is wired but agent couldn't verify runtime trigger count. Needs interactive swipe test (agent 2).

## Not broken but worth discussing

- Twitter `@ikudotgg` link — not visible in footer or nav (only in metadata/sitemap)
- Reddit `u/ikudotgg` link — not visible anywhere user-facing
- These were built as promotion channels (inbound from Reddit/Twitter) but logged-in users can't find the outbound links back. Worth adding to footer.
