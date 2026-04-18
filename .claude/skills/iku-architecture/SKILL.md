---
name: iku-architecture
description: "Architecte technique pour iku.gg — site de streaming hentai animé à 353K+ vidéos. Utilise ce skill pour TOUTE question d'architecture : pipeline de données (5 sources API/JSON), Docker/Dockerfile, déploiement Coolify/Hetzner, gestion mémoire (8GB RAM, JSONs 120MB+ en mémoire), cache, rate limiting, scaling, ajout de nouvelles sources, proxy vidéo, résolution yt-dlp, API routes, sécurité. Trigger dès que l'utilisateur mentionne : architecture, infra, serveur, Docker, RAM, OOM, cache, scaling, API, proxy, deploy, Coolify, Hetzner, source vidéo, scraper, cron, pipeline, base de données, migration, ou tout problème technique structurel."
---

# iku.gg — Architecture Skill

Tu es un architecte logiciel senior qui connaît chaque recoin de l'architecture d'iku.gg. Tu dois toujours considérer les contraintes mémoire (8GB) et la scalabilité quand tu proposes des solutions.

## Vue d'ensemble de l'architecture

```
[5 Sources] → [Scrapers (cron daily)] → [JSON files dans src/data/]
                                              ↓
                                    [Next.js 16 Server]
                                    ↓              ↓
                             [APIs live]    [JSON statiques en RAM]
                             Danbooru        rule34video-videos.json (85MB)
                             Gelbooru        wp-hentai-videos.json (4.2MB)
                             Rule34.xxx      videos.json (12MB)
                                             gelbooru-videos.json (9.9MB)
                                             rule34-videos.json (11MB)
                                              ↓
                                    [content.ts — couche unifiée]
                                    interleave + deduplicate + sort
                                              ↓
                                    [Pages Next.js / App Router]
                                              ↓
                                    [Docker container node:22-slim]
                                    + Python3 + yt-dlp
                                              ↓
                                    [Hetzner CX33 via Coolify]
                                    8GB RAM, 2 vCPU, 80GB disque
```

## Les 5 sources de contenu

| Source          | Type          | Lib                        | Fichier JSON                     | Taille        | Rate limit                   |
| --------------- | ------------- | -------------------------- | -------------------------------- | ------------- | ---------------------------- |
| Danbooru        | API REST live | `src/lib/danbooru.ts`      | `videos.json` (12MB)             | ~30K vidéos   | 5 req/sec, max 2 tags (free) |
| Gelbooru        | API REST live | `src/lib/gelbooru.ts`      | `gelbooru-videos.json` (9.9MB)   | ~25K vidéos   | 1 req/sec                    |
| Rule34.xxx      | API REST live | `src/lib/rule34-search.ts` | `rule34-videos.json` (11MB)      | ~20K vidéos   | 2 req/sec                    |
| Rule34Video     | JSON statique | `src/lib/rule34video.ts`   | `rule34video-videos.json` (85MB) | ~278K vidéos  | N/A (local)                  |
| Sites WordPress | JSON statique | `src/lib/wp-hentai.ts`     | `wp-hentai-videos.json` (4.2MB)  | ~17.8K vidéos | N/A (local)                  |

**Total en RAM** : ~122MB de JSONs chargés au démarrage du serveur Next.js.

### Couche unifiée : `src/lib/content.ts`

`getVideos()` est le point d'entrée unique. Il :

1. Fetch les 4 sources en parallèle via `Promise.allSettled` (graceful degradation)
2. Interleave : Danbooru en primaire, Gelbooru/Rule34/Rule34Video mélangés tous les 3 items
3. Sort par score/date/favcount
4. Déduplique par slug
5. Retourne `PaginatedResult<Video>`

Les pages NE DOIVENT PAS appeler directement `danbooru.ts` ou `gelbooru.ts` sauf la page `/watch/[slug]` qui a besoin de fonctions spécifiques par source.

## Pipeline de scraping

**Cron** : GitHub Actions, quotidien à 4h UTC (`.github/workflows/`)

| Script                    | Source                                    | Commande                                  |
| ------------------------- | ----------------------------------------- | ----------------------------------------- |
| `scrape-danbooru.ts`      | API Danbooru (toutes les pages, 200/page) | `npx tsx scripts/scrape-danbooru.ts`      |
| `scrape-gelbooru.ts`      | API Gelbooru                              | `npx tsx scripts/scrape-gelbooru.ts`      |
| `scrape-rule34.ts`        | API Rule34.xxx                            | `npx tsx scripts/scrape-rule34.ts`        |
| `scrape-rule34video.ts`   | Sitemaps Rule34Video                      | `npx tsx scripts/scrape-rule34video.ts`   |
| `scrape-wp-sites.ts`      | 6 sites WordPress (sitemaps)              | `npx tsx scripts/scrape-wp-sites.ts`      |
| `enrich-wp-thumbnails.ts` | Scrape thumbnails depuis pages WP         | `npx tsx scripts/enrich-wp-thumbnails.ts` |
| `publish-scheduled.ts`    | Publie articles/glossaire programmés      | `npx tsx scripts/publish-scheduled.ts`    |

Le cron commit les JSONs mis à jour et push → Coolify auto-deploy.

## API Routes

| Route                | Rôle                                   | Protection                                       |
| -------------------- | -------------------------------------- | ------------------------------------------------ |
| `/api/proxy`         | Proxy Gelbooru CDN (bypass hotlink)    | Whitelist de hosts                               |
| `/api/resolve-video` | Résout URLs vidéo via yt-dlp           | Rate limit 10/min/IP, max 3 concurrent, cache 1h |
| `/api/resolve`       | Proxy vers service externe (PROXY_URL) | Aucun                                            |
| `/api/feed`          | Feed data pour SwipeFeed               | Aucun                                            |

### Le problème yt-dlp

278K vidéos Rule34Video + 17.8K vidéos WP n'ont PAS d'URL vidéo directe. Au clic play, le client appelle `/api/resolve-video?url=<pageUrl>` qui exécute `yt-dlp -j --no-download` pour extraire l'URL temporaire du stream. Cache in-memory 1h (les URLs expirent en ~2h).

**Risques** : yt-dlp = Python = gourmand en RAM. 3 resolve simultanés peuvent pic à 6-7GB sur un serveur 8GB sans swap.

## Infra & Déploiement

- **VPS** : Hetzner CX33 — 8GB RAM, 2 vCPU AMD, 80GB SSD
- **OS** : Docker container (node:22-slim + python3 + yt-dlp)
- **Orchestration** : Coolify (auto-deploy depuis GitHub main)
- **DNS** : Porkbun → Coolify
- **SSL** : Let's Encrypt (auto-renew Coolify)
- **Swap** : AUCUN configuré (⚠️ risque OOM kill)
- **Monitoring** : Aucun pour l'instant

### Dockerfile

```dockerfile
FROM node:22-slim
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Build = ~9 min, consomme 6GB de RAM (les JSONs sont importés at build time).

## Problèmes connus et solutions

### 1. RAM serrée (CRITIQUE)

- 8GB total, ~3GB utilisé par Next.js + JSONs en mémoire
- yt-dlp en parallèle (Python) → pics à 6-7GB
- **Pas de swap** → OOM kill direct
- **Fix** : ajouter 2-4GB swap sur le VPS + monitorer

### 2. Git repo trop lourd

- `rule34video-videos.json` = 85MB dans git
- GitHub warn au-delà de 100MB
- **Fix** : Git LFS ou générer le JSON au build (télécharger depuis un storage externe)

### 3. Clés API hardcodées

- Gelbooru API key + user ID dans `gelbooru.ts`
- Rule34 API key + user ID dans `rule34-search.ts`
- **Fix** : migrer vers des variables d'environnement

### 4. Thumbnails WP vides

- 17.8K vidéos WordPress ont `thumbnail: ""` et `preview: ""`
- Le script `enrich-wp-thumbnails.ts` existe mais n'est pas dans le cron
- **Fix** : ajouter au cron GitHub Actions

### 5. Cache volatile

- Le cache `/api/resolve-video` est in-memory → perdu au redéploiement
- **Fix futur** : Redis ou SQLite cache

## Pour ajouter une nouvelle source de vidéos

1. Créer `src/lib/nouvelle-source.ts` avec les fonctions `search*()` et `get*Post()`
2. Créer le type de slug avec un prefix unique dans `src/lib/slugify.ts`
3. Ajouter le source type dans `Video.source` (`src/types/video.ts`)
4. Intégrer dans `src/lib/content.ts` → `getVideos()`
5. Ajouter la gestion dans `src/app/watch/[slug]/page.tsx`
6. Créer le scraper `scripts/scrape-nouvelle-source.ts`
7. Ajouter au cron `.github/workflows/`
8. Ajouter au sitemap `src/app/watch/sitemap.ts`
9. Si proxy nécessaire, ajouter le host dans `/api/proxy`
10. Si yt-dlp nécessaire, ajouter le domain dans `/api/resolve-video`

## Conventions

- **Imports** : toujours `@/` pour les chemins absolus
- **Rate limiting** : chaque source a sa fonction `throttle()` — toujours l'utiliser
- **Graceful degradation** : `Promise.allSettled` pour ne pas crash si une source tombe
- **Ne jamais éditer `src/data/*.json`** — auto-générés par les scrapers
- **Next.js 16** a des breaking changes — lire `node_modules/next/dist/docs/` avant de toucher au routing
