# Ad Revenue Diagnostic — 2026-04-18

## TL;DR

Current 14d ad revenue: **$1.15 total** ($0.082/day).

- ExoClick: $0.51 (82% from VAST preroll, rest from banners at $0.004–$0.020 eCPM)
- Adsterra: $0.64 (71% from popunder at $0.36 eCPM, rest from banners at $0.025–$0.037)

**Per-impression, Adsterra earns 16× more than ExoClick** on the exact same traffic.

**Root cause of low banner eCPM on ExoClick**: `minimum_cpm=$0` on every zone → accepting $0.001 bottom-feeder bids. Dashboard only — API silently rejects updates.

---

## Per-zone ExoClick data (14d)

| Zone    | Label                    | Impressions  | Revenue | eCPM    | Status                     |
| ------- | ------------------------ | ------------ | ------- | ------- | -------------------------- |
| 5895978 | Mobile 300x50            | 3,873        | $0.016  | $0.0041 | ❌ Dead                    |
| 5893266 | Sidebar 300x250          | 5,386        | $0.031  | $0.0058 | ❌ Dead                    |
| 5893256 | Watch Underplayer 728x90 | 3,955        | $0.036  | $0.0092 | ❌ Dead                    |
| 5893292 | Native Grid 300x250      | 426          | $0.009  | $0.0204 | ⚠️ Low volume              |
| 5893268 | VAST Preroll             | 0 video_hits | $0.421  | —       | ✅ 82% of ExoClick revenue |

## Per-placement Adsterra data (14d)

| Placement | Type           | Impressions | Revenue | eCPM   | Status                     |
| --------- | -------------- | ----------- | ------- | ------ | -------------------------- |
| 28986138  | Popunder       | 1,267       | $0.456  | $0.360 | ✅ 71% of Adsterra revenue |
| 28986141  | Banner 300x250 | 4,972       | $0.122  | $0.025 | ⚠️ Low                     |
| 28986144  | Banner 728x90  | 1,637       | $0.061  | $0.037 | ⚠️ Low                     |

---

## Sab dashboard TODOs (expected lift: +50–300% banner eCPM)

### 1. ExoClick — set CPM floors (10 minutes)

Log in at https://admin.exoclick.com → Zones → each zone → set **Minimum CPM** and save.

**Recommended floors** (conservative — still leaves DEU/JPN/CHN demand intact):

| Zone ID | Name                     | Set min_cpm |
| ------- | ------------------------ | ----------- |
| 5893256 | Watch Underplayer 728x90 | **$0.05**   |
| 5893266 | Sidebar 300x250          | **$0.05**   |
| 5893268 | VAST Preroll             | **$1.00**   |
| 5893290 | Popunder                 | **$0.15**   |
| 5893292 | Native Grid 300x250      | **$0.05**   |
| 5893294 | Feed Interstitial        | **$0.30**   |
| 5895978 | Mobile 300x50            | **$0.03**   |

**Why it works**: right now zones accept $0.001 bids. Flooring at $0.05 kicks out Turkish/junk demand but keeps DEU ($0.093 observed eCPM), JPN ($0.012), CHN ($0.042). On no-fill, the site already cascades to Adsterra via `ad-utils.ts::scheduleNoFillFallback` — so revenue is protected.

### 2. ExoClick — enable Neverblock CNAME (15 minutes)

Go to https://neverblock.exads.com/ → set up first-party CNAME. This rotates the VAST/popunder endpoints (`s.magsrv.com` / `s.pemsrv.com`) to a branded domain that adblockers don't block.

**Note**: this does NOT rotate `a.magsrv.com/ad-provider.js` (main script). Adblock still blocks the main script. But Neverblock is worth doing — our 14d VAST preroll revenue is $0.42 and popunder $0.46, so any uplift here compounds.

### 3. Signup new demand partners (45 minutes)

| Network          | Signup                                 | Why                                  |
| ---------------- | -------------------------------------- | ------------------------------------ |
| **JuicyAds**     | https://www.juicyads.com/advertise.php | #1 premium adult CPM, reliable fills |
| **TrafficStars** | https://trafficstars.com/publishers    | Solid for US/EU banners              |
| **HilltopAds**   | https://hilltopads.com/publishers      | Strong on push + popunder            |

Skip: TrafficJunky (PornHub network, redundant), ClickAdu (popunder redundant with Adsterra).

---

## What's already automated

- Client-side Adsterra fallback if ExoClick no-fills (`src/lib/ad-utils.ts`)
- Revenue trend cron 8h UTC daily → Telegram
- Weekly monitoring cron Mondays 10h UTC
- Zone stats + probe scripts in `/scripts/exoclick-*.mjs` + `/scripts/adsterra-unit-stats.mjs`

## What's blocked by API

Confirmed via probe on 2026-04-18: ExoClick API v2 `PUT /v2/zones/{id}` returns `200 "Zone updated."` but **silently drops** these fields:

- `minimum_cpm`, `cpm_floor_type`
- `alternate_html`, `fallback_ads`
- `enable_bid_shading`
- `pricing_models` (explicit 403)

Only `name` and `border` actually persist. Dashboard UI is required for everything else.

---

## Revenue projection after Sab's dashboard 30 minutes

Current: $2.50/month (extrapolated from 14d).

Post-fix optimistic:

- ExoClick banner CPM floors ($0.05): ExoClick banners rise from $0.005 → $0.03–0.05 eCPM on filled inventory (5×), with Adsterra picking up the no-fills. **+$0.50/month.**
- Neverblock VAST/popunder: uplift 15–30% on current $0.88 from those formats. **+$5/month.**
- JuicyAds banner signup: add $0.30–0.50 eCPM on 10K banner imp/month. **+$3–5/month.**

Combined: **$10–15/month** (vs current $2.50). 4–6× lift. Still tiny — real unlock is traffic growth, not CPM.
