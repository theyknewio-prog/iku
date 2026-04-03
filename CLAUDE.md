# iku.gg — Free Animated Hentai Streaming Platform

## Vision
Devenir **le plus gros site de hentai animé au monde**. Cible prioritaire : marché anglophone (EN), puis expansion mondiale. Phase actuelle : finir le produit (UX, SEO, performance, stabilité) avant d'attaquer la monétisation (ads, premium, affiliés).

## Projet
Site de streaming d'hentai animé agrégant du contenu depuis plusieurs sources (Danbooru, Gelbooru, Rule34.xxx, Rule34Video, sites WordPress). Next.js 16 / React 19, déployé sur un VPS Hetzner CX33 (8GB RAM, 80GB disque) via Coolify + Docker. Domaine : **iku.gg** (DNS Porkbun, SSL Let's Encrypt).

**353K+ vidéos** au total, mises à jour quotidiennement via un cron GitHub Actions.

## Propriétaire
Sab — débutant en code. Toujours expliquer les changements de manière pédagogique : ce qu'on fait, pourquoi, et comment ça marche. Poser des questions de contexte avant de se lancer.

---

## Stack technique
- **Framework** : Next.js 16.2.2 (App Router, Server Components, React 19)
- **Styling** : CSS vanilla via `globals.css` (pas de Tailwind, pas de CSS Modules)
- **Fonts** : Inter (body), Poppins (headings), Righteous (logo/branding)
- **API externe principale** : `@nekolab/hanime` (package npm)
- **Video player** : Custom `<WatchPlayer>` avec HLS.js, double-tap seek, PiP, theater mode
- **Déploiement** : Docker (node:22-slim + python3 + yt-dlp) → Coolify → Hetzner CX33
- **CI/CD** : GitHub Actions — daily scrape à 4h UTC

---

## Architecture des données

### Sources de contenu (4 APIs live + 2 sources statiques)

| Source | Type | Fichier JSON local | Taille | Slug prefix |
|--------|------|-------------------|--------|-------------|
| Danbooru | API live + JSON cache | `src/data/videos.json` | 12MB | `{id}-{char}-{copy}` |
| Gelbooru | API live + JSON cache | `src/data/gelbooru-videos.json` | 9.9MB | `gel-{id}-{tag}` |
| Rule34.xxx | API live + JSON cache | `src/data/rule34-videos.json` | 11MB | `r34-{id}-{tag}` |
| Rule34Video | JSON statique (sitemap scrape) | `src/data/rule34video-videos.json` | 85MB | `r34v-{id}-{slug}` |
| Sites WordPress | JSON statique (sitemap scrape) | `src/data/wp-hentai-videos.json` | 4.2MB | `hmm-`/`htv-`/`aid-`/`wh-`/`hw-`/`hg-` |
| Content queue | Articles programmés | `src/data/content-queue.json` | 304KB | — |

### Couche unifiée
Tout passe par `src/lib/content.ts` → `getVideos()` qui fusionne les 4 sources, interleave, déduplique et trie.

### Type central : `Video` (`src/types/video.ts`)
```ts
interface Video {
  id: number; slug: string; url: string;
  thumbnail: string; preview: string;
  score: number; favorites: number;
  tags: string[]; characters: string[]; copyrights: string[]; artists: string[];
  width: number; height: number; fileSize: number;
  duration: number | null; createdAt: Date;
  source: "danbooru" | "gelbooru" | "rule34" | "rule34video";
}
```

---

## Routes de l'application

### Pages principales
| Route | Description |
|-------|-------------|
| `/` | Homepage — hero, trending carousel, top rated, new releases, popular characters/tags |
| `/explore` | Browse all videos (grille paginée) |
| `/trending` | Trending videos (tri par score) |
| `/new` | Nouvelles vidéos (tri par date) |
| `/browse` | Alternative browse page |
| `/feed` | Swipe feed (pas d'AppShell) |
| `/watch/[slug]` | Page vidéo avec player, related, FAQ, JSON-LD |
| `/tag/[tag]` | Vidéos filtrées par tag |
| `/tags` | Liste de tous les tags populaires |
| `/character/[slug]` | Page personnage |
| `/character` | Index des personnages |
| `/series/[slug]` | Page série |
| `/series` | Index des séries |
| `/blog` | Articles SEO |
| `/blog/[slug]` | Article individuel |
| `/glossary` | Glossaire des termes hentai |
| `/glossary/[term]` | Terme individuel |
| `/favorites` | Favoris (localStorage côté client) |
| `/history` | Historique de visionnage (localStorage) |
| `/settings` | Paramètres utilisateur (blacklist, etc.) |

### API Routes
| Route | Description |
|-------|-------------|
| `/api/proxy` | Proxy pour CDN Gelbooru (bypass hotlink protection). Hosts autorisés : `video-cdn*.gelbooru.com`, `img*.gelbooru.com` |
| `/api/resolve-video` | Résout les URLs vidéo temporaires via **yt-dlp** pour Rule34Video et sites WP. Rate limit: 10 req/min/IP, max 3 concurrent. Cache in-memory 1h |
| `/api/resolve` | Proxy vers un service externe (`PROXY_URL`) pour résolution de slugs |
| `/api/feed` | API pour le swipe feed |

---

## Scrapers (`scripts/`)

| Script | Source | Commande |
|--------|--------|----------|
| `scrape-danbooru.ts` | Danbooru API | `npx tsx scripts/scrape-danbooru.ts` |
| `scrape-gelbooru.ts` | Gelbooru API | `npx tsx scripts/scrape-gelbooru.ts` |
| `scrape-rule34.ts` | Rule34.xxx API | `npx tsx scripts/scrape-rule34.ts` |
| `scrape-rule34video.ts` | Rule34Video sitemaps | `npx tsx scripts/scrape-rule34video.ts` |
| `scrape-wp-sites.ts` | 6 sites WordPress | `npx tsx scripts/scrape-wp-sites.ts` |
| `enrich-wp-thumbnails.ts` | Scrape thumbnails WP | `npx tsx scripts/enrich-wp-thumbnails.ts` |
| `publish-scheduled.ts` | Publie articles programmés | `npx tsx scripts/publish-scheduled.ts` |

Le cron GitHub Actions (`.github/workflows/`) exécute tous les scrapers quotidiennement à 4h UTC.

---

## Composants principaux (`src/components/`)

| Composant | Rôle |
|-----------|------|
| `AppShell` | Layout global : sidebar desktop (60px icons), topbar, mobile bottom nav + drawer |
| `WatchPlayer` | Player vidéo custom : play/pause, volume, seek, speed (0.5x-2x), PiP, theater mode, fullscreen, double-tap ±10s |
| `PosterCard` | Card vidéo pour carousels (poster style avec overlay) |
| `ThumbnailCard` | Card vidéo pour grilles (format horizontal) |
| `Carousel` | Scroll horizontal avec titre, badge, lien "see all" |
| `SearchAutocomplete` | Barre de recherche avec autocomplétion |
| `AgeGate` | Vérification d'âge (18+) |
| `BlacklistFilter` | Filtre de tags blacklistés |
| `WatchActions` | Boutons favoris/historique sur la page watch |
| `SwipeFeed` | Feed de vidéos en swipe (mobile) |

---

## SEO

- **JSON-LD** : VideoObject, FAQPage, BreadcrumbList, WebSite (schema.org)
- **Sitemaps** : Sitemap principal (`/sitemap.xml`) + sitemaps paginés par chunks de 45K (`/watch/sitemap/0.xml`, `/watch/sitemap/1.xml`, ...) + sitemap tags + sitemap characters + sitemap series
- **robots.ts** : Autorise `/`, `/watch/`, `/tag/`, bloque `/api/`, `/_next/`, `/feed`, `/v/`
- **Content generator** (`src/lib/content-generator.ts`) : Génère descriptions, FAQ et breadcrumbs automatiques par vidéo
- **Blog SEO** (`src/data/blog.ts`) : Articles éducatifs pour le trafic organique
- **Glossaire** (`src/data/glossary.ts`) : Termes et définitions pour le trafic longue traîne

---

## Problèmes connus (CRITIQUES)

### 1. yt-dlp non installé en production
- **Impact** : 296K vidéos (Rule34Video + WP) = écran noir au clic
- **Cause** : Le Dockerfile installe yt-dlp mais il n'est peut-être pas dans le PATH
- **Fix** : Vérifier/corriger le Dockerfile, tester yt-dlp dans le container

### 2. Sitemap trop gros (résolu partiellement)
- Le sitemap watch est déjà splitté en chunks de 45K (voir `src/app/watch/sitemap.ts`)
- Le `robots.ts` ne référence que les sitemaps 0 et 1 — **mettre à jour dynamiquement**

### 3. RAM serrée (8GB)
- JSONs chargés en mémoire (~120MB cumulés)
- yt-dlp (Python) en parallèle peut pic à 6-7GB
- **Pas de swap configuré** sur le serveur
- Solution : ajouter 2-4GB de swap + surveiller

### 4. Thumbnails WP vides
- Les 17.8K vidéos WordPress n'ont pas de thumbnails (`""`)
- Script `enrich-wp-thumbnails.ts` existe mais n'est peut-être pas dans le cron

### 5. Git repo lourd
- `rule34video-videos.json` = 85MB dans le repo Git
- GitHub warn au-delà de 100MB par fichier
- Solution : Git LFS ou générer le JSON au build

### 6. Rate limit API
- `/api/resolve-video` a un rate limit (10/min/IP, 3 concurrent max) ✅ Déjà implémenté

---

## Conventions de code

### Slugs
- **Danbooru** : `{id}-{character}-{copyright}` → ex: `5083150-marie-rose-dead-or-alive`
- **Gelbooru** : `gel-{id}-{firstTag}` → ex: `gel-8742200-animated`
- **Rule34** : `r34-{id}-{firstTag}` → ex: `r34-14029915-animated`
- **Rule34Video** : `r34v-{id}-{slug}` → ex: `r34v-12345-some-title`
- **WP sites** : `{prefix}-{id}-{slug}` avec prefixes : hmm, htv, aid, wh, hw, hg

### Imports
- Utiliser `@/` pour les imports absolus (configuré dans tsconfig)
- Les pages importent depuis `@/lib/content.ts`, PAS directement depuis `danbooru.ts`/`gelbooru.ts`
- Exception : la page watch qui a besoin de fonctions spécifiques par source

### CSS
- Tout le styling est dans `src/app/globals.css`
- Convention BEM-like avec prefix par feature : `v2-` (shell/layout), `wp-` (watch player), `player-` (watch page), etc.
- Variables CSS custom pour thème dark : `--color-bg-*`, `--color-text-*`, `--color-accent-*`, `--radius-*`

### Rate limiting APIs externes
- **Danbooru** : 5 req/sec (200ms entre requêtes), retry sur 429 avec 2s backoff
- **Gelbooru** : 1 req/sec (1000ms), retry sur 429 avec 3s backoff
- **Rule34** : 2 req/sec (500ms)
- Toujours utiliser les fonctions `throttle()` dans chaque module

---

## Commandes

```bash
# Dev
npm run dev

# Build (nécessite 6GB RAM)
NODE_OPTIONS='--max-old-space-size=6144' npm run build

# Scrapers
npx tsx scripts/scrape-danbooru.ts
npx tsx scripts/scrape-gelbooru.ts
npx tsx scripts/scrape-rule34.ts
npx tsx scripts/scrape-rule34video.ts
npx tsx scripts/scrape-wp-sites.ts

# Docker
docker build -t iku .
docker run -p 3000:3000 iku
```

---

## Infra

- **VPS** : Hetzner CX33 — 8GB RAM, 2 vCPU, 80GB disque
- **Orchestration** : Coolify (auto-deploy depuis GitHub)
- **DNS** : Porkbun → Coolify
- **SSL** : Let's Encrypt (auto-renew via Coolify)
- **CI** : GitHub Actions (daily scrape + auto-deploy)
- **Monitoring** : Aucun pour l'instant (penser à ajouter)

---

## Fichiers clés à connaître

```
src/
├── app/
│   ├── layout.tsx          # Root layout (fonts, metadata, AppShell)
│   ├── page.tsx            # Homepage
│   ├── globals.css         # TOUT le CSS du site
│   ├── sitemap.ts          # Sitemap principal (pages statiques + blog + glossaire)
│   ├── robots.ts           # Directives robots.txt
│   ├── watch/
│   │   ├── [slug]/page.tsx # Page vidéo (le plus gros fichier)
│   │   └── sitemap.ts      # Sitemaps paginés pour /watch (45K par chunk)
│   └── api/
│       ├── proxy/route.ts       # Proxy Gelbooru CDN
│       └── resolve-video/route.ts # yt-dlp video URL resolver
├── components/
│   ├── AppShell.tsx        # Layout global (sidebar + topbar + bottom nav)
│   └── WatchPlayer.tsx     # Player vidéo custom
├── lib/
│   ├── content.ts          # Couche unifiée — POINT D'ENTRÉE pour les vidéos
│   ├── danbooru.ts         # API Danbooru
│   ├── gelbooru.ts         # API Gelbooru
│   ├── rule34-search.ts    # API Rule34.xxx
│   ├── rule34video.ts      # Données Rule34Video (JSON statique)
│   ├── wp-hentai.ts        # Données WP sites (JSON statique)
│   ├── slugify.ts          # Génération et parsing de slugs
│   ├── seo.ts              # Metadata builders
│   └── content-generator.ts # Descriptions, FAQ, breadcrumbs auto-générés
├── data/                   # JSONs statiques (NE PAS ÉDITER MANUELLEMENT)
│   ├── videos.json         # Danbooru (12MB)
│   ├── gelbooru-videos.json # Gelbooru (9.9MB)
│   ├── rule34-videos.json  # Rule34 (11MB)
│   ├── rule34video-videos.json # Rule34Video (85MB) ⚠️ TRÈS GROS
│   ├── wp-hentai-videos.json # WordPress sites (4.2MB)
│   ├── blog.ts             # Articles de blog
│   ├── glossary.ts         # Termes du glossaire
│   ├── characters.ts       # Données personnages
│   └── series.ts           # Données séries
├── types/
│   └── video.ts            # Types centraux (Video, SearchOptions, etc.)
└── hooks/
    ├── useVideoShortcuts.ts # Raccourcis clavier player
    ├── useDoubleTap.ts      # Détection double-tap
    └── useLocalStorage.ts   # Hook localStorage
scripts/
├── scrape-danbooru.ts      # Scraper Danbooru
├── scrape-gelbooru.ts      # Scraper Gelbooru
├── scrape-rule34.ts        # Scraper Rule34
├── scrape-rule34video.ts   # Scraper Rule34Video
├── scrape-wp-sites.ts      # Scraper sites WordPress
├── enrich-wp-thumbnails.ts # Enrichissement thumbnails WP
└── publish-scheduled.ts    # Publication articles programmés
```

---

## Skills disponibles (`.claude/skills/`)

12 skills custom sont installés dans ce projet. **Consulte le skill pertinent AVANT de coder** pour connaître le contexte, les contraintes et les conventions spécifiques au domaine.

| Skill | Quand l'utiliser |
|-------|-----------------|
| `iku-seo-domination` | SEO, sitemaps, schema.org, JSON-LD, meta tags, cocon sémantique, maillage interne |
| `iku-architecture` | Architecture des données, 5 sources, types, routes, pipeline de données |
| `iku-content-engine` | Blog, glossaire, FAQ auto, content-queue, stratégie de contenu, longue traîne |
| `iku-performance` | Core Web Vitals, RAM, build, cache, lazy loading, optimisation Next.js |
| `iku-ui-design` | Dark theme, palette pink/purple, composants, responsive, glassmorphism, CSS |
| `iku-scraping-pipeline` | Scrapers, slugs/préfixes, yt-dlp, cron GitHub Actions, ajout de source |
| `iku-monetization` | Réseaux pub adult, placements, CPM, revenus, affiliate |
| `iku-security-legal` | Clés API hardcodées, DMCA, age gate, headers sécurité, .env |
| `iku-devops` | Docker, Coolify, Hetzner, CI/CD, monitoring, swap, scaling |
| `iku-video-streaming` | Player HLS, proxy Gelbooru, yt-dlp, formats vidéo, raccourcis clavier |
| `iku-i18n-global` | Internationalisation, hreflang, expansion mondiale, traduction |
| `iku-analytics-growth` | Google Search Console, analytics, KPIs, crawl budget, A/B testing |

---

## Notes pour Claude Code

- **Ne jamais éditer les fichiers JSON dans `src/data/`** — ils sont générés par les scrapers
- **Toujours tester avec `npm run build`** avant de push — le build nécessite 6GB de RAM et peut OOM
- **Les clés API Gelbooru et Rule34 sont hardcodées** dans les fichiers lib — à migrer vers des env vars (voir skill `iku-security-legal`)
- **Le CSS est monolithique** dans `globals.css` — chercher par préfixe de classe (`v2-`, `wp-`, `player-`, etc.)
- **Pour ajouter une nouvelle source de vidéos** : consulter le skill `iku-scraping-pipeline` pour le guide pas-à-pas
- **Next.js 16 a des breaking changes** par rapport aux versions précédentes — lire les docs dans `node_modules/next/dist/docs/` avant de modifier le routing ou les APIs
- **Consulter le skill approprié** avant toute modification importante — chaque skill contient les conventions, contraintes et patterns spécifiques à son domaine
