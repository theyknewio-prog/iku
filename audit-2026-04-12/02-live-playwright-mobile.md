# Agent 2 — Live site audit iPhone 16 Pro Max (2026-04-11)

## 🔴 P0 — THE ROOT CAUSE of "tout est noir / footer 4km / new releases cassé"

### hgasm1.com blocked by CSP → 80-97% of thumbnails fail

| Page | Images broken | Total |
|------|--------------|-------|
| Homepage | **50 / 62** | 80.6% fail |
| /trending | **22 / 41** | 53.7% fail |
| /new | **40 / 41** | **97.6% fail** |

Evidence from console: 20+ CSP violations on every page, all pointing at images from `hgasm1.com` being blocked by the `img-src` directive.

**Why**: the hentaigasm scraper pulled thumbnails from `hgasm1.com` (probably the origin CDN), but `src/middleware.ts` CSP never whitelisted that domain. Every hentaigasm video shows as a black/empty card. That's why /new is "all black" and /trending has holes.

**User complaint mapping**:
- "footer fait 4km sur homepage" → actually the scroll height is 7314px because all the broken cards still reserve vertical space. When you scroll past 50+ invisible cards it FEELS like endless footer.
- "trending jai des ad vide, c tout noir" → not ads, broken video thumbnails
- "new releases tout est noir" → 97% broken thumbnails
- "pareil homepage jai des blocs blancs" → mix of broken hgasm1.com thumbnails + failing ads

**Fix** (one line): add `https://hgasm1.com https://*.hgasm1.com` to the `img-src` directive in `src/middleware.ts`. Also check if hentaicity uses a similar CDN — likely yes.

---

## 🔴 P0 — Watch page white ad box stuck in "loading"

On `/watch/[slug]` there's a visible white 300x250 area with an error icon + "Ad loading..." text below the player. It's an Adsterra srcdoc iframe that started loading but never finished (or the inner script failed). Needs investigation: is it the 300x250 banner, or one of the underplayer slots?

---

## 🔴 P0 — Shorts interstitial never triggers

After **15 rapid swipes** in `/feed`, agent found 0 dialogs/modals/interstitials. The `FeedInterstitial` component I replaced earlier today with HentaiPros 300x250 is wired but the trigger logic isn't firing. Either:
- The swipe counter resets on each video mount
- The threshold is too high (I think it's 5, so 15 swipes = should trigger 3 times)
- The overlay renders but is invisible (z-index / display bug)

User complaint: "jai beau scroll les shorts, 0 pub, il en faut tous les 3 shorts". Currently the code says every 5. Sab wants every 3.

---

## 🔴 P1 — CSP blocks multiple ad networks

Adsterra sub-networks being blocked:
- `protrafficinspector.com`
- `skinnycrawlinglax.com`
- `sourshaped.com`
- `realizationnewestfangs.com`
- `hotfree123.com`
- `preferencenail.com`

These are Adsterra's rotating ad-server shards. CSP only allows the main `highperformanceformat.com`. Fix: add the shard domains to `script-src` + `connect-src` (they change all the time, needs a wildcard like `https://*.adsterratech.com` or similar root domains).

---

## 🔴 P1 — Telegram link missing from mobile menu

Confirmed: mobile drawer only has Discord. No Telegram anywhere on mobile. Desktop sidebar has both. Already noted by agent 1.

---

## 🔴 P1 — `/tags` redirects to homepage

`/tags` endpoint redirects to `/`. Should show tag browsing. Broken route.

---

## P2 findings

- 11 ad slots on homepage, some with 0x0 dimensions (invisible placeholders)
- CamWidget + social bar all rendering correctly
- Bottom nav properly pinned (rect.bottom = 932 on all pages after scroll)
- No horizontal overflow anywhere (fix from this morning is holding)

---

## ✅ Pages confirmed working

- `/explore` — responsive, no bugs detected (**contradicts** user complaint "pas responsive tout est gros")
- `/tag/<tag>` — ok
- `/character/<slug>` — ok
- `/character` — ok
- `/series` — ok
- `/blog` — ok
- `/glossary` — ok
- `/favorites`, `/history`, `/settings` — ok
- `/login`, `/signup` — ok
- `/watch/[slug]` — ok aside from the white ad box (player works, cards work, related ok)

Note on `/explore` — user said it's "pas responsive tout est gros". Agent didn't see this. Might be a device-specific rendering or a CSS cache issue. Needs a second look with real device.

---

## Metrics summary (iPhone 16 Pro Max 430x932)

| Page | scrollHeight | Overflow | Broken imgs | Console errs |
|------|-------------|----------|------------|--------------|
| / | 7314 | -6 | 50/62 | 36 |
| /trending | 5174 | -6 | 22/41 | 2 |
| /new | 5167 | -6 | 40/41 | 82 |
| /explore | normal | -6 | few | ok |
| /feed | — | — | — | — |
| /watch | 4144 | -6 | few | ok |
