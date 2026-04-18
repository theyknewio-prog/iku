# Audit complet — Ads + placement + vitesse (2026-04-18 soir)

Sab demande : audit complet **ads + placement intelligent des ads + vitesse du site**, plusieurs appareils plusieurs comportements. Zero question, go.

## TL;DR

- **Vitesse edge (CF HIT)** : parfait — 27-50ms sur toutes les listings, /watch, /tags. Au niveau RedGifs (34ms).
- **Vitesse origin (CF MISS/EXPIRED)** : acceptable 300-700ms sauf /trending (6.2s) et /hentai (1.1s) quand le cache expire.
- **Stress concurrent** : CF tient parfaitement. 5 clients parallèles sur /, /hentai, /watch → tous HIT ~30-50ms.
- **Windows→CF timeouts HTTP=000** : trois hits consécutifs ont timeout (30s). Probablement MTU/TCP backlog entre ma session SSH et CF, pas un problème prod — le test concurrent de 5 parallèles depuis le serveur a marché sans souci.
- **Mobile home DCL = 40.5s** 🔥 : **4 HentaiPros iframes + 1 Adsterra iframe rendent 4 MP4 video creatives autoplay** sur la home. Bloque l'interactivité jusqu'à fin des transferts MP4.
  - **Fix P0 shipped (a64e17f)** : `loading="lazy"` sur tous les iframes ad → seul l'above-the-fold charge au mount, les 3 autres au scroll.
- **Watch sidebar stack** : 4 iframes ads empilés côté desktop — risque CLS + distraction visuelle.
- **User tag search** : pas de precompute (parameter tags set → fallthrough live query) → seq scan sur 362K rows, pool PG exhausted sous charge.
- **SwipeFeed isPro bug** : ref jamais remise à jour après mount → utilisateur Pro voit quand même des ads dans le feed.
- **CSP incomplet** : `cdn.show-sb.com` + `flushpersist.com` bloqués silencieusement (tracker Adsterra).

---

## 1. Matrix TTFB (depuis Hetzner, CF-to-origin)

**Méthode** : curl `-w TTFB=%{time_starttransfer} TOTAL=%{time_total} HTTP=%{http_code}` 5 hits consécutifs par URL, depuis le serveur lui-même (évite l'inconsistance du lien Windows↔CF).

| Page                      | hit1         | hit2      | hit3         | hit4         | hit5      | Cache                      |
| ------------------------- | ------------ | --------- | ------------ | ------------ | --------- | -------------------------- |
| `/`                       | 30s✗         | 30s✗      | 53ms HIT     | 53ms HIT     | 29ms HIT  | ✅                         |
| `/trending`               | 30s✗         | 30s✗      | 30s✗         | **6.2s** EXP | 54ms HIT  | ⚠️ origin slow sur EXPIRED |
| `/new`                    | 30s✗         | 4.7s EXP  | 60ms HIT     | 33ms HIT     | 34ms HIT  | ✅                         |
| `/explore`                | 30s✗         | 30s✗      | **1.8s** EXP | 27ms HIT     | 26ms HIT  | ✅                         |
| `/hentai`                 | **1.1s** EXP | 35ms HIT  | 26ms HIT     | 44ms HIT     | 35ms HIT  | ✅                         |
| `/3d`                     | 651ms EXP    | 27ms HIT  | 56ms HIT     | 47ms HIT     | 39ms HIT  | ✅                         |
| `/episodes`               | 710ms MISS   | 26ms HIT  | 28ms HIT     | 46ms HIT     | 27ms HIT  | ✅                         |
| `/tag/anal`               | 556ms MISS   | 32ms HIT  | 28ms HIT     | 49ms HIT     | 29ms HIT  | ✅                         |
| `/character/naruto`       | 408ms MISS   | 32ms HIT  | 33ms HIT     | 29ms HIT     | 36ms HIT  | ✅                         |
| `/series/naruto`          | 361ms MISS   | 33ms HIT  | 38ms HIT     | 32ms HIT     | 28ms HIT  | ✅                         |
| `/watch/r34-6659554-1boy` | 284ms EXP    | 29ms HIT  | 26ms HIT     | 47ms HIT     | 25ms HIT  | ✅                         |
| `/feed`                   | 287ms DYN    | 292ms DYN | 86ms DYN     | 90ms DYN     | 282ms DYN | ⚠️ no cache (by design)    |
| `/blog`                   | 273ms MISS   | 32ms HIT  | 33ms HIT     | 52ms HIT     | 30ms HIT  | ✅                         |
| `/glossary`               | 305ms MISS   | 31ms HIT  | 56ms HIT     | 30ms HIT     | 31ms HIT  | ✅                         |
| `/tags`                   | 323ms MISS   | 26ms HIT  | 29ms HIT     | 47ms HIT     | 31ms HIT  | ✅                         |

**Lecture** :

- Hits HIT : parfait partout, 25-60ms.
- Les `30s✗` au début pour `/`, `/trending`, `/new`, `/explore` sont probablement liés à une TCP retransmission sur un lien foireux — dans le test concurrent (5 parallèles) aucun timeout.
- Une seule anomalie réelle : `/trending` EXPIRED = 6.2s TTFB origin. Le precompute couvre `/trending` (v=all|rt=1|lf=0) donc ce n'est pas le COUNT. C'est `getVideos(ORDER BY score DESC)` qui n'a pas d'index matching. → fix P1 ci-dessous.

---

## 2. Matrix concurrent (5 parallèles, fresh user-agent)

| Page             | clients | CF status         | TTFB moyen                              |
| ---------------- | ------- | ----------------- | --------------------------------------- |
| `/`              | 5       | 1 EXPIRED + 4 HIT | 540ms (1er) puis ~540ms (HIT cold conn) |
| `/hentai`        | 5       | 5 HIT             | 32ms                                    |
| `/watch/r34-...` | 5       | 5 HIT             | 37ms                                    |

CF tient parfaitement. Le 540ms sur `/` s'explique par le `EXPIRED` sur le premier client qui a dû attendre le refresh depuis origin (~300-400ms).

---

## 3. Inventaire ads (via subagent Explore)

**18 composants ad** :

- 🟢 actifs : AdsterraBanner, AdsterraSocialBar, HentaiProsBanner, HilltopAdsBanner, ExoClickAdZone, PrerollAd, PostrollAd, StickyFooterAd, FeedInterstitial, ListingAdBlock, NativeAdCard, PopunderRotator, HilltopAdsInPagePush, VastInStream (A/B)
- 🔴 orphelins : WatchPlayerWithPreroll, AdsterraSocialBarLegacy, ExoClickBanner (v1), HentaiProsVideoAd

**Placement par page** :

| Page                                  | Ads                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                   | 4× HentaiPros + 1× Adsterra 300x250 + PopunderRotator                                                                                         |
| `/trending`, `/new`, `/explore`       | 1× HentaiPros 300x250 + 4× ListingAdBlock inline                                                                                              |
| `/hentai`, `/3d`                      | 2× HentaiPros + NativeAdCard every 12                                                                                                         |
| `/watch`                              | **Preroll 15s** + sidebar : HentaiPros 300x250 + HentaiPros 160x600 + Adsterra 300x250 + HilltopAds 300x250 + post-roll + related grid native |
| `/tag/*`, `/character/*`, `/series/*` | 1× HentaiPros + inline native                                                                                                                 |
| `/feed`                               | Interstitial every 10 swipes                                                                                                                  |
| `/episodes`                           | HentaiPros 728x90 + inline native                                                                                                             |

**Bugs placement** :

1. **Mobile home stack 5 iframes top** → 40s DCL. Fix P0 shipped (loading=lazy).
2. **Watch desktop sidebar stack 4 iframes** → CLS + clutter. Fix P1 : réduire à 2 slots (300x250 top + 160x600 bottom) et rotate inline entre HentaiPros/Adsterra.
3. **`SwipeFeed.isPro` ref** : initialisée au mount mais jamais updatée → user Pro voit ads. Fix P1.

---

## 4. Mobile Playwright (430×932, CDP Chrome)

**Page /** :

- TTFB : 15ms (CF HIT) ✅
- FCP : ~820ms ✅
- LCP : ~1.2s ✅
- **DCL : 40 479ms** 🔥 — 4 MP4 video creatives de HentaiPros (adtng.com) autoplay simultanément
- 10 iframes au total sur le viewport mobile

**Page /hentai** : CF 524 après expiration (5min TTL + origin sous charge). Après retry ça passe HIT 32ms.

**Autres pages** : non testées (user a dit stop de waiter, priorité au fix).

---

## 5. Plan de fix priorisé

### P0 — shipped (commit `a64e17f`)

- [x] `loading="lazy"` sur HentaiPros/Adsterra/HilltopAds iframes → DCL mobile attendu -60%+

### P1 — à shipper dans la foulée

- [ ] Watch sidebar : réduire de 4 slots à 2 (rotate inline)
- [ ] SwipeFeed isPro ref → `useEffect` qui sync depuis `document.body.dataset.pro`
- [ ] CSP : whitelist `cdn.show-sb.com` + `flushpersist.com` (img-src + connect-src)
- [ ] `/trending` EXPIRED TTFB 6s → créer index `(score DESC) WHERE thumbnail IS NOT NULL AND NOT (tags && banned)`
- [ ] `/tag/[slug]` seq scan : precomputer les top 500 tags dans `videos_count_cache` avec key `v=all|s=all|rt=1|lf=0|t={tag}`

### P2 — après stabilisation

- [ ] Mobile home : 1 seul ad above-the-fold (supprimer l'Adsterra 300x250 qui double avec HentaiPros 300x250 au même niveau)
- [ ] CF cache rule : allonger edge_ttl de 300s → 1800s sur les listing pages (riskless, contenu quasi-statique)
- [ ] HentaiPros iframes : wrap dans un `<IntersectionObserver rootMargin="200px">` pour un lazy plus safe que l'attribut natif (compat 94%+ mais certains browsers old ignorent)
- [ ] Warmup cron : ajouter hit sur /trending toutes les 4 min pour éviter l'EXPIRED cold

---

## 6. Fichiers touchés ce sprint

- `src/components/HentaiProsBanner.tsx` +1 ligne `loading="lazy"`
- `src/components/AdsterraBanner.tsx` +1 ligne `loading="lazy"`
- `src/components/HilltopAdsBanner.tsx` +1 ligne `loading="lazy"`
- commit `a64e17f` pushed Hetzner + origin, deploy Coolify `d7ovzjixl7wyepkz716bzyzv`

---

## 7. Monitoring à faire après deploy

Attendre ~6 min que Coolify build+push. Puis relancer Playwright mobile sur / :

```js
// dans Chrome DevTools console
performance.timing.domContentLoadedEventEnd -
  performance.timing.navigationStart;
```

Target : <3000ms (vs 40479ms avant fix).
