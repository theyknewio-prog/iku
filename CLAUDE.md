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

### Variables d'environnement requises (toutes en prod dans Coolify)
```
# Scraping APIs
GELBOORU_API_KEY=...
GELBOORU_USER_ID=...
RULE34_API_KEY=...
RULE34_USER_ID=...

# Database
DATABASE_URL=postgresql://iku:PASSWORD@iku-postgres:5432/iku

# NextAuth v5
AUTH_SECRET=...                        # 32-byte random, base64
AUTH_URL=https://iku.gg
AUTH_TRUST_HOST=true

# Discord OAuth (iku.gg app)
DISCORD_CLIENT_ID=1490319089694937108
DISCORD_CLIENT_SECRET=...

# Stripe (live keys — sk_live_...)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_1TIsKwE6BjkfAdXjZGpChcFW
STRIPE_PRICE_YEARLY=price_1TIsKwE6BjkfAdXjJnVBTmyC
STRIPE_PRICE_LIFETIME=price_1TIsKxE6BjkfAdXjuF7yu2KT
STRIPE_COUPON_TIER_DISCOUNT=waifu_scholar_30

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=iku.gg <hello@iku.gg>
NEXT_PUBLIC_SITE_URL=https://iku.gg       # build-time (Dockerfile ARG)

# Analytics (PostHog, US Cloud)
NEXT_PUBLIC_POSTHOG_KEY=phc_...            # build-time (Dockerfile ARG)
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # build-time
```

**Variables `NEXT_PUBLIC_*`** : doivent être `is_buildtime=true` dans Coolify ET déclarées comme `ARG` dans le Dockerfile (builder stage). Next.js bake ces valeurs dans le bundle client au moment du `npm run build`.

Fichier `.env.example` fourni. `DATABASE_URL` aussi requis dans les GitHub Actions secrets pour les scrapers + bots Discord. `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID=1490318988369068184` dans les GH secrets pour les bots.

**GitHub Actions secrets** (repo `theyknewio-prog/iku`) :
- `DATABASE_URL`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `COOLIFY_TOKEN`, `COOLIFY_HOST`, `COOLIFY_APP_ID`

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
46 skills installed (12 custom iku + 34 community/added). **Consult the relevant skill BEFORE coding.** See skills-lock.json for full list.

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

### Sessions passées (détails dans memory/project_session_*.md)

- **2026-04-03/04** : Cloudflare, clé API régénérée, ISR 13 pages, purge contenu banni, fix CSP/Coolify/Dockerfile, player V2 (loop, unmute, autoplay-next, gestures), homepage redesign, bottom tab bar, feed Shorts, migration PostgreSQL 351K vidéos
- **2026-04-05 matin** : Stripe Pro live (4.99/39.99/69.99€), gamification complète (score, streaks, quests, badges, leaderboard), Discord 50 channels + emojis + bots, email Resend (verify, reset, welcome), PostHog analytics, auth NextAuth v5 + Discord OAuth
- **2026-04-05 soir** : UX sweep 5 phases (24 feedback items), 20 prog SEO articles, winback email cron, email verification, watch sound fix (3 bugs cascade), deploy.sh workaround
- **2026-04-06** : Deep audit 130+ fixes (37 blockers), GSAP animations, Shorts randomisé, vitest 21 tests, Shorts UX polish (mute persist, progress bar, title/tags cleanup), hero ahegao
- **2026-04-07** : Monétisation complète (ExoClick + Adsterra + CrakRevenue + Nutaku + Chaturbate), ads sur toutes les pages (pre-roll, banners, native, interstitiel, cam widget), SEO cron MAX POWER (41 keywords Semrush, 4 articles/jour, character enrichment, title optimization, Google URL submission), directory submissions (11 annuaires)

### En cours / Next priorities
- Automatiser Reddit + Twitter (bots de promotion)
- Attendre indexation Google (346K pages, sandbox ~2-3 mois)
- Chaturbate YOTI age verification (à faire par Sab)
- Lever le flag GitHub Actions (support ticket)
- ExoClick ads : vérifier fill rate après CSP fix

### Moyen terme (scale à 200K daily users)
- CDN pour les vidéos (Bunny CDN ou Cloudflare Stream)
- Upgrade serveur CX33 → CPX21 (8 vCPU, 16GB RAM) si besoin

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

### React `muted` attribute ne propage PAS (issue #10389) — DÉCOUVERT 2026-04-05
- **Corollaire plus vicieux** du bug ci-dessus. Même si tu fais tout propre côté state (`setMuted(false)` via functional updater, zéro mutation de `v.muted` dans le code), ça ne marche QUAND MÊME pas.
- L'attribut HTML `muted` sur `<video>` mappe sémantiquement à `defaultMuted` en DOM API — il représente l'état INITIAL, pas l'état courant. Quand React voit `muted={false}` après le mount, il fait `element.removeAttribute("muted")` ce qui **ne démute pas** la vidéo (la propriété `.muted` JS garde son ancienne valeur).
- **Fix obligatoire** : un `useEffect([muted])` qui force `v.muted = muted` impérativement à chaque changement de state.
- Appliqué dans `WatchPlayer.tsx` et `VideoCard.tsx` — commit `ed1b3f0`. Ne PAS retirer cet useEffect, il ne fait pas double emploi avec la prop `muted={muted}`.

### Autoplay + `<video onPlay={}>` = state race qui crée un overlay click-eater — DÉCOUVERT 2026-04-05
- Le `WatchPlayer` initialisait `const [playing, setPlaying] = useState(false)`. Quand `<video autoPlay>` commence la lecture AVANT que React attache son listener `onPlay`, l'event est perdu dans la race de mount. React garde `playing = false` pendant que `v.paused === false`.
- Conséquence : le `{!playing && <button className="wp-center-play">}` (grand bouton central) reste rendu avec `position:absolute; inset:0; zIndex:3` → **il couvre TOUTE la control bar** et bouffe tous les clicks (mute, share, fullscreen, speed, loop, etc.).
- **Fix** : initialiser `playing` à `true` (matche l'attribut `autoPlay`) + un `useEffect` qui resync depuis `v.paused` après 250ms pour les cas d'autoplay refusé par le browser. Commit `d72fba3`.
- **Règle générale** : quand un state React doit refléter l'état d'un element `<video>` qui a `autoPlay`, ne JAMAIS l'initialiser à `false`. Toujours init à `true` + effect de rescue.

### UI trap : bouton visible qui ouvre un popup au lieu de l'action attendue — DÉCOUVERT 2026-04-05
- Dans `WatchPlayer.tsx`, le bouton volume avec `aria-label={muted ? "Unmute" : "Mute"}` appelait `setVolumeSliderOpen(o => !o)` au lieu de `toggleMute()`. Le `toggleMute` réel était dans un bouton **imbriqué à l'intérieur du popup slider**, invisible tant que le popup n'était pas ouvert.
- Résultat user : clic sur "Unmute" → popup s'ouvre → user ne voit rien changer → son reste coupé → user pense que le bouton est cassé. Sur mobile aucun hover donc le popup ne s'ouvre jamais → son jamais activable.
- **Fix** : le bouton primaire fait l'action primaire (click = toggleMute direct). Le slider s'ouvre via `onMouseEnter` sur le container parent. Commit `2c52b32`.
- **Règle** : si un bouton a un aria-label qui décrit une action ("Unmute"), son `onClick` doit faire exactement cette action. Pas de misdirection vers un sous-menu.

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

## GitHub account flag
Compte theyknewio-prog FLAGGE. Actions blocked. Deploy via deploy.sh ou Coolify API. Details in memory/project_github_flag_2026_04_05.md.

## Deploy Coolify
Use `deploy.sh` at project root or `ssh root@204.168.233.29` + `docker exec -i coolify php artisan tinker` to queue deploys. Details in memory/reference_coolify_deploy.md.

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

---

## Quickref (gamification + Pro + email + Discord + ads)

### DB tables (toutes en prod PG iku-postgres)
videos (346K+), users, user_oauth_accounts, user_stats, user_badges, user_daily_quests, user_score_events, user_favorites, user_history, email_verification_tokens, password_reset_tokens, email_log, stripe_events, resolved_urls

### Auth
NextAuth v5 + Credentials (email+bcrypt) + Discord OAuth. Pages: /login, /signup, /profile, /forgot-password, /reset-password

### Gamification
Score system (+2 view, +5 complete, +8 fav, +15 quest), 6 tiers (Wanderer→Hentai Sage), 11 badges, daily quests, streaks, leaderboard. Waifu Scholar tier = 30% Pro discount.

### Stripe Pro
Monthly 4.99€, Yearly 39.99€, Lifetime 69.99€. Webhook on /api/stripe/webhook (6 events). Coupon waifu_scholar_30.

### Email (Resend)
Domain iku.gg verified (DKIM+SPF+DMARC). 17 Cloudflare Email Routing aliases → iku.media.gg@gmail.com.

### Discord
Guild 1490318988369068184, invite https://discord.gg/cQZc8trq8N, 50 channels, 26 roles, 50 emojis, 5 stickers.

### Monetisation (2026-04-07)
ExoClick (6 zones: banner728, banner300, preroll, popunder-disabled, native, interstitial) + Adsterra (7 units) + CrakRevenue + Nutaku + Chaturbate. Ads on all pages. Pre-roll every video. CSP: unsafe-inline (no nonce — incompatible with ExoClick).

### SEO Cron (MAX POWER)
scripts/seo-autopilot.mjs v3: 41 Semrush keywords (KD 4-34), 4 articles/day, character enrichment, Semrush CSV mining, Google URL submission, title optimization. Cron: /etc/cron.d/iku-seo (6h+18h UTC).

### PostHog
Project 370092, US Cloud, host us.i.posthog.com, key phc_wFyYxZguyvxUNPbZAYT2hS2RwNy9YhuHdXYif5TLSRCv
