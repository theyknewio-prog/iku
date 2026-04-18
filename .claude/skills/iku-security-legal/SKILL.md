---
name: iku-security-legal
description: "Expert sécurité et conformité légale pour iku.gg — site adult hentai. Utilise ce skill pour TOUTE question de sécurité : clés API exposées, rate limiting, DMCA, age verification, 2257 compliance, CORS, headers de sécurité, protection anti-scraping, variables d'environnement, secrets, authentication, HTTPS, CSP, cookies. Trigger dès que l'utilisateur mentionne : sécurité, security, clé API, API key, secret, env, .env, DMCA, copyright, legal, légal, age gate, vérification d'âge, rate limit, CORS, headers, CSP, cookie, HTTPS, protection, hack, vulnerability, spam, bot, scraping protection."
---

# iku.gg — Security & Legal Skill

Tu es un expert en sécurité web et conformité légale pour sites adult. Tu travailles sur **iku.gg**, un agrégateur de hentai animé.

## PROBLÈMES CRITIQUES ACTUELS

### 1. Clés API hardcodées dans le code source ⚠️⚠️⚠️

C'est le problème de sécurité n°1. Des clés API sont en clair dans les fichiers TypeScript, commitées dans Git :

**Gelbooru** (`src/lib/gelbooru.ts`) :

```typescript
const API_KEY = "3ed16caf...1a41"; // ⚠️ EN CLAIR
const USER_ID = "1943515"; // ⚠️ EN CLAIR
```

**Rule34.xxx** (`src/lib/rule34-search.ts`) :

```typescript
// Clé API aussi en clair dans le fichier
```

**Fix obligatoire** :

1. Créer un fichier `.env.local` (jamais commité) :
   ```
   GELBOORU_API_KEY=3ed16caf...
   GELBOORU_USER_ID=1943515
   RULE34_API_KEY=...
   ```
2. Ajouter `.env*` au `.gitignore`
3. Utiliser `process.env.GELBOORU_API_KEY` dans le code
4. Ajouter les variables dans Coolify (dashboard → app → environment)
5. Ajouter les variables dans GitHub Secrets pour le workflow CI/CD
6. **RÉVOQUER les clés actuelles** et en générer de nouvelles (les anciennes sont dans l'historique Git)

### 2. Secrets Coolify

Les secrets suivants sont dans GitHub Secrets et/ou Coolify :

- `COOLIFY_TOKEN` — token API Coolify
- `COOLIFY_HOST` — IP/hostname du serveur
- `COOLIFY_APP_ID` — ID de l'application
- `GITHUB_TOKEN` — auto-généré par GitHub Actions

**Vérifier que** : le deploy trigger dans le workflow utilise `http://` (pas `https://`) pour l'API Coolify. Si le serveur est exposé sur Internet, migrer vers HTTPS.

## Headers de sécurité

Ajouter ces headers via `next.config.ts` ou un middleware Next.js :

```typescript
// next.config.ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // CSP à adapter pour les CDNs de vidéos/images
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' cdn.donmai.us *.gelbooru.com api-cdn.rule34.xxx data: blob:",
      "media-src 'self' *.gelbooru.com api-cdn-mp4.rule34.xxx blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js nécessite unsafe-eval en dev
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' *.gelbooru.com api.rule34.xxx danbooru.donmai.us",
    ].join("; "),
  },
];
```

## Rate limiting

### Actuel

| Endpoint             | Limite        | Implémentation |
| -------------------- | ------------- | -------------- |
| `/api/resolve-video` | 10 req/min/IP | Code custom    |
| `/api/proxy`         | Aucune ⚠️     | À ajouter      |
| Pages normales       | Aucune        | Coolify/Nginx  |

### Recommandé

- `/api/proxy` : 60 req/min/IP (les images sont cachées côté client)
- `/api/resolve-video` : 10 req/min/IP (OK tel quel)
- `/api/resolve` : 30 req/min/IP
- Toutes les API routes : 100 req/min/IP max (protection DDoS basique)

**Implémentation** : un middleware Next.js avec un Map<IP, timestamps[]> ou utiliser `@upstash/ratelimit` si Redis dispo.

## Age verification (Age Gate)

**Composant actuel** : `src/components/AgeGate.tsx`

L'age gate est obligatoire pour les sites adult. Il doit :

1. Apparaître au premier accès (avant tout contenu)
2. Demander confirmation que l'utilisateur a 18+ ans
3. Stocker le consentement (cookie/localStorage)
4. Bloquer l'accès si refusé (rediriger vers Google ou page neutre)

**Implémentation** :

- Cookie `age_verified=true` avec expiration 30 jours
- Le cookie doit être `HttpOnly: false` (accessible côté client pour le check)
- `SameSite=Lax`, `Secure=true` en production

## DMCA & Copyright

En tant qu'agrégateur qui linke vers du contenu tiers, iku.gg doit :

1. **Page DMCA** : créer `/dmca` avec un formulaire de signalement
   - Nom du détenteur des droits
   - Description du contenu en infraction
   - URL du contenu sur iku.gg
   - URL du contenu original
   - Déclaration sous serment

2. **Processus de takedown** :
   - Réception du signalement DMCA
   - Retrait du contenu dans les 24-48h
   - Notification au uploadeur (si applicable)
   - Système de counter-notice

3. **Safe Harbor** : en tant qu'agrégateur (pas hébergeur de vidéos), iku.gg bénéficie de protections similaires au safe harbor tant que :
   - Un processus DMCA est en place
   - Les takedowns sont traités rapidement
   - Le contenu illégal est retiré sur signalement

## Protection anti-scraping

Le contenu d'iku.gg (les métadonnées agrégées, la structure de maillage interne) a de la valeur. Pour le protéger :

1. **robots.txt** : déjà en place (`src/app/robots.ts`), mais vérifier qu'il bloque les bots non désirés
2. **Rate limiting** : sur toutes les routes (voir section ci-dessus)
3. **User-Agent check** : bloquer les bots connus (scrapy, wget agressif, etc.)
4. **Ne pas exposer les JSONs** : les fichiers `src/data/*.json` ne doivent jamais être servis en statique

## Variables d'environnement à migrer

| Variable           | Valeur actuelle                 | Où la mettre                            |
| ------------------ | ------------------------------- | --------------------------------------- |
| `GELBOORU_API_KEY` | Hardcodée dans gelbooru.ts      | `.env.local` + Coolify + GitHub Secrets |
| `GELBOORU_USER_ID` | Hardcodée dans gelbooru.ts      | `.env.local` + Coolify + GitHub Secrets |
| `RULE34_API_KEY`   | Hardcodée dans rule34-search.ts | `.env.local` + Coolify + GitHub Secrets |
| `PROXY_URL`        | Possiblement hardcodée          | `.env.local` + Coolify                  |
| `COOLIFY_TOKEN`    | GitHub Secret                   | OK tel quel                             |
| `COOLIFY_HOST`     | GitHub Secret                   | OK tel quel                             |
| `COOLIFY_APP_ID`   | GitHub Secret                   | OK tel quel                             |

## Checklist sécurité avant mise en production

- [ ] Migrer toutes les clés API vers `.env.local`
- [ ] Ajouter `.env*` au `.gitignore`
- [ ] Révoquer et régénérer les clés API compromises
- [ ] Ajouter les security headers
- [ ] Implémenter le rate limiting sur `/api/proxy`
- [ ] Vérifier l'age gate fonctionne correctement
- [ ] Créer la page `/dmca`
- [ ] Vérifier que les JSONs de données ne sont pas exposés publiquement
- [ ] HTTPS partout (vérifier la config Coolify)
- [ ] Audit des dépendances npm (`npm audit`)
