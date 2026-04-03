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
- **Video player** : Custom `<WatchPlayer>` avec HLS.js, double-tap seek, PiP, theater mode
- **Déploiement** : Docker multi-stage (build 6GB heap + runtime 3GB heap) → Coolify → Hetzner CX33
- **CI/CD** : GitHub Actions — daily scrape à 4h UTC (5 scrapers + thumbnail enrichment)
- **Output** : `standalone` (image Docker optimisée)

---

## Architecture des données

### Sources de contenu (4 APIs live + 2 sources statiques)

| Source | Type | Fichier JSON local | Taille | Slug prefix |
|--------|------|-------------------|--------|-------------|
| Danbooru | API live + JSON cache | `src/data/videos.json` | 12MB | `{id}-{char}-{copy}` |
| Gelbooru | API live + JSON cache | `src/data/gelbooru-videos.json` | 9.9MB | `gel-{id}-{tag}` |
| Rule34.xxx | API live + JSON cache | `src/data/rule34-videos.json` | 11MB | `r34-{id}-{tag}` |
| Rule34Video | JSON statique (sitemap scrape) | `src/data/rule34video-videos.json` | 85MB (Git LFS) | `r34v-{id}-{slug}` |
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
| Route | Rate Limit | Description |
|-------|------------|-------------|
| `/api/proxy` | 60/min/IP | Proxy pour CDN Gelbooru (bypass hotlink protection). CORS restreint à `iku.gg`. Validation https + port strict |
| `/api/resolve-video` | 10/min/IP, 3 concurrent | Résout les URLs vidéo via **yt-dlp** (execFile, pas de shell). Cache in-memory borné (500 max, TTL 1h) |
| `/api/resolve` | 20/min/IP | Proxy vers un service externe (`PROXY_URL`). Validation slug par regex |
| `/api/feed` | 30/min/IP | API pour le swipe feed |
| `/api/health` | — | Health check (uptime, mémoire RAM) |

---

## Sécurité (mise à jour 2026-04-03)

### Ce qui est protégé ✅
- **Injection shell** : `execFile()` au lieu de `exec()` pour yt-dlp (pas de shell)
- **API keys** : dans `.env.local` / variables Coolify, plus hardcodées dans le code
- **SSRF** : proxy validé (https only, ports standard, hostname whitelist stricte)
- **CORS** : proxy restreint à `https://iku.gg` (plus de wildcard `*`)
- **Rate limiting** : toutes les 4 routes API protégées avec caches bornés (10K IPs max)
- **IP spoofing** : utilisation de `x-real-ip` (header Traefik) au lieu du spoofable `x-forwarded-for[0]`
- **Headers sécurité** : HSTS, X-Frame-Options DENY, X-Content-Type nosniff, Referrer-Policy, Permissions-Policy
- **CSP** : Content-Security-Policy strict (script-src, img-src, media-src, connect-src whitelistés)
- **XSS blog** : sanitization des `<script>`, event handlers, `javascript:` dans le contenu blog
- **Memory leaks** : tous les caches in-memory bornés + cleanup toutes les 5 min

### Ce qui reste à faire
- **Cloudflare** : mettre le CDN gratuit devant le site (DDoS + WAF + CDN). Changer les nameservers sur Porkbun
- **Régénérer les clés API** : les anciennes clés Gelbooru et Rule34 sont dans l'historique git — les révoquer et en créer de nouvelles

### Variables d'environnement requises
```
GELBOORU_API_KEY=...
GELBOORU_USER_ID=...
RULE34_API_KEY=...
RULE34_USER_ID=...
```
Fichier `.env.example` fourni. En prod, configurées dans Coolify (env vars application).

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

Le cron GitHub Actions (`.github/workflows/daily-scrape.yml`) exécute tous les scrapers + enrichissement thumbnails quotidiennement à 4h UTC. Timeout 45 min. Chaque scraper a `continue-on-error: true` pour la résilience.

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

- **JSON-LD** : VideoObject, FAQPage, BreadcrumbList, WebSite (schema.org) — tous avec escaping `\u003c`
- **Sitemaps** : Sitemap principal (`/sitemap.xml`) + sitemaps paginés par chunks de 45K (dynamique via `robots.ts`) + sitemap tags + sitemap characters + sitemap series
- **robots.ts** : Calcul dynamique du nombre de chunks basé sur le vrai compte de vidéos. Référence tous les sitemaps (watch, tag, character, series). Allow : `/watch/`, `/tag/`, `/character/`, `/series/`, `/blog/`, `/glossary/`. Disallow : `/api/`, `/_next/`, `/feed`, `/favorites`, `/history`, `/settings`
- **Content generator** (`src/lib/content-generator.ts`) : Génère descriptions, FAQ et breadcrumbs automatiques par vidéo
- **Blog SEO** (`src/data/blog.ts`) : Articles éducatifs pour le trafic organique
- **Glossaire** (`src/data/glossary.ts`) : Termes et définitions pour le trafic longue traîne

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

- **VPS** : Hetzner CX33 — 8GB RAM, 4 vCPU, 80GB disque
- **Swap** : 4GB configuré et actif (`/swapfile`)
- **Orchestration** : Coolify v4 (auto-deploy depuis GitHub)
- **DNS** : Porkbun → Coolify (à migrer vers Cloudflare pour DDoS/CDN)
- **SSL** : Let's Encrypt (auto-renew via Coolify)
- **CI** : GitHub Actions (daily scrape + auto-deploy via webhook Coolify)
- **Monitoring** : `/api/health` endpoint (uptime, RAM)
- **Docker** : Multi-stage build (build=6GB heap, runtime=3GB heap, standalone output)
- **Git LFS** : `rule34video-videos.json` (85MB) tracké en LFS

---

## Fichiers clés à connaître

```
src/
├── app/
│   ├── layout.tsx          # Root layout (fonts, metadata, AppShell)
│   ├── page.tsx            # Homepage
│   ├── globals.css         # TOUT le CSS du site
│   ├── sitemap.ts          # Sitemap principal (pages statiques + blog + glossaire)
│   ├── robots.ts           # Directives robots.txt (dynamique, calcule les chunks)
│   ├── watch/
│   │   ├── [slug]/page.tsx # Page vidéo (le plus gros fichier)
│   │   └── sitemap.ts      # Sitemaps paginés pour /watch (45K par chunk)
│   └── api/
│       ├── proxy/route.ts       # Proxy Gelbooru CDN (rate limited, CORS strict)
│       ├── resolve-video/route.ts # yt-dlp video URL resolver (execFile, rate limited)
│       ├── resolve/route.ts     # Proxy externe (rate limited, slug validé)
│       ├── feed/route.ts        # API feed (rate limited)
│       └── health/route.ts      # Health check endpoint
├── components/
│   ├── AppShell.tsx        # Layout global (sidebar + topbar + bottom nav)
│   └── WatchPlayer.tsx     # Player vidéo custom
├── lib/
│   ├── content.ts          # Couche unifiée — POINT D'ENTRÉE pour les vidéos
│   ├── danbooru.ts         # API Danbooru
│   ├── gelbooru.ts         # API Gelbooru (API key via env var)
│   ├── rule34-search.ts    # API Rule34.xxx (API key via env var)
│   ├── rule34.ts           # API Rule34 single post (API key via env var)
│   ├── rule34video.ts      # Données Rule34Video (JSON statique)
│   ├── wp-hentai.ts        # Données WP sites (JSON statique)
│   ├── slugify.ts          # Génération et parsing de slugs
│   ├── seo.ts              # Metadata builders
│   └── content-generator.ts # Descriptions, FAQ, breadcrumbs auto-générés
├── data/                   # JSONs statiques (NE PAS ÉDITER MANUELLEMENT)
│   ├── videos.json         # Danbooru (12MB)
│   ├── gelbooru-videos.json # Gelbooru (9.9MB)
│   ├── rule34-videos.json  # Rule34 (11MB)
│   ├── rule34video-videos.json # Rule34Video (85MB, Git LFS)
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

18 skills installés. **Consulte le skill pertinent AVANT de coder.**

### Skills custom iku.gg (12)
| Skill | Quand l'utiliser |
|-------|-----------------|
| `iku-seo-domination` | SEO, sitemaps, schema.org, JSON-LD, meta tags, cocon sémantique, maillage interne |
| `iku-architecture` | Architecture des données, 5 sources, types, routes, pipeline de données |
| `iku-content-engine` | Blog, glossaire, FAQ auto, content-queue, stratégie de contenu, longue traîne |
| `iku-performance` | Core Web Vitals, RAM, build, cache, lazy loading, optimisation Next.js |
| `iku-ui-design` | Dark theme, palette pink/purple, composants, responsive, glassmorphism, CSS |
| `iku-scraping-pipeline` | Scrapers, slugs/préfixes, yt-dlp, cron GitHub Actions, ajout de source |
| `iku-monetization` | Réseaux pub adult, placements, CPM, revenus, affiliate |
| `iku-security-legal` | API keys, DMCA, age gate, headers sécurité, .env, CSP |
| `iku-devops` | Docker, Coolify, Hetzner, CI/CD, monitoring, swap, scaling |
| `iku-video-streaming` | Player HLS, proxy Gelbooru, yt-dlp, formats vidéo, raccourcis clavier |
| `iku-i18n-global` | Internationalisation, hreflang, expansion mondiale, traduction |
| `iku-analytics-growth` | Google Search Console, analytics, KPIs, crawl budget, A/B testing |

### Skills communautaires (6)
| Skill | Source | Usage |
|-------|--------|-------|
| `next-best-practices` | Vercel Labs | Conventions Next.js 16, App Router, RSC |
| `systematic-debugging` | obra/superpowers | Méthodologie de debug structurée |
| `verification-before-completion` | obra/superpowers | Vérification avant de déclarer terminé |
| `programmatic-seo` | marketingskills | SEO programmatique pour 353K pages |
| `harden` | pbakaus/impeccable | Hardening sécurité |
| `optimize` | pbakaus/impeccable | Optimisation performance |

---

## Accès serveur

- **SSH** : `ssh root@204.168.233.29` (clé ed25519 configurée via Coolify)
- **Coolify UI** : `http://204.168.233.29:8000`
- **Container app** : `hjta50cv9nfem56atjtwmlx1-*` (nom dynamique, chercher avec `docker ps`)
- **Container IP interne** : `10.0.1.x` (réseau Docker Coolify)
- **yt-dlp en prod** : installé et fonctionnel (`/usr/local/bin/yt-dlp`, v2026.03.17)

---

## Prochaines étapes (priorité)

### Immédiat
1. **Mettre Cloudflare** devant le site (gratuit : DDoS + WAF + CDN) — changer DNS Porkbun
2. **Régénérer les clés API** Gelbooru et Rule34 (les anciennes sont dans l'historique git)

### Court terme (performance pour scale)
3. Ajouter ISR/cache sur homepage et `/watch/[slug]` (actuellement SSR live à chaque requête)
4. Ajouter Redis pour cache partagé (ou in-memory LRU plus sophistiqué)
5. Optimiser les images (`unoptimized={true}` à retirer sur les PosterCard)

### Moyen terme (scale à 200K daily users)
6. CDN pour les vidéos (Bunny CDN ou Cloudflare Stream)
7. Upgrade serveur CX33 → CPX21 (8 vCPU, 16GB RAM) si besoin
8. Migrer les JSONs vers PostgreSQL pour réduire la RAM

---

## Notes pour Claude Code

- **Ne jamais éditer les fichiers JSON dans `src/data/`** — ils sont générés par les scrapers
- **Toujours tester avec `npm run build`** avant de push — le build nécessite 6GB de RAM et peut OOM
- **Les clés API sont dans `.env.local` et Coolify** — NE PLUS les hardcoder dans le code
- **Le CSS est monolithique** dans `globals.css` — chercher par préfixe de classe (`v2-`, `wp-`, `player-`, etc.)
- **Pour ajouter une nouvelle source de vidéos** : consulter le skill `iku-scraping-pipeline` pour le guide pas-à-pas
- **Next.js 16 a des breaking changes** par rapport aux versions précédentes — lire les docs dans `node_modules/next/dist/docs/` avant de modifier le routing ou les APIs
- **Consulter le skill approprié** avant toute modification importante — chaque skill contient les conventions, contraintes et patterns spécifiques à son domaine
- **Toute nouvelle route API doit avoir un rate limit** — voir les patterns dans les routes existantes
- **Le Dockerfile est multi-stage** — le runtime n'a que 3GB de heap, pas 6GB
