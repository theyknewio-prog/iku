# UX bugs audit — 2026-04-05

Audit scope: homepage, watch page, WatchPlayer, shorts feed, explore, tag/character/series, favorites/history, search autocomplete, AppShell, profile/leaderboard.

---

## 🔴 BLOCKERS (core functionality broken for real users)

### 1. `/new`, `/trending`, `/tag/[tag]`, `/character/[slug]`, `/series/[slug]` only show Danbooru content (missing 96% of catalog) and bypass banned-content filter
**Files:**
- `src/app/new/page.tsx:5,35`
- `src/app/trending/page.tsx:4,38`
- `src/app/tag/[tag]/page.tsx:7,94`
- `src/app/character/[slug]/page.tsx:7,103`
- `src/app/series/[slug]/page.tsx:6,69`
- `src/lib/danbooru.ts:139` (`searchPosts` has no banned-tag filter)

**Reproduction:** visit `/trending` or `/tag/animated` → only ~17K Danbooru videos ever appear. 277K Rule34Video, 20K Gelbooru, 20K Rule34, 18K WP (~96% of catalog) are invisible everywhere except homepage and `/explore`.

**Impact:**
- Catalog page crippled — users clicking a tag from WatchPlayer tags row (which includes tags from Rule34Video titles) land on tag pages that return nothing or unrelated Danbooru content.
- CLAUDE.md mandates "Tout nouveau point d'entrée de contenu (API, page) doit passer par `getVideos()` ou vérifier avec `containsBannedContent()`" — these pages break that contract. `lib/danbooru.ts searchPosts` does not call `filterBannedContent`, so if Danbooru ever surfaces a banned-tag post it slips through. Live API calls also add latency.

**Fix:** switch all five routes to `getVideos({ tags, ... })` from `@/lib/content.ts`. Delete the `searchPosts` import. Verify `filterBannedContent()` is applied (it is, at the content.ts level).

---

### 2. `getRelatedPosts(video.id, ...)` on watch page silently falls back to "top Danbooru videos" for any non-Danbooru source
**File:** `src/lib/danbooru.ts:253-272`, used at `src/app/watch/[slug]/page.tsx:235` and the autoplay-next grid in `WatchPlayer`.

**Reproduction:** visit any `/watch/r34v-*`, `/watch/gel-*`, `/watch/r34-*` or `/watch/hmm-*` page. Scroll to "More hentai like this" or wait for autoplay-next overlay. Every "related" item is just the current top-scoring Danbooru video — not related to the current clip at all.

**Impact:** 78 %+ of watch pages show irrelevant related content and autoplay-next sends users to random Danbooru hits. Tanks session time and pages/session — the #1 KPI per CLAUDE.md's UX strategy section.

**Fix:** route related-post lookup through `getVideos({ tags: sharedTags, source: "all", excludeId })` using the current video's characters/tags/copyrights. Return early (or an empty array) if the current video has no tags rather than degrading to `searchPosts` fallback.

---

### 3. Logged-in user "Remove from favorites" re-adds the item to localStorage + POSTs it back to the server
**File:** `src/app/favorites/favorites-client.tsx:69-89`, `src/lib/favorites.ts:64-90`

**Reproduction:**
1. Log in. Favorite two videos so they appear in `/favorites` (server-provided list via `initialItems`).
2. Click the heart button on one to remove it.
3. Result: client DELETEs the slug on the server, then calls `toggleFavorite({ id, slug, ... })`. Because localStorage is empty for this logged-in device, `toggleFavorite` sees `idx === -1`, ADDS the item to localStorage, and fires a POST to `/api/favorites` re-saving it. Race: DELETE then POST = ghost favorite returns on refresh.

**Impact:** favorites cannot be reliably removed by logged-in users; removed items randomly reappear; localStorage fills with entries the user never wanted on a given device.

**Fix:** in `handleRemove`, do not call `toggleFavorite`. For authenticated users, just fire the DELETE and update local state. Gate localStorage mirroring through a dedicated `removeFavorite(slug)` helper that only removes (never re-adds) from localStorage.

---

### 4. Bottom-nav "Search" button takes users to `/explore`, not to a search input
**File:** `src/components/AppShell.tsx:292`

**Reproduction:** on mobile, tap the magnifying-glass icon in the bottom tab bar labeled "Search". You land on `/explore` — a static browse hub with no search input in focus and no search box at top of viewport.

**Impact:** industry-standard pattern is tap search → keyboard pops up. Users who want to search a character/tag cannot find the input; it lives in the desktop topbar which is hidden on mobile until they open the hamburger drawer. Per CLAUDE.md's "button → action mismatch" hunt criterion, this is the canonical case.

**Fix:** either (a) create a dedicated `/search` page that autofocuses the input on mount, or (b) use an onClick handler that scrolls the topbar into view and focuses `SearchAutocomplete`'s input via a ref.

---

### 5. Shorts feed "Like", "Save" and heart-burst do nothing — state is only local
**File:** `src/components/VideoCard.tsx:248-251, 608-645, 354-365`

**Reproduction:** in `/feed`, swipe to a card. Tap the heart (Like) button → red fill, count bumps from e.g. `1.2k` → `1.2k` (fake increment). Swipe to next card, swipe back. Heart is empty again, count reset. Same for the Bookmark/Save button and the center double-tap heart-burst.

**Impact:** the entire engagement rail on the feed is a lie. Users who save shorts expect them in `/favorites` but nothing syncs there. No `toggleFavorite`, no `POST /api/favorites`, no score event, no analytics. Nominally this is the TikTok competitive differentiator per CLAUDE.md's UX strategy — and it's non-functional.

**Fix:** call `toggleFavorite({ id: video.id, slug: video.slug, title, thumbnail })` from the like button onClick; call `addToHistory(...)` when a card becomes active long enough to count as a view; persist Save the same way. Hydrate initial state from `isFavorite(video.id)` and also from server when logged in.

---

### 6. Global `useVideoShortcuts` keydown handler steals Space from every focused button on the watch page
**File:** `src/hooks/useVideoShortcuts.ts:24-42`

**Reproduction:** on `/watch/[slug]`, use Tab to focus any button — e.g. "Source", "Upvote", "Save", tag pill. Press Space. Expected: button activates. Actual: `window.keydown` handler runs, tag isn't INPUT/TEXTAREA, `e.preventDefault()` blocks the Space activation and toggles video play/pause instead.

**Impact:** keyboard navigation is broken on the whole watch page. Accessibility regression. Anyone using Tab+Space (a11y users, power users) cannot activate any button while the WatchPlayer is mounted.

**Fix:** in the handler, also skip when `(e.target as HTMLElement).tagName === "BUTTON"` or `role="button"`, or more robustly check whether the active element is the video container / document body.

---

## 🟠 CRITICAL (noticeable bug but user can recover)

### 7. Logged-in user visiting `/watch/[slug]` on a new device sees "Save" on every video they've already favorited
**File:** `src/components/WatchActions.tsx:18-21`, `src/lib/favorites.ts:92-95`

`isFavorite(videoId)` reads localStorage only. For a logged-in user on a new device/browser, the server is the source of truth but localStorage is empty. Every video displays as "Save" (not "Saved") until they click. Clicking creates a server duplicate (idempotent POST, so not a disaster) but the UX signals "nothing is saved".

**Fix:** on mount, if `session?.user`, fetch `/api/favorites?slug=X` (or a cached list) and hydrate state. Alternatively do a one-time bulk pull from `/api/favorites` on login in `UserDataSync` and push it into localStorage.

---

### 8. `addToHistory` fires `recordScoreEvent("video_view")` + PostHog + server POST on EVERY mount of the watch page
**File:** `src/components/WatchActions.tsx:19`, `src/lib/history.ts:56-70,34-54`

Every refresh or back-nav re-triggers the video-view event. The daily points cap limits score inflation, but the events table still bloats, PostHog counters double-count, and the user's position in the history list flips to "just now" on every refresh. Also wastes scraper-like quota on `/api/score` and `/api/history` per page view.

**Fix:** gate `addToHistory` on a session-scoped `Set<number>` or a localStorage key like `iku-viewed:${id}:${Date.now()}` with a 30-minute TTL so the same user on the same tab does not re-fire for the same video within a short window.

---

### 9. `SwipeFeed` missing "end of catalog" state and missing error handling for `/api/feed`
**File:** `src/components/SwipeFeed.tsx:32-82`

- `fetch('/api/feed')` has no `res.ok` check. A 500 makes `data.videos` undefined, the `if (data.videos && length > 0)` silently skips, `setPage(pageNum)` still runs → loop keeps fetching a failing endpoint forever (throttled only by the loadingRef/loop order).
- When the backend legitimately returns no more videos (end of catalog), `videos.length - activeIndex < 5` keeps triggering `fetchVideos(page + 1)` on every activeIndex change, producing an infinite refetch storm (each one no-op).
- No "You've reached the end" UI.

**Fix:** check `res.ok` and stop advancing on error; track an `exhausted` boolean set to true when an API response returns `videos.length === 0`; render a terminal card.

---

### 10. Search autocomplete shows nothing (no "No results") when query has 0 suggestions
**File:** `src/components/SearchAutocomplete.tsx:175, 209`

`showDropdown = open && suggestions.length > 0`. If the user types `asdfqwerty`, the API returns `[]`, the dropdown hides, and the user thinks the search box is broken. The form still submits on Enter and routes to `/tag/asdfqwerty` which is an empty tag page.

**Fix:** keep the dropdown open with a "No matching tags — press Enter to search anyway" item when suggestions length is 0 and query length ≥ 2.

---

### 11. `FavoritesClient.handleClear` fires `Promise.all` of N parallel DELETE requests and has no error handling
**File:** `src/app/favorites/favorites-client.tsx:54-67`

A user with 500 favorites clicking "Clear All" fires 500 concurrent DELETEs. Some may 429 under the /api/favorites rate limit, leaving server state inconsistent with the now-empty UI. On refresh, stray favorites return.

**Fix:** add a bulk `DELETE /api/favorites?all=1` endpoint, or batch client-side in chunks of 10 with await between batches; fail loud to the user on partial failures.

---

### 12. `WatchPlayer` receives only `src`, never `resolveUrl` — the in-player resolve useEffect is dead code, so the error fallback for failed URL resolution never runs
**Files:** `src/components/WatchPlayer.tsx:246-259`, `src/app/watch/[slug]/page.tsx:374-378`

The watch page passes `src={video.url || streamProxyUrl || ""}`. For Rule34Video/WP, the streamProxyUrl is always used. The `/api/resolve-video` effect at line 246 is never exercised from the watch page because `resolveUrl` is undefined → early return. Today this works by luck because `video.url` happens to be null in DB for those sources. If a future scraper change populates `videos.url` for Rule34Video with the IP-bound direct URL, the watch page will pass that directly to `<video src>` → 403 silently for every user (the exact silent bug fixed in CLAUDE.md).

**Fix:** in the watch page, detect `video.source === "rule34video" || video.source === "wp"` and pass `src={streamProxyUrl}` (never `video.url`), regardless of what DB returns.

---

## 🟡 POLISH (small issues, cumulative)

### 13. Profile page classifies success/error toast by substring matching
**File:** `src/app/profile/profile-client.tsx:127, 167`

`profileMsg.includes("fail") || profileMsg.includes("wrong")` decides color. Server error "Username already taken" renders green (looks like success).

**Fix:** replace `profileMsg: string | null` with `{ type: "success" | "error"; text: string }`.

---

### 14. `<video muted={muted}>` controlled prop + imperative mute race in `VideoCard` for mute via single-tap is throttled by 300ms double-tap delay
**File:** `src/components/VideoCard.tsx:449-458`

Every single-tap to unmute is scheduled via `setTimeout(toggleMute, 300)` to disambiguate from double-tap. The mute toggle feels laggy. Also, if the user does a **cross-side** double-tap (left then right quickly), `sameSide` is false, the else branch overwrites `lastTapTimeRef` and schedules yet another 300ms delayed mute, meaning **two** mute toggles end up queued — net zero change, confusing flicker.

**Fix:** track and clear the pending single-tap timer when a second tap arrives on ANY side (not just same side); or drop the single-tap-to-mute and rely on the explicit Sound button in the right rail.

---

### 15. Feed `<img>` and `<video>` have no onError fallback
**File:** `src/components/VideoCard.tsx:493-506, 514-526`

If `video.thumbnail` 404s (common with Gelbooru CDN expiration), the card shows a broken image icon over `background: #000`. If the video URL 403s (IP-bound token edge case), the card stays black forever with no retry or message.

**Fix:** `onError` on `<img>` swaps to a gradient placeholder; `onError` on `<video>` shows a subtle "video unavailable, swipe to skip" overlay.

---

### 16. `PosterCard` and `ThumbnailCard` `<Image>` never handle `onError` — broken thumbs render as broken image icons
**Files:** `src/components/PosterCard.tsx:115-126`, `src/components/ThumbnailCard.tsx:139-149`

Gelbooru thumbnails hotlink-protect and sometimes return placeholder GIFs or 403. Next.js `<Image>` shows a broken-image icon until the tab closes. Favorites-client already handles this with `imgBroken` state (`favorites-client.tsx:178`) — the other two cards should adopt the same pattern.

---

### 17. `WatchPlayer` toggleMute state updater calls `v.play()` inside `setMuted` updater
**File:** `src/components/WatchPlayer.tsx:586-608`

State updaters must be pure. React StrictMode in dev calls updaters twice, firing `v.play()` twice. Prod is fine (single call) but dev surfaces console noise.

**Fix:** read `muted` outside the updater (or use a ref), call `v.play()` outside `setMuted(next)`.

---

### 18. `AppShell.isActive("/character")` matches `/characters` hypothetical sibling routes via `startsWith`
**File:** `src/components/AppShell.tsx:332-335`

Currently no `/characters` route exists, but any future sibling path like `/character-creator` would light up the Characters nav as active. Tighten to `pathname === href || pathname.startsWith(href + "/")`.

---

### 19. Mobile drawer has no Escape-to-close handler
**File:** `src/components/AppShell.tsx:515-643`

Drawer opens with hamburger/More, overlay click closes it, but there is no `keydown Escape` listener. Minor a11y gap.

---

### 20. `ThumbnailCard` hover preview `<video>` has no error handling; if src fails, `previewActive` stays true showing a black box
**File:** `src/components/ThumbnailCard.tsx:91-100, 161-170`

`el.play().catch(() => {})` swallows errors. If the URL 403s or network fails, the hover state sticks without recovery until mouseleave.

---

### 21. `SearchAutocomplete` goToTag sends character tags to `/tag/*` instead of `/character/*`
**File:** `src/components/SearchAutocomplete.tsx:132-140`

Autocomplete exposes `category === 4` (character). The homepage and sidebar route character links through `/character/[name]` for cocon semantique (SEO). The search dropdown routes them all through `/tag/[name]` which diverges from the linking strategy.

**Fix:** in `goToTag`, branch on the tag object's category and build `/character/${encodeURIComponent(name)}` for cat 4 and `/series/${slug}` for cat 3 when a matching series exists.

---

### 22. Progress-bar `onMouseLeave` schedules hide, but the mouse leaves every frame of a dragging scrub outside the bar — minor flicker risk
**File:** `src/components/WatchPlayer.tsx:1360-1363, 1389-1394`

During seek, the cursor may briefly leave the 16px hitbox — `scheduleHide` fires, 3s timer starts, user gets controls faded mid-scrub. Not fatal but inconsistent with scrub-in-progress UX. Fine to leave for now.

---

### 23. `/feed` close button returns to `/` — uses `<Link href="/">` which does client-side nav, but `AppShell` skips rendering for `/feed`, so the nav shell remounts from scratch. Minor flash.
**File:** `src/components/SwipeFeed.tsx:125-144`, `src/components/AppShell.tsx:328-330`

Not really a bug — documented behavior — but visually jarring. Consider a fade.

---

### 24. `VideoCard` `data-progress-bar` closest check is defensive-programming dead code because the progress bar already stops propagation
**File:** `src/components/VideoCard.tsx:412`, `:801`

`onClick={(e) => e.stopPropagation()}` on the progress bar already prevents the tap handler from firing. The `closest("[data-progress-bar]")` check is redundant. Harmless but confusing on read.

---

## ✅ Verified correct

- WatchPlayer `muted={muted}` controlled prop + `useEffect` force-sync + `toggleMute` via setState-only: the three freshly-fixed silent bugs are consistently applied across toggleMute, handleUnmuteClick, handleVolumeSlider, handleWheel, handleTouchMove, handleVolumeChange. No remaining direct `v.muted = x` mutations where React also holds state.
- `VideoCard` mirrors the same pattern via its own useEffect sync at lines 276-281.
- `SwipeFeed` intersection observer fetch-ahead logic (not the error-handling — that's in Critical #9) — the buffer-ahead refetch correctly unblocks when a server-side filter drops most of a page.
- `AppShell` body scroll lock + navigation auto-close work correctly.
- `WatchPlayer` timer cleanup in unmount useEffect covers every ref defined in the file.
- `SearchAutocomplete` abort-on-new-query + click-outside close + Escape in-dropdown: correct.
- `generateStaticParams = async () => []` + `dynamicParams = true` in watch page: ISR enabled as documented.
- `containsBannedContent(video)` check in watch page before rendering: present and correct.
- `useVideoShortcuts` correctly skips INPUT/TEXTAREA/contenteditable (but does NOT skip buttons — see Blocker #6).
- CSP `connect-src` includes both `https://gelbooru.com` and `https://*.gelbooru.com` (both bare and wildcard) and `danbooru.donmai.us` for autocomplete.

---

## Priority for fixing

1. Blockers #1 and #2 together: route browsing pages through `getVideos()` and fix `getRelatedPosts`. One shared refactor; unlocks 96% of catalog + sane related across site. Biggest KPI impact.
2. Blocker #5 (feed engagement): lowest effort, highest UX payoff — 2 `toggleFavorite` calls.
3. Blocker #3 (favorite remove race) + Critical #7 (isFavorite desync): both are about auth/localStorage drift. Fix together.
4. Blocker #4 (Search → /explore mismatch): 1-line fix or create dedicated /search page.
5. Blocker #6 (Space key): 1-line fix in `useVideoShortcuts`.
6. Blocker #12 (watch page source-aware src): defensive.
7. Critical #8-#11 as capacity allows.
