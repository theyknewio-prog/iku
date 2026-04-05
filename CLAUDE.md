# iku.gg — Free Animated Hentai Streaming Platform

## Vision
Devenir **le plus gros site de hentai animé au monde**. Cible prioritaire : marché anglophone (EN), puis expansion mondiale. Phase actuelle : finir le produit (UX, SEO, performance, stabilité) avant d'attaquer la monétisation (ads, premium, affiliés).

## Projet
Site de streaming d'hentai animé agrégant du contenu depuis plusieurs sources (Danbooru, Gelbooru, Rule34.xxx, Rule34Video, sites WordPress). Next.js 16 / React 19, déployé sur un VPS Hetzner CX33 (8GB RAM, 80GB disque) via Coolify + Docker. Domaine : **iku.gg** (DNS Cloudflare → Hetzner, SSL Cloudflare + Let's Encrypt).

**353K+ vidéos** au total, mises à jour quotidiennement via un cron GitHub Actions.

## Propriétaire
Sab — débutant en code. Toujours expliquer les changements de manière pédagogique : ce qu'on fait, pourquoi, et comment ça marche. Poser des questions de contexte avant de se lancer.

---

## Stack technique
- **Framework** : Next.js 16.2.2 (App Router, Server Components, React 19)
- **Styling** : CSS vanilla via `globals.css` (pas de Tailwind, pas de CSS Modules)
- **Fonts** : Inter (body), Poppins (headings), Righteous (logo/branding)
- **Video player** : Custom `<WatchPlayer>` vanilla HTML5 (~1650 lignes), double-tap seek, PiP, theater mode. Pas de HLS.js (malgré ce qu'on croyait) — migration seulement si on héberge nos propres streams multi-bitrate
- **Database** : PostgreSQL 16 (Alpine) — 351K+ vidéos, container Docker `iku-postgres` sur le réseau Coolify
- **Déploiement** : Docker multi-stage (runtime 3GB heap) + PostgreSQL 16 → Coolify → Hetzner CX33
- **CI/CD** : GitHub Actions — daily scrape à 4h UTC (5 scrapers + thumbnail enrichment)
- **Output** : `standalone` (image Docker optimisée)

---

## Architecture des données

### Base de données PostgreSQL

Toutes les vidéos sont stockées dans une table `videos` dans PostgreSQL (351K+ entrées).

| Source | Vidéos | Score moyen | Slug prefix |
|--------|--------|------------|-------------|
| Danbooru | ~17K | 922 | `{id}-{char}-{copy}` |
| Gelbooru | ~20K | 1,035 | `gel-{id}-{tag}` |
| Rule34.xxx | ~20K | 6,291 | `r34-{id}-{tag}` |
| Rule34Video | ~277K | 497 | `r34v-{id}-{slug}` |
| Sites WordPress | ~18K | 266 | `hmm-`/`htv-`/`aid-`/`wh-`/`hw-`/`hg-` |

**Connexion** : `src/lib/db.ts` (singleton pool via `pg`). Variable d'env `DATABASE_URL`.

### Couche unifiée
Tout passe par `src/lib/content.ts` → `getVideos()` qui requête PostgreSQL avec filtrage des tags bannis au niveau SQL (`NOT (tags && $1::text[])`).

### Type central : `Video` (`src/types/video.ts`)
```ts
interface Video {
  id: number; slug: string; url: string;
  thumbnail: string; preview: string;
  score: number; favorites: number;
  tags: string[]; characters: string[]; copyrights: string[]; artists: string[];
  width: number; height: number; fileSize: number;
  duration: number | null; createdAt: Date;
  source: "danbooru" | "gelbooru" | "rule34" | "rule34video" | "wp";
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
| `/api/resolve-video` | 10/min/IP, 3 concurrent | Résout les URLs vidéo. Fast path : parser HTML direct pour `rule34video.com` (380ms). Fallback : yt-dlp execFile (1,4s) pour les sites WP. Cache L1 mémoire (500 max, TTL 1h) + L2 PostgreSQL `resolved_urls` (persistant, 1h TTL) |
| `/api/video-stream` | 30/min/IP | **CRITIQUE — Streaming proxy pour Rule34Video + sites WP.** Les tokens `v-acctoken` sont IP-bound côté source, donc URLs résolues serveur = 403 dans le navigateur user. Cet endpoint fetch depuis notre serveur (avec IP valide) et stream les bytes avec support des Range requests pour le seek. Sans ça, 78% du catalogue est cassé (voir section "Silent bugs") |
| `/api/resolve` | 20/min/IP | Proxy vers un service externe (`PROXY_URL`). Validation slug par regex |
| `/api/feed` | 30/min/IP | API pour le swipe feed |
| `/api/health` | — | Health check (uptime, mémoire RAM) |

---

## Modération de contenu — TOLÉRANCE ZÉRO

### Contenu interdit (pédopornographique / mineurs)
**Le contenu mettant en scène des mineurs (même fictifs) est STRICTEMENT INTERDIT sur iku.gg.**

3 niveaux de protection en place :

1. **Scrapers** (`scripts/banned-tags.ts`) : les 5 scrapers rejettent tout contenu avec des tags/titres bannis à l'import. Ce contenu n'entre jamais dans les fichiers JSON.
2. **Données** : 1,457 vidéos purgées des fichiers JSON le 2026-04-03 (438 Gelbooru, 1012 Rule34Video, 4 Danbooru, 3 Rule34).
3. **Serveur** (`src/lib/content.ts`) : `filterBannedContent()` filtre toute vidéo avec des tags bannis avant qu'elle n'atteigne une page ou une API. `containsBannedContent()` bloque l'accès direct via `/watch/[slug]` → 404.

### Tags bannis (non contournable, côté serveur)
```
loli, lolicon, lolidom, loli_focus, shota, shotacon, shotadom, shota_focus,
child, children, minor, underage, toddler, toddlercon, infant,
young_girl, young_boy, child_on_child, cub, baby,
oppai_loli, legal_loli, elementary_school, kindergarten, randoseru
```

### Règles pour le développement
- **JAMAIS supprimer ou affaiblir le filtrage** dans `content.ts` ou les scrapers
- **Tout nouveau scraper** doit importer et utiliser `banned-tags.ts`
- **Tout nouveau point d'entrée de contenu** (API, page) doit passer par `getVideos()` ou vérifier avec `containsBannedContent()`
- Le glossaire ne doit PAS contenir d'entrées pour les termes bannis (l'entrée "shota" a été supprimée)

---

## Sécurité (mise à jour 2026-04-03)

### Ce qui est protégé ✅
- **Injection shell** : `execFile()` au lieu de `exec()` pour yt-dlp (pas de shell)
- **API keys** : dans `.env.local` / variables Coolify, plus hardcodées dans le code
- **Clé Rule34 régénérée** le 2026-04-03 (l'ancienne était dans l'historique git)
- **Clé Gelbooru** : pas de régénération possible (fixe par compte), risque faible (lecture seule, contenu public)
- **SSRF** : proxy validé (https only, ports standard, hostname whitelist stricte)
- **CORS** : proxy restreint à `https://iku.gg` (plus de wildcard `*`)
- **Rate limiting** : toutes les 4 routes API protégées avec caches bornés (10K IPs max)
- **IP spoofing** : utilisation de `x-real-ip` (header Traefik) au lieu du spoofable `x-forwarded-for[0]`
- **Headers sécurité** : HSTS, X-Frame-Options DENY, X-Content-Type nosniff, Referrer-Policy, Permissions-Policy
- **CSP** : Content-Security-Policy strict (script-src, img-src, media-src, connect-src whitelistés)
- **XSS blog** : sanitization des `<script>`, event handlers, `javascript:` dans le contenu blog
- **Memory leaks** : tous les caches in-memory bornés + cleanup toutes les 5 min
- **Cloudflare** : CDN + DDoS + WAF gratuit devant le site (configuré le 2026-04-03, nameservers Porkbun → Cloudflare)

### Variables d'environnement requises
```
GELBOORU_API_KEY=...
GELBOORU_USER_ID=...
RULE34_API_KEY=...
RULE34_USER_ID=...
DATABASE_URL=postgresql://iku:PASSWORD@iku-postgres:5432/iku
```
Fichier `.env.example` fourni. En prod, configurées dans Coolify (env vars application). `DATABASE_URL` est également requis dans les GitHub Actions secrets pour les scrapers.

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

**Les scrapers écrivent désormais directement dans PostgreSQL** via `scripts/db.ts` (fonction `upsertVideos`). La variable `DATABASE_URL` est requise dans les GitHub Actions secrets pour que le cron puisse écrire en base.

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

# Build
npm run build

# Base de données (démarrer PostgreSQL)
docker-compose up -d postgres

# Migration initiale (une seule fois)
DATABASE_URL=postgresql://iku:PASSWORD@localhost:5432/iku npx tsx scripts/migrate-json-to-pg.ts

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
- **DNS** : Porkbun (registrar) → Cloudflare (nameservers `kallie.ns.cloudflare.com` + `robert.ns.cloudflare.com`) → Hetzner
- **CDN/DDoS/WAF** : Cloudflare Free (configuré le 2026-04-03)
- **SSL** : Let's Encrypt (auto-renew via Coolify)
- **CI** : GitHub Actions (daily scrape + auto-deploy via webhook Coolify)
- **Monitoring** : `/api/health` endpoint (uptime, RAM)
- **Docker** : Multi-stage build (runtime=3GB heap, standalone output)
- **PostgreSQL** : Container `iku-postgres` sur réseau Coolify, volume `iku_pgdata`, port 5432
- **docker-compose.yml** : Définit les services postgres + app

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
│   ├── content.ts          # Couche unifiée — requêtes PostgreSQL
│   ├── db.ts               # Pool de connexions PostgreSQL (singleton)
│   ├── danbooru.ts         # API Danbooru
│   ├── gelbooru.ts         # API Gelbooru (API key via env var)
│   ├── rule34-search.ts    # API Rule34.xxx (API key via env var)
│   ├── rule34.ts           # API Rule34 single post (API key via env var)
│   ├── rule34video.ts      # Requêtes PostgreSQL (was JSON statique)
│   ├── wp-hentai.ts        # Requêtes PostgreSQL (was JSON statique)
│   ├── slugify.ts          # Génération et parsing de slugs
│   ├── seo.ts              # Metadata builders
│   └── content-generator.ts # Descriptions, FAQ, breadcrumbs auto-générés
├── data/                   # Données statiques (JSONs vidéos supprimés — données en PostgreSQL)
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
├── banned-tags.ts          # Tags/mots bannis partagés par TOUS les scrapers (CRITIQUE)
├── db.ts                   # Helpers PostgreSQL pour les scrapers (upsertVideos)
├── init-db.sql             # Schéma initial de la base de données (table videos, index)
├── migrate-json-to-pg.ts   # Script de migration one-shot JSON → PostgreSQL
├── scrape-danbooru.ts      # Scraper Danbooru (filtre banned-tags, écrit en PG)
├── scrape-gelbooru.ts      # Scraper Gelbooru (filtre banned-tags, écrit en PG)
├── scrape-rule34.ts        # Scraper Rule34 (filtre banned-tags, écrit en PG)
├── scrape-rule34video.ts   # Scraper Rule34Video (filtre banned-tags par titre, écrit en PG)
├── scrape-wp-sites.ts      # Scraper sites WordPress (filtre banned-tags par titre, écrit en PG)
├── enrich-wp-thumbnails.ts # Enrichissement thumbnails WP
└── publish-scheduled.ts    # Publication articles programmés
```

---

## Skills disponibles (`.claude/skills/`)

**46 skills installées** (12 custom iku + 7 base + 27 ajoutées le 2026-04-04). **Consulte le skill pertinent AVANT de coder.** Tracking via `skills-lock.json`.

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

### Skills communautaires de base (7)
| Skill | Source | Usage |
|-------|--------|-------|
| `next-best-practices` | vercel-labs/next-skills | Conventions Next.js 16, App Router, RSC |
| `systematic-debugging` | obra/superpowers | Méthodologie de debug structurée |
| `verification-before-completion` | obra/superpowers | Vérification avant de déclarer terminé |
| `programmatic-seo` | coreyhaines31/marketingskills | SEO programmatique pour 353K pages |
| `harden` | pbakaus/impeccable | Hardening sécurité |
| `optimize` | pbakaus/impeccable | Optimisation performance |
| `ui-ux-pro-max` | nextlevelbuilder | UI/UX intelligence multi-stack |

### Skills ajoutées le 2026-04-04 (27)

Parcours exhaustif des 2315 skills sur 106 pages de claudemarketplaces.com, filtrage par pertinence iku.gg, installation des plus valuables depuis des sources réputées.

**🔒 Security — `ghostsecurity/skills` (7)** — Scanners Ghost Security pour secrets, code SAST, deps vulnérables
- `ghost-scan-secrets` — détecte API keys / tokens / creds leaked
- `ghost-scan-code` — SAST (SQL inj, XSS, SSRF, etc.)
- `ghost-scan-deps` — audit deps vulnérables
- `ghost-validate` — patterns de vulnérabilités connus
- `ghost-report` / `ghost-proxy` / `ghost-repo-context` — orchestration

**🎯 Web Quality — `addyosmani/web-quality-skills` (6)** — Addy Osmani (Chrome DevRel)
- `core-web-vitals` — LCP / FID / CLS
- `performance` / `accessibility` / `seo` / `web-quality-audit` / `best-practices`

**🗄️ PostgreSQL (5)**
- `postgres-pro` *(jeffallan)* — refs complets : JSONB, replication, maintenance, performance, extensions
- `database-optimizer` *(jeffallan)* — index strategies, query optimization, PG/MySQL tuning
- `postgres-patterns` *(affaan-m/everything-claude-code)*
- `postgresql-optimization` *(github/awesome-copilot)* — Microsoft
- `postgresql-table-design` *(wshobson/agents)*

**📐 SQL (2)**
- `sql-optimization` *(github/awesome-copilot)*
- `sql-optimization-patterns` *(wshobson/agents)*

**⚛️ Next.js / React (4)**
- `next-cache-components` *(vercel-labs/next-skills)* — **nouveau pattern Next.js 16**
- `next-upgrade` *(vercel-labs/next-skills)*
- `nextjs-app-router-patterns` *(wshobson/agents)*
- `verify` *(facebook/react)* — officiel React team

**🛡️ Security review (2)**
- `security-reviewer` *(jeffallan)* — SAST, pentest, secret-scanning, vulnerability-patterns
- `security-review` *(affaan-m)* — cloud-infrastructure-security

**⚖️ Legal (1)**
- `gdpr-data-handling` *(wshobson/agents)*

---

## Accès serveur

- **SSH** : `ssh root@204.168.233.29` (clé ed25519 configurée via Coolify)
- **Coolify UI** : `http://204.168.233.29:8000`
- **Container app** : `hjta50cv9nfem56atjtwmlx1-*` (nom dynamique, chercher avec `docker ps`)
- **Container IP interne** : `10.0.1.x` (réseau Docker Coolify)
- **Container PostgreSQL** : `iku-postgres` (réseau Coolify, volume `iku_pgdata`)
- **yt-dlp en prod** : installé et fonctionnel (`/usr/local/bin/yt-dlp`, v2026.03.17)

---

## Performance — Architecture multi-tier (mise à jour 2026-04-04)

### 1. ISR (Incremental Static Regeneration)

| Pages | Revalidation | Dynamic? | Notes |
|-------|-------------|----------|-------|
| `/trending`, `/new` | 30 min | `force-dynamic` | PG pas dispo au build Docker |
| `/`, `/explore`, `/tag/*`, `/character/*`, `/series/*` | 1h | `force-dynamic` | idem |
| `/watch/[slug]` | 24h | `generateStaticParams = []` | Static + ISR ← **fix 2026-04-04** |
| `/tags`, `/character`, `/series`, `/blog`, `/glossary` | 24h | Static | Contenu stable |

**Piège Next.js 16** : une route `[slug]` SANS `generateStaticParams` est 100% dynamique même avec `revalidate`. Le fix est d'exporter `generateStaticParams = async () => []` + `dynamicParams = true` → ISR caching activé. Sans ça : chaque hit = full render + PG query.

### 2. Cache L1/L2 des URLs vidéo résolues

```
/api/resolve-video & /api/video-stream
  → L1 cache (Map mémoire, 500 entries, 1h TTL)
  → L2 cache (PostgreSQL resolved_urls, illimité, 1h TTL, survit aux deploys)
  → Fresh resolve (parser HTML direct ou yt-dlp)
```

Table `resolved_urls` (schéma dans `scripts/init-db.sql`) : `page_url PRIMARY KEY, video_url, expires_at`.

### 3. Warmup loop (`src/lib/url-warmup.ts`)

Tourne à l'intérieur du process Next.js (pas via GH Actions, car les tokens Rule34Video sont IP-bound).
- Démarre 30s après le container start + toutes les 30 min
- Résout les top 500 URLs Rule34Video par score
- Upsert dans `resolved_urls` avec TTL 1h
- Résultat : premier visiteur sur toute vidéo trending → 0ms resolve (cache hit L2)

### 4. Application-layer memoize (`src/lib/memo.ts`)

TTL-based deduplication pour les queries PG expensive :
- `getVideos()` → memoize 5 min (absorbe les bursts d'ISR regeneration)
- `getThumbnailForTag()` → memoize 1h (très stable, tag→thumbnail mapping)

### 5. Hover prefetch (`src/lib/prefetch-video.ts`)

`PosterCard` et `ThumbnailCard` déclenchent un fetch background vers `/api/resolve-video` au hover (debounce 200ms, dédup in-flight). Au moment du clic, l'URL est déjà dans le cache L1.

### 6. Cache warmup post-deploy (`warmup.sh`)

Après chaque deploy Coolify, visite les 7 pages principales pour pré-remplir le cache ISR avant qu'un vrai user arrive.

### Benchmarks

| Scénario | Avant | Après |
|----------|-------|-------|
| Resolve Rule34Video (uncached) | 1 400ms (yt-dlp) | **380ms** (parser HTML direct, 3,7×) |
| Resolve cached L1 | 250ms | **156–241ms** |
| Resolve cached L2 | N/A | **~220ms** (PG query indexée) |
| Survive deploys | ❌ cache perdu | ✅ L2 persistant |

---

## Stratégie UX/UI — Data-Driven (recherche 2026-04-04)

### Principes fondamentaux (issus des données Semrush/Similarweb 2025-2026)
- **90% du trafic adult est mobile** (Pornhub 91.3%, xVideos 90.9%) → mobile-first obligatoire
- **Session cible : 8-9 min, 8-9 pages/visite** (xVideos 8:26, 8.89 pages — gold standard)
- **Bounce rate cible : <20%** (xVideos 17.79%)
- **64% trafic direct sur hanime.tv** → brand loyalty = objectif long terme
- **Aucun tube adult n'a de feed TikTok en 2026** → avantage concurrentiel iku.gg

### Architecture UX validée : Hybride 3 modes
1. **Homepage type hanime.tv** — curatée, poster cards anime-style, sections éditorialisées, SEO-first avec cocon sémantique (tags → characters → series)
2. **Watch page type PornHub** — related videos VISIBLES sans scroller (sidebar desktop, stack mobile), autoplay next avec countdown. Driver #1 de pages/session
3. **Feed vertical type TikTok** — swipe plein écran, avance concurrentielle. Parfait pour clips 30s-3min

### Navigation mobile : Bottom tab bar 5 icônes
Home | Search | Shorts (pulse glow quand inactif, gradient quand actif) | Trending | More
→ 100% des top 5 sites adult utilisent ce pattern. Hamburger-only = suicide mobile.
→ "Shorts" au lieu de "Feed" — les users comprennent le format (cf. YouTube Shorts).

### Layout prêt pour monétisation (emplacements intégrés dès le design)

| Page | Emplacements ads prévus |
|------|------------------------|
| Homepage | 1 leaderboard 728x90 + 1 in-content 300x250 |
| `/watch/[slug]` | Pre-roll 15s + underplayer 728x90 + sidebar 300x600 (desktop) |
| `/tag/*`, `/character/*` | 1 in-content 300x250 tous les 8 cards |
| `/feed` | 1 interstitiel tous les 10 swipes |
| `/explore` | 1 leaderboard + in-content |
| `/blog`, `/glossary` | 1-2 in-content |

**Règle** : max 3 ads visibles simultanément + 1 popunder/session. Au-delà = +35% bounce rate.

### Revenue estimé
- 100K pages/mois → ~$300/mois (ExoClick, RPM $3)
- 1M pages/mois → ~$4,000/mois (négocié, RPM $4)
- Levier principal : augmenter trafic US/JP/DE (meilleurs CPM) via SEO anglophone

### Réseau pub recommandé
- **Démarrage** : ExoClick (zéro minimum, 20+ formats, 100% fill rate)
- **À 500K visites/mois** : négocier JuicyAds (CPM supérieur)
- **Pre-roll** : 15s non-skippable pour clips <60s, 30s skippable après 5s pour clips >60s

### Sources des données
- Semrush Top Adult Websites (Feb 2026)
- Statista — Pornhub/xVideos device split
- Pornhub 2025 Year in Review (session times)
- hanime.tv Semrush overview (trafic direct 63.75%)
- Affmaven — Adult ad networks CPM data

### Règle pour Claude Code
**TOUJOURS baser les décisions UX/UI sur des données et études, JAMAIS deviner.** Avant de proposer un layout ou un changement UX, chercher ce que font les top sites du secteur et pourquoi. Citer les sources.

---

## Prochaines étapes (priorité)

### FAIT ✅ (session 2026-04-04 — audit profond + fixes silencieux)

**Bugs silencieux découverts et fixés :**
- **Rule34Video (78% du catalogue) ne jouait pas dans le browser** depuis le lancement. Les `v-acctoken` sont IP-bound : URL résolue serveur = 403 côté user. Jamais remonté parce que homepage tri = score → Rule34.xxx (direct MP4) domine. Fix : `/api/video-stream` proxy qui stream depuis notre serveur.
- **Search autocomplete** dropdown n'apparaissait jamais. Cause : CSP `connect-src` n'autorisait que `cdn.donmai.us`, pas `danbooru.donmai.us` (API host). Fetch silencieusement bloqué.
- **Gelbooru thumbnails** bloqués par CSP. `https://*.gelbooru.com` wildcard ne matche PAS `https://gelbooru.com` bare domain. Fix : ajouter les deux.
- **`/character/hatsune_miku` → 404.** Homepage linkait vers les noms Danbooru (underscore) mais la route `[slug]` n'avait que les CHARACTERS statiques (dash-slug). Fix : `resolveCharacter()` fallback qui synthétise un Character virtuel pour les noms Danbooru inconnus.
- **PosterCard affichait titre+sub en double** (bottom overlay + info below). Fix : suppression de l'overlay dupliqué.
- **Barre de recherche invisible** à cause d'une règle legacy `.v2-topbar__search { display: none }` qui cachait le form. Fix : override scoped avec `display: flex !important`.
- **Fix son du player** : React re-rendait avec `muted={muted}` (state stale) et re-mutait la vidéo après le clic user. Fix : `setMuted(false)` immédiat dans `toggleMute` + `handleUnmuteClick` + slider + swipe + molette.
- **`/watch/[slug]` ISR désactivée** : sans `generateStaticParams`, Next.js 16 traite la route comme 100% dynamique. Chaque hit = full render + PG query. Fix : export `generateStaticParams = async () => []`.
- **277 lignes de contenu banni** dormaient dans PG (legacy pré-filtre). Purgées. Safety net ajouté dans `scripts/db.ts > upsertVideos()` : rejette toute row avec tags/slug/title bannis avant INSERT.
- **`/api/video-stream`** n'avait ni rate limit ni try-catch upstream : bandwidth DoS + crash sur erreurs réseau. Fix : 30/min/IP + try-catch + abort signal 20s.
- **Pages légales** `/terms`, `/privacy`, `/dmca` liées depuis le footer → 404. Créées avec vraies metadata + contenu compliance 18+ + notice 18 U.S.C. § 2257.

**Perf + UI pixel-perfect (mockup anime colorful) :**
- Tout le layout passé en pixel-perfect vs le mockup : sidebar 220px avec emojis partout (🏠🔥🆕⭐⚡🔎❤️🕐⚙️👤📺🏷️), topbar search + stats chip ✨, titres sections avec emojis (🔥 Trending, ⭐ Top Rated, 💖 Characters, 🏷️ Browse, 🆕 New), "⚡ Try Shorts" CTA, "🔥 Hot" badges, "👤" avant noms personnages, Popular Characters emoji fallback (⚔️🌸🧙🐉🏹😈) au lieu d'initiales "HM HR"
- Logo "iku.gg ✨", font stack Nunito + Quicksand
- Parser HTML direct pour Rule34Video (1,4s → 380ms)
- Cache L1 mémoire + L2 PG persistant `resolved_urls`
- Warmup loop inside-process (IP-compatible avec Rule34Video)
- `memoize()` helper pour getVideos (5min) et getThumbnailForTag (1h)
- Prefetch on hover sur les cards

**Audit skills marketplace (2026-04-04) :**
- Parcouru les 2315 skills sur 106 pages de claudemarketplaces.com
- Installé 27 nouvelles skills depuis des sources réputées (ghostsecurity, Addy Osmani, Vercel, Microsoft, React team, wshobson, jeffallan)

### FAIT ✅ (2026-04-03/04)

**Infrastructure & sécurité :**
1. ~~Cloudflare~~ — CDN + DDoS + WAF, nameservers Porkbun → Cloudflare
2. ~~Clé API Rule34 régénérée~~ — nouvelle clé active (Gelbooru : pas de régénération possible)
3. ~~ISR/cache sur 13 pages~~ — réduction massive charge serveur
4. ~~Purge contenu pédopornographique~~ — 1,457 vidéos supprimées + filtrage serveur 3 niveaux + scrapers bloquants
5. ~~Fix CSP~~ — cdn.donmai.us ajouté dans media-src (bloquait TOUTES les vidéos)
6. ~~Fix Coolify~~ — env vars corrompues (DecryptException), source git cassée, deploy via GitHub token HTTPS, webhook GitHub configuré
7. ~~Fix Dockerfile~~ — `HOSTNAME=0.0.0.0` pour que Traefik atteigne le container
8. ~~Cache warmup~~ — script `warmup.sh` qui préchauffe les 7 pages principales après chaque deploy (plus de cold-start pour les visiteurs)

**Player V2 (custom, ~1500 lignes) :**
9. ~~Loop toggle~~ — bouton visible dans les contrôles, rose quand actif
10. ~~Tap-to-unmute~~ — badge top-right, auto-fade 3s, re-trigger play() pour browser policy
11. ~~Autoplay next~~ — overlay end-of-video avec grille related, countdown 5s, cancel/replay
12. ~~Volume gesture mobile~~ — swipe vertical côté gauche = volume
13. ~~Scroll wheel volume desktop~~ — molette = volume ±5%
14. ~~Volume slider vertical popup~~ — tap icône volume = popup avec slider + pourcentage
15. ~~Heart burst double-tap~~ — centre du player = explosion de coeurs au point du tap (TikTok style)
16. ~~Progress bar toujours visible~~ — jamais cachée (adulte = users scrubent 3-5x plus), 3px → 6px au touch
17. ~~Bouton Share~~ — navigator.share() sur mobile, clipboard sur desktop, toast "Link copied!"

**Homepage redesign :**
18. ~~Hero fusionné~~ — merged dual hero en single featured-video full-bleed (Netflix/hanime style)
19. ~~Popular Series carousel~~ — avec thumbnails réelles des vidéos les plus populaires
20. ~~Popular Characters~~ — avec thumbnails réelles (getThumbnailForTag() depuis données locales, zero API calls)
21. ~~Liens characters fixés~~ — /tag/ → /character/ pour SEO cocon sémantique
22. ~~Rich SEO footer~~ — 4 colonnes (Browse, Characters, Series, About) = maillage interne massif
23. ~~Ad zones placeholder~~ — leaderboard + medium-rect, invisibles, prêtes pour ExoClick
24. ~~Tagline gradient~~ — "353,000+ free animated hentai clips" en dégradé rose→violet→cyan, plus gros
25. ~~Favicon custom~~ — "iku" sur fond gradient rose→violet, + apple-touch-icon

**Navigation mobile :**
26. ~~Bottom tab bar 5 icônes~~ — Home, Search, Shorts, Trending, More
27. ~~Rename Feed → Shorts~~ — les users comprennent le format
28. ~~Gradient seulement quand actif~~ — plus de confusion visuelle avec le bouton Shorts
29. ~~Pulse glow subtil~~ — attire les taps vers Shorts quand pas actif

**Feed (Shorts) redesign :**
30. ~~VideoCard TikTok-style~~ — action bar droite (heart, bookmark, share, sound, watch)
31. ~~Heart burst centre~~ — même animation que le WatchPlayer
32. ~~Progress bar seekable~~ — drag/tap pour naviguer, 3px → 5px au touch
33. ~~Artist en @nom~~ — plus de nom brut
34. ~~Suppression taille fichier~~ — personne veut voir "4.2 MB"
35. ~~Fix son desktop~~ — re-trigger play() après unmute pour autoplay policy
36. ~~Fix feed API~~ — champs incompatibles SwipeFeed/HomeFeed, retourne les deux formats

**Watch page :**
37. ~~Related videos passées au player~~ — pour autoplay-next
38. ~~Character links fixés~~ — /tag/ → /character/
39. ~~Ad zone underplayer~~ — placeholder prêt pour ExoClick

**Migration PostgreSQL (2026-04-04) :**
40. ~~Migration PostgreSQL~~ — 351K vidéos migrées, RAM -83%, build simplifié, scrapers écrivent en PG

### Court terme
- Intégrer ExoClick pour la monétisation
- Google Search Console — sitemaps soumis, en attente d'indexation

### Moyen terme (scale à 200K daily users)
- CDN pour les vidéos (Bunny CDN ou Cloudflare Stream)
- Upgrade serveur CX33 → CPX21 (8 vCPU, 16GB RAM) si besoin

---

## Silent bugs / Pièges connus (à retenir)

Bugs qui ne produisent PAS d'erreur visible et qui restent silencieux jusqu'à un test manuel exhaustif. Si tu modifies quoi que ce soit qui touche ces zones, vérifie que tu ne les ré-introduis pas.

### Rule34Video + sites WP = tokens IP-bound
- Les URLs MP4 retournées par leur server contiennent un `v-acctoken` lié à l'IP du fetcher.
- URL résolue côté serveur = **403 quand le browser du user tente avec une autre IP**.
- C'est pour ça que `/api/video-stream` existe : il fetch depuis notre serveur (IP valide) et stream les bytes au browser.
- **Ne JAMAIS** envoyer une URL `rule34video.com/get_file/...` directement au browser. Toujours via `/api/video-stream?url=<page_url>`.
- 78% du catalogue était cassé silencieusement avant ce fix (découvert 2026-04-04).

### CSP wildcards ne couvrent pas les bare domains
- `https://*.gelbooru.com` matche `media.gelbooru.com` mais PAS `gelbooru.com`.
- Si tu ajoutes un nouveau domaine tiers à CSP, ajoute LES DEUX : `https://domain.com https://*.domain.com`.
- Symptôme : images/API calls silencieusement bloqués, aucune erreur console sauf une ligne CSP discrète.

### Next.js 16 : routes `[slug]` sans `generateStaticParams` = 100% dynamic
- Un `export const revalidate = N` SEUL ne suffit pas pour ISR sur une route dynamique.
- Il faut AUSSI `export async function generateStaticParams() { return []; }` pour dire à Next.js "pre-render zéro, mais cache on-demand".
- Sans ça : `ƒ` (dynamic) dans le build output, aucun cache ISR, chaque hit refait tout.

### React controlled props + mutation impérative = race
- `<video muted={muted}>` est contrôlé par React. Faire `v.muted = false` sur le DOM est annulé au prochain render qui réapplique `muted={true}`.
- Toujours faire `setMuted(false)` EN MÊME TEMPS que `v.muted = false`.
- Pattern à surveiller partout où du code touche directement les props contrôlées du `<video>`.

### Legacy CSS `display: none` oublié
- Une règle `.v2-topbar__search { display: none }` trainait dans `globals.css`, léguée d'un ancien redesign. Elle cachait la search bar depuis des mois.
- Si un élément "devrait exister" mais n'apparaît pas, grep `globals.css` pour `display: none` sur la classe.

### Banned content peut slipper via legacy rows
- Les filtres scrapers bloquent à l'ingestion. Mais les rows insérées AVANT l'ajout du filtre restent dans la DB.
- Safety net ajouté dans `upsertVideos()` qui re-vérifie à chaque INSERT/UPDATE, mais le vrai nettoyage se fait avec une query `DELETE FROM videos WHERE tags && ARRAY[...]::text[] OR slug ~* '...'`.
- Vérifier périodiquement avec : `SELECT COUNT(*) FROM videos WHERE tags && ARRAY['loli','shota','lolicon',...]`

### Rate limits (Map check-then-increment) NE sont PAS racy
- Les 4 rate limiters API utilisent `const rl = cache.get(ip); if (rl.count >= MAX) return 429; rl.count++`.
- **C'est atomique en Node.js** car il n'y a pas d'`await` entre le check et l'increment. Mono-thread.
- N'essaie pas de "fixer" cette race — elle n'existe pas. (Faux positif remonté par un audit agent.)

### `/watch/sitemap.xml` retourne 404 (c'est normal)
- Les 8 chunks sont à `/watch/sitemap/0.xml` à `/watch/sitemap/7.xml` (45k URLs chacun, 36k pour le dernier).
- `robots.txt` les référence individuellement. Google trouve tout via robots.
- Le path parent `/watch/sitemap.xml` (sans chunk id) n'est pas une route valide, c'est attendu. N'essaie pas de le "fixer".

### IP detection via headers
- Utilise `x-real-ip` (set par Traefik, non-spoofable) en priorité, fallback `x-forwarded-for.pop()` (dernier IP = le plus proche du reverse proxy, non-spoofable aussi).
- `x-forwarded-for[0]` (premier IP) est user-controllable → spoofable. **Ne pas utiliser**.

---

## Telegram bot (pour recaps de session)

- **Bot** : `@Addictives_bot` (créé 2026-04-04)
- **Chat ID** : `5617056258` (Sab)
- **Token** : dans un secret, JAMAIS committé ni loggé. Demander au user ou lire via `BOT_TOKEN` env.
- **Usage** : envoyer un recap de fin de session quand le user quitte le PC. Format : headline + sections avec emojis + état final (deploy, next steps).
- **Envoi** via curl POST JSON (Windows bash + curl a des soucis d'encoding UTF-8 sur les emojis en ligne de commande — passer par un fichier JSON généré avec Node ou Python pour éviter les problèmes d'encoding).

---

## Notes pour Claude Code

- **JAMAIS affaiblir le filtrage de contenu banni** — `content.ts` et `scripts/banned-tags.ts` et `scripts/db.ts > upsertVideos` sont critiques. Tolérance zéro.
- **Toujours tester avec `npm run build`** avant de push
- **Les clés API sont dans `.env.local` et Coolify** — NE PLUS les hardcoder dans le code
- **DATABASE_URL** est requis — en dev dans `.env.local`, en prod dans Coolify, dans GitHub Actions secrets
- **Le container PostgreSQL** `iku-postgres` doit tourner pour que le site fonctionne. Schéma dans `scripts/init-db.sql`
- **Les pages PG-dépendantes** ont `dynamic = 'force-dynamic'` pour éviter le pré-rendu vide au build
- **Le CSS est monolithique** dans `globals.css` — chercher par préfixe de classe (`v2-`, `wp-`, `player-`, etc.)
- **Pour ajouter une nouvelle source de vidéos** : consulter le skill `iku-scraping-pipeline` pour le guide pas-à-pas
- **Next.js 16 a des breaking changes** par rapport aux versions précédentes — lire les docs dans `node_modules/next/dist/docs/` avant de modifier le routing ou les APIs
- **Consulter le skill approprié** avant toute modification importante — chaque skill contient les conventions, contraintes et patterns spécifiques à son domaine
- **Toute nouvelle route API doit avoir un rate limit** — voir les patterns dans les routes existantes
- **Le Dockerfile est multi-stage** — le runtime n'a que 3GB de heap
- **Le player custom fait ~1650 lignes** (`WatchPlayer.tsx`) — pas de librairie externe (Video.js, Plyr, HLS.js), vanilla HTML5 `<video>` + React state. Bon choix tant qu'on agrège du contenu externe (MP4 direct). Migration vers HLS.js/Video.js seulement si on héberge nos propres streams multi-bitrate
- **Deploy Coolify** se fait via `docker exec coolify php artisan tinker` avec `queue_application_deployment()` — le webhook GitHub ne déclenche pas toujours le deploy automatiquement. Pattern à utiliser :
  ```bash
  ssh root@204.168.233.29 'docker exec -i coolify php artisan tinker << EOF
  $app = \App\Models\Application::where("uuid", "hjta50cv9nfem56atjtwmlx1")->first();
  $uuid = (new \Visus\Cuid2\Cuid2)->toString();
  queue_application_deployment(application: $app, deployment_uuid: $uuid, force_rebuild: false, is_webhook: false);
  EOF'
  ```
- **Repo GitHub est PRIVÉ** — Coolify clone via token HTTPS (pas SSH). Le token est dans la config Coolify DB
- **Cache warmup** — deux niveaux : (1) `warmup.sh` post-deploy visite les 7 pages ISR, (2) `src/lib/url-warmup.ts` tourne dans le process Next.js pour résoudre les URLs vidéo toutes les 30 min
- **Vidéos Rule34Video + WP** → toujours passer par `/api/video-stream?url=<page_url>`. Les URLs directes ne marchent pas côté browser (tokens IP-bound)
- **`/character/[slug]`** utilise `resolveCharacter()` qui fallback sur un Character virtuel synthétisé pour les noms Danbooru (underscore) non présents dans le fichier `CHARACTERS` statique
- **CSP** (`next.config.ts`) — si tu ajoutes un domaine tiers, toujours ajouter les DEUX variantes : `https://domain.com https://*.domain.com`. Les wildcards ne couvrent pas les bare domains.
- **Rate limiters Map** — le pattern `get→check→increment` est atomique en Node mono-thread, pas besoin de "fixer" les races.
