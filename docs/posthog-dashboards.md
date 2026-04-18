# PostHog Dashboards — iku.gg

## 3 dashboards à créer

Tu peux les créer via l'UI PostHog OU via l'API (script `scripts/posthog-setup-dashboards.mjs` — nécessite une Personal API key `phs_...`).

---

## Dashboard 1 : 📊 Acquisition & Engagement

**URL** : https://us.posthog.com/project/370092/dashboard

### Insights à créer

**1. Total pageviews (last 30 days)**

- Type: Trends
- Events: `$pageview`
- Interval: Day
- Chart: Line

**2. Unique visitors (daily)**

- Type: Trends
- Events: `$pageview`
- Math: `DAU` (unique per day)
- Chart: Line

**3. Top landing pages**

- Type: Trends
- Events: `$pageview`
- Breakdown: `$pathname`
- Chart: Bar horizontal, top 10

**4. Top referrers**

- Type: Trends
- Events: `$pageview`
- Breakdown: `$referring_domain`
- Chart: Bar horizontal, top 10

**5. Countries (where traffic comes from)**

- Type: Trends
- Events: `$pageview`
- Breakdown: `$geoip_country_code`
- Chart: World map

**6. Mobile vs Desktop**

- Type: Trends
- Events: `$pageview`
- Breakdown: `$device_type`
- Chart: Pie

---

## Dashboard 2 : 🎯 Conversion Funnels

### Funnel A : Anon → Signup → Active User

- Type: Funnel
- Steps:
  1. `$pageview` (any page)
  2. `signup`
  3. `login` (second session)
  4. `favorite_add` (first favorite)
- Conversion window: 7 days

### Funnel B : Signup → Pro Purchase

- Type: Funnel
- Steps:
  1. `signup`
  2. `$pageview` where pathname = `/pricing`
  3. `pro_checkout_start`
  4. `pro_purchase`
- Conversion window: 30 days

### Funnel C : Video Engagement

- Type: Funnel
- Steps:
  1. `$pageview` where pathname starts with `/watch/`
  2. `video_view`
  3. `video_complete` _(need to wire this first from watch page)_
  4. `favorite_add`
- Conversion window: 1 session

### Funnel D : Discord Community Join

- Type: Funnel
- Steps:
  1. `$pageview` (landing)
  2. `discord_invite_click`
  3. `discord_link` _(only if user actually completes Discord OAuth)_
- Conversion window: 1 day

---

## Dashboard 3 : 🔁 Retention & Gamification

### Cohort retention

- Type: Retention
- Cohortize on: `signup`
- Returning event: `$pageview`
- Interval: Day

### Daily active users (DAU/WAU/MAU)

- Type: Trends
- Events: `$pageview`
- Math: DAU, WAU, MAU side by side

### Streak distribution

- Type: Trends
- Event: `tier_up`
- Breakdown: `tier_name`
- Chart: Bar

### Badge earning rate

- Type: Trends
- Event: `badge_earned`
- Breakdown: `code`
- Chart: Bar horizontal, all badges

### Gamification engagement

- Type: Trends
- Multiple events :
  - `video_view` → count
  - `favorite_add` → count
  - `badge_earned` → count
  - `tier_up` → count
- Chart: Line, stacked

### Leaderboard / top users

- Type: Trends
- Event: `video_view`
- Breakdown: `distinct_id`
- Chart: Bar horizontal, top 20

---

## Events wired (ready to query)

Ces events sont déjà câblés dans le code et devraient apparaître dans PostHog dès que les users interagissent :

| Event                  | Déclenché par                                       |
| ---------------------- | --------------------------------------------------- |
| `$pageview`            | Auto (toute navigation)                             |
| `$autocapture`         | Auto (clics boutons/liens)                          |
| `app_loaded`           | Auto (chaque chargement initial)                    |
| `signup`               | `/api/signup` réussi (client-side)                  |
| `login`                | Login credentials ou Discord réussi                 |
| `logout`               | Bouton sign out profile page                        |
| `discord_link`         | Click sur "Continue with Discord" (login ou signup) |
| `video_view`           | `addToHistory()` — ouverture d'une page /watch      |
| `favorite_add`         | Toggle favorite ON                                  |
| `favorite_remove`      | Toggle favorite OFF                                 |
| `search`               | Form submit SearchAutocomplete                      |
| `pro_checkout_start`   | Click sur "Get Pro" dans /pricing                   |
| `pro_purchase`         | Landing sur /profile?upgraded=1 après Stripe        |
| `badge_earned`         | Award automatique via scoring engine                |
| `tier_up`              | Transition de tier via scoring engine               |
| `discord_invite_click` | Click sur JoinDiscordCTA component                  |
| `email_verified`       | Landing sur /profile?verified=1                     |

---

## Events manquants à câbler (si on veut aller plus loin)

- `video_complete` — à ajouter dans `WatchPlayer.tsx` quand la vidéo atteint 80% de durée
- `tag_click` — à ajouter dans les `hp-genre-tag` cards sur homepage
- `character_click` — à ajouter dans les character cards
- `pro_cancel` — à ajouter côté webhook Stripe (server-side, via PostHog Node.js SDK — pas encore installé)

---

## Script d'automatisation (nécessite Personal API key)

Si tu veux que ce soit scripté plutôt que manuel :

1. Va sur https://us.posthog.com → profil → **Personal API keys** → **Create personal API key**
2. Scope: `insight:write`, `dashboard:write`
3. Donne-moi la clé `phs_...`
4. Je crée un script `scripts/posthog-setup-dashboards.mjs` qui lit cette doc et crée tous les insights + dashboards via l'API en une seule commande
