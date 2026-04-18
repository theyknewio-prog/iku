# iku.gg Deep Audit — Master Report (2026-04-05)

**Scope :** audit complet pré-lancement abonnements Stripe live. 7 domaines auditées en parallèle par agents spécialisés + E2E Playwright en prod sur les parcours critiques.

## 📊 Score global

| Domaine               | Blockers 🔴 | Critical 🟠 | Minor 🟡 | Report                   |
| --------------------- | ----------- | ----------- | -------- | ------------------------ |
| **Conversion funnel** | 6           | 10          | 6        | `.audit/conversion.md`   |
| **Security**          | 3           | 4           | ~7       | `.audit/security.md`     |
| **UX bugs**           | 6           | 6           | 12       | `.audit/ux.md`           |
| **Database**          | 6           | 7           | 12       | `.audit/database.md`     |
| **Performance**       | 2           | 7           | —        | `.audit/performance.md`  |
| **Supply chain**      | 3           | 4           | 7        | `.audit/supply-chain.md` |
| **Code review**       | 11          | 13          | —        | `.audit/code-review.md`  |
| **TOTAL**             | **37**      | **51**      | **44+**  |                          |

**Verdict :** ❌ **NE PAS lancer les abonnements en l'état.** Il y a trop de blockers dans trois zones critiques : banned content filter (légal), conversion funnel (money), UX des browse pages (96% du catalog invisible).

---

## 🔴 TOP 10 BLOCKERS (fix absolument avant lancement live subs)

### 1. 🚨 Banned content filter ne check QUE `tags` — pas `characters`, `copyrights`, `title`, `slug`

**Source :** security.md #1 + database.md N10 + ux.md #1
**Fichiers :** `src/lib/content.ts` BANNED_TAGS filter, `src/lib/danbooru.ts searchPosts`, `scripts/db.ts upsertVideos`
**Risque :** Un post Danbooru avec `loli` dans le title mais pas les tags passe. Un character slug contenant `young_girl` passe. **Risque légal existentiel sur un site adult.**
**Fix :** étendre le filtre SQL pour aussi matcher `characters && banned::text[]`, `copyrights && banned::text[]`, `title ILIKE ANY(patterns)`, `slug ~* banned_pattern`. Appliquer partout (getVideos, rule34video.ts, wp-hentai.ts).

### 2. 🚨 96 % du catalog invisible sur les pages de browsing

**Source :** ux.md #1
**Fichiers :** `src/app/new/page.tsx`, `/trending/page.tsx`, `/tag/[tag]/page.tsx`, `/character/[slug]/page.tsx`, `/series/[slug]/page.tsx`
**Problème :** Ces 5 pages importent `searchPosts` depuis `@/lib/danbooru` au lieu de `getVideos` depuis `@/lib/content`. Elles ne montrent que les ~17K vidéos Danbooru (4% du catalog). Les 277K Rule34Video, 20K Gelbooru, 20K Rule34, 18K WP sont invisibles. **Plus les 4 pages de browsing les plus importantes du site sont cassées.**
**Fix :** remplacer `searchPosts` par `getVideos({ tags, ... })`. Bonus : ça applique automatiquement le banned filter.

### 3. 🚨 `getRelatedPosts()` = top Danbooru random pour 78 % des watch pages

**Source :** ux.md #2 + security.md #2
**Fichiers :** `src/lib/danbooru.ts:253-272` appelé dans `/watch/[slug]/page.tsx` et `WatchPlayer` autoplay-next
**Problème :** Pour toute vidéo non-Danbooru (r34v, gel, r34, wp — ~336K vidéos), la fonction fallback vers « top Danbooru » random. Related videos, autoplay-next, sidebar → tous servent du contenu random non lié ET non filtré banned content.
**Fix :** utiliser `getVideos({ tags: sharedChars, excludeId })` avec les characters/copyrights partagés.

### 4. 🚨 Waifu Scholar 30% coupon CRASH le checkout

**Source :** conversion.md #1
**Fichier :** `src/app/api/stripe/checkout/route.ts`
**Problème :** L'appel `stripe.checkout.sessions.create` passe EN MÊME TEMPS `allow_promotion_codes: true` ET `discounts: [{ coupon }]`. Les deux sont mutuellement exclusifs côté API Stripe — ça throw `StripeInvalidRequestError` → checkout 500. **Les users tier 5 (Waifu Scholar) ne peuvent PAS acheter Pro.**
**Fix :** retirer `allow_promotion_codes: true` quand `discounts` est set. Ou l'inverse.

### 5. 🚨 Lifetime purchase downgradé silencieusement par les webhooks subscription suivants

**Source :** conversion.md #2 + code-review.md #3
**Fichier :** `src/app/api/stripe/webhook/route.ts`
**Problème :** Le handler `customer.subscription.updated` écrase `users.pro_plan` même si le user a déjà `pro_status = 'lifetime'`. Si un lifetime buyer active par erreur un autre plan (ou un webhook arrive en retard), son statut lifetime disparaît. **Perte de bénéfices payés à vie.**
**Fix :** guard `WHERE pro_status != 'lifetime'` sur tous les UPDATE de pro_status.

### 6. 🚨 Shorts feed Like/Save/Heart-burst = état UNIQUEMENT local, ZÉRO sync server

**Source :** ux.md #5
**Fichier :** `src/components/VideoCard.tsx:608-645`
**Problème :** Les boutons Like / Save et le double-tap heart-burst updatent SEULEMENT un useState local. Aucun appel `toggleFavorite`, aucun `POST /api/favorites`, aucun score event, aucune analytics. Le user save un short → swipe → revient → c'est vide. **Le core differentiator du feed (engagement TikTok-style) est un mensonge UI.**
**Fix :** câbler `toggleFavorite({ id, slug, title, thumbnail })` sur le onClick. Hydrater l'état initial depuis `isFavorite()` + server.

### 7. 🚨 `/profile?upgraded=1` ne montre PAS le statut Pro — users pensent qu'ils n'ont rien payé

**Source :** conversion.md #5
**Fichier :** `src/app/profile/page.tsx` + profile-client
**Problème :** La page n'affiche pas `pro_status`, `pro_plan`, badge "Pro", ou autre indicator visuel. Après paiement Stripe, le user atterrit sur `/profile?upgraded=1` mais ne voit aucune différence. Confusion → support ticket garanti.
**Fix :** afficher un bloc "✨ iku.gg Pro activé" avec le plan acheté et la date d'expiration.

### 8. 🚨 Discord OAuth hijack sur comptes non vérifiés

**Source :** conversion.md #3 + security.md #5
**Fichier :** `src/auth.ts findOrCreateDiscordUser`
**Problème :** Attacker signs up `target@gmail.com` password, ne vérifie PAS l'email. Plus tard, l'attacker Discord-login avec un compte Discord qui a `target@gmail.com` comme email. `findOrCreateDiscordUser` fait un lookup par email → trouve le compte non vérifié → **link le compte**. Attacker a maintenant accès via Discord. OR : attacker qui a un Discord avec n'importe quel email peut s'approprier des signups-en-attente.
**Fix :** rejeter le link si `email_verified = false` sur le compte trouvé. Ne créer/link qu'avec un email verifié OU un profile.email_verified côté Discord.

### 9. 🚨 Plan fallback `priceId?.includes("year")` est DEAD — yearly subs deviennent monthly

**Source :** conversion.md #7
**Fichier :** `src/app/api/stripe/webhook/route.ts`
**Problème :** Quand Stripe envoie un webhook sans metadata.plan explicite, le handler fallback fait `priceId.includes("year")` pour deviner. Les price IDs Stripe sont opaques (`price_1TIsKw...`) — ils NE contiennent JAMAIS "year". Tous les yearly subs sont donc classés comme monthly en DB. **Facturation correcte (Stripe), mais UI dit monthly, durée calculée en monthly.**
**Fix :** remplacer par un lookup strict : `if (priceId === STRIPE_PRICE_YEARLY) return 'yearly'` etc.

### 10. 🚨 Stripe webhook handler swallow les erreurs + retourne 200

**Source :** conversion.md #12 + code-review.md #2
**Fichier :** `src/app/api/stripe/webhook/route.ts`
**Problème :** Le handler a un try/catch global qui log les erreurs mais retourne HTTP 200 à Stripe dans TOUS les cas. Résultat : si la DB est down pendant un webhook de paiement, Stripe voit 200 → ne retry pas → **paiement reçu, Pro pas activé, pas de retry possible, perte totale du signal.**
**Fix :** retourner 500 sur toute erreur non-gérée. Stripe retry automatiquement pendant 3 jours.

---

## 🟠 AUTRES FINDINGS CRITIQUES (high priority, à fixer dans la foulée)

### Conversion

- **C2 :** webhook dedup race — `stripe_events` insertion fait AVANT le handler → second event arrive, voit la row, skip, mais le handler est en cours, silently drop payment
- **C3 :** `/api/favorites` POST pas de rate limit → abus possible bulk
- **C4 :** `allow_promotion_codes` fallback manquant → users sans tier Waifu ne peuvent pas utiliser les codes Stripe
- **C5 :** double-click sur checkout button → création de 2 Stripe sessions

### Security

- **S1 :** CSP `script-src 'unsafe-inline' 'unsafe-eval'` = zéro défense XSS
- **S2 :** `getVideos()` tag search `ILIKE '%' || $N || '%'` → un user peut brute avec `%` wildcards pour hammer l'index
- **S3 :** `/api/video-stream` proxy sans cap sur output size → bandwidth DoS
- **S4 :** Gelbooru API key + Rule34 API key **hardcodées dans git history** (supply-chain.md C1/C2) → à rotate. ⚠️ **IMPORTANT** : le Rule34 key a déjà été rotée une fois le 2026-04-03 mais **la nouvelle clé a été re-committée dans git immediately après**, donc elle est ELLE AUSSI burned (présente dans l'historique public). Il faut soit : (a) rotation #2 + `git filter-repo` pour purger toutes les references dans l'historique, soit (b) considérer les deux clés comme publiques à vie et rate-limit + monitorer l'abus.

### UX

- **U1 :** Logged-in "Remove favorite" re-adds the item (race localStorage vs server)
- **U2 :** Bottom-nav "Search" icon → `/explore` au lieu d'un search input (aucune façon de search sur mobile sans le drawer)
- **U3 :** Space key on watch page steal l'activation de tous les boutons (a11y)

### Performance

- **P1 :** Watch page fait 3-5 appels Danbooru live par render (throttled 200ms) → 600ms-1.5s cold TTFB
- **P2 :** OFFSET pagination sur 351K rows avec random offsets dans `/api/feed` → zéro cache hit, load PG lourde

### Database

- **D1 :** `upsertVideos` DO UPDATE ne met PAS à jour `page_url`, `site`, `title` → data stale
- **D2 :** Pas d'index couvrant sur `videos(score DESC, created_at DESC) WHERE banned`
- **D3 :** `score` peut être négatif, pas de overflow guard

### Data bug trouvé via Playwright E2E

- **E1 :** **19 640 rows** dans `videos` ont `thumbnail` pointant vers `gelbooru.com/thumbnails/` (bare domain, 404) au lieu de `img3.gelbooru.com/thumbnails/` (subdomain, 200). Visible sur /explore (~11% images broken) et /character (~8%). Fix : `UPDATE videos SET thumbnail = REPLACE(thumbnail, 'https://gelbooru.com/', 'https://img3.gelbooru.com/') WHERE thumbnail LIKE 'https://gelbooru.com/thumbnails/%';`

---

## ✅ Ce qui a été validé en prod via Playwright E2E

- ✅ **Homepage** loads HTTP 200, 0 console errors, 53 images 0 broken, topbar overlap fix en place, hamburger mobile visible, tag stories circles présents
- ✅ **Watch page sound** — clic Unmute démute vraiment (muted=false, btn → "Mute"), video continue de jouer. Fix des 3 bugs en cascade confirmé en prod.
- ✅ **Shorts scroll infinite** — 60 → 954 vidéos chargées en 20 rounds de scroll, aucun blocage. Phase 1 fix confirmé.
- ✅ **Email verification guard** — click "Get Pro" sur /pricing → POST checkout → 403 `email_not_verified` → UI message clair "Please verify your email address before upgrading to Pro." End-to-end validé.
- ✅ **Mobile viewport 375×812** sur homepage — aucun overflow horizontal, hamburger visible, sidebar hidden, bottom nav + mobile-stats bar visibles
- ✅ **10 pages smoke test** (trending, new, series, tags, blog, glossary, leaderboard, favorites, history, settings) — toutes HTTP 200 avec H1

---

## 🎯 Ordre d'exécution recommandé

### Phase A — BLOCKERS légaux + money (1-2 jours)

1. Fix banned content filter (extend to characters/copyrights/title/slug) — **#1**
2. Route toutes les browse pages via `getVideos()` — **#2** (bonus : applique le filter)
3. Fix `getRelatedPosts` → PG query on shared tags — **#3**
4. Fix Waifu Scholar coupon + `allow_promotion_codes` — **#4**
5. Guard lifetime status dans webhook UPDATE — **#5**
6. Fix `priceId.includes("year")` dead code — **#9**
7. Webhook retourne 500 sur erreurs non-gérées — **#10**

### Phase B — UX blockers (1 jour)

8. Shorts feed cabler toggleFavorite + addToHistory — **#6**
9. `/profile?upgraded=1` affichage du statut Pro — **#7**
10. Discord OAuth : rejeter link si email non vérifié — **#8**
11. Bottom-nav Search → `/search` dédié OU focus topbar
12. Favorite remove race fix
13. Space key skip buttons in useVideoShortcuts

### Phase C — Data hygiene (30 min)

14. SQL UPDATE one-shot pour les 19640 thumbnails bare domain
15. Rotate Gelbooru + Rule34 API keys (leaked in git history)
16. Cleanup cron pour `email_verification_tokens` + `password_reset_tokens` expired

### Phase D — Performance (2-3 jours)

17. Watch page kill les appels Danbooru live → tout via PG
18. Keyset cursor pagination pour `/api/feed`
19. `unoptimized` Image audit + sizes attribute
20. Sparkles background → static or CSS-only

### Phase E — Hardening + code quality (1 semaine)

21. CSP : retirer `'unsafe-inline'` + `'unsafe-eval'` (gros refactor)
22. Tests sur le Stripe webhook handler (zéro test actuel, indéfendable avant launch)
23. Rate limiter bounded globale (factoriser les 9 duplications)
24. Split `WatchPlayer.tsx` 1715 lignes en sous-composants
25. Split `globals.css` 9463 lignes
26. Fix les 17 `.catch(() => {})` silent swallows
27. Enlever `src/data/*.json` (121 MB dead weight)
28. Update session_recap + add README.md for Sab

---

## 📁 Tous les rapports

Chaque fichier est lisible indépendamment :

- `.audit/conversion.md` — funnel payant Stripe, 22 findings
- `.audit/security.md` — OWASP + banned content, 14+ findings
- `.audit/ux.md` — UX bugs critiques, 24 findings
- `.audit/database.md` — schema + indexes + intégrité, 25 findings
- `.audit/performance.md` — charge + latence + build, 9 findings détaillés
- `.audit/supply-chain.md` — deps + secrets leaked, 14 findings
- `.audit/code-review.md` — architecture + dette technique, 24 findings

**Total unique findings :** ~130 issues identifiées (avec ~30 qui apparaissent dans 2-3 reports différents, confirmant leur importance).
