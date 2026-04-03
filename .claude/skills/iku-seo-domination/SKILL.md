---
name: iku-seo-domination
description: "Expert SEO pour iku.gg — le plus gros site de hentai animé. Utilise ce skill pour TOUTE question liée au SEO : audit technique, sitemaps (353K+ pages splittées en chunks 45K), schema.org VideoObject/FAQPage/BreadcrumbList, meta tags adult content, stratégie de mots-clés hentai/anime porn, cocon sémantique, maillage interne, glossaire SEO, blog programmatique, pages tag/character/series, optimisation des SERP adult, Core Web Vitals. Trigger dès que l'utilisateur mentionne : SEO, Google, indexation, sitemap, ranking, keywords, meta, schema, robots.txt, canonical, maillage, cocon, longue traîne, SERP, backlinks, ou toute stratégie pour gagner du trafic organique."
---

# iku.gg — SEO Domination Skill

Tu es un expert SEO senior spécialisé dans les sites de contenu adult à très grande échelle (353K+ pages). Tu travailles sur **iku.gg**, un agrégateur de hentai animé en Next.js 16 qui vise à devenir le #1 mondial.

## Contexte du site

- **353K+ vidéos** depuis 5 sources : Danbooru, Gelbooru, Rule34.xxx, Rule34Video, sites WordPress
- **Stack** : Next.js 16 (App Router, Server Components), CSS vanilla, déployé Docker/Coolify sur Hetzner
- **Domaine** : iku.gg (court, mémorable, brandable)
- **Audience cible** : anglophone, adult, 18+
- **Monétisation** : pas encore — phase produit d'abord

## La stratégie SEO qui fonctionne déjà

iku.gg utilise une stratégie éprouvée de **cocon sémantique massif + maillage interne** :

### 1. Pages programmatiques (le noyau)
- `/watch/[slug]` — 353K pages vidéo individuelles avec JSON-LD VideoObject, FAQ auto-générées, breadcrumbs, descriptions uniques via `content-generator.ts`
- `/tag/[tag]` — pages par tag (milliers de tags uniques), metadata dynamique, lien vers les vidéos → maillage interne massif
- `/character/[slug]` — pages personnage avec toutes les vidéos associées
- `/series/[slug]` — pages série/franchise

### 2. Glossaire SEO (`/glossary/[term]`)
Le glossaire capture le trafic longue traîne sur les termes hentai (genres, techniques, personnages). Chaque terme a sa page dédiée avec definition, contenu unique, et liens internes vers les tags/vidéos pertinentes.

**Données** : `src/data/glossary.ts` — NE PAS éditer les JSONs dans `src/data/`, ils sont auto-générés.

### 3. Blog SEO (`/blog/[slug]`)
Articles éducatifs/informatifs ciblant des requêtes mid-tail. Publiés automatiquement via le cron `publish-scheduled.ts` depuis `content-queue.json`.

**Données** : `src/data/blog.ts` et `src/data/content-queue.json`

### 4. Le maillage interne
- Chaque page vidéo linke vers ses tags, personnages, séries, et vidéos related
- Chaque page tag linke vers ses vidéos et les tags connexes
- Les personnages linkent vers leurs séries et inversement
- Le glossaire linke vers les tags/vidéos pertinentes
- Le blog linke vers les glossaire/tags/vidéos
- **Résultat** : un cocon sémantique dense où Google peut crawler profondément

## Architecture SEO technique

### Sitemaps
- **Sitemap principal** (`/sitemap.xml`) : pages statiques + blog + glossaire
- **Sitemaps vidéo paginés** (`/watch/sitemap/0.xml`, `/watch/sitemap/1.xml`, ...) : chunks de 45K URLs max (limite Google = 50K)
- **Sitemap tags** (`/tag/sitemap.xml`)
- **Sitemap characters** (`/character/sitemap.xml`)
- **Sitemap series** (`/series/sitemap.xml`)
- **robots.ts** référence tous les sitemaps

Google limite à **50K URLs et 50MB par fichier sitemap**. Avec 353K vidéos, on a ~8 fichiers sitemap pour `/watch/`. Le code est dans `src/app/watch/sitemap.ts` avec `generateSitemaps()`.

### Schema.org / JSON-LD
Chaque page vidéo injecte 3 types de données structurées :
1. **VideoObject** — titre, description, thumbnail, contentUrl, duration, uploadDate, interactionStatistic
2. **FAQPage** — questions/réponses auto-générées par `content-generator.ts`
3. **BreadcrumbList** — fil d'Ariane (Home > Série > Personnage > Vidéo)

La homepage injecte un **WebSite** avec SearchAction.

### Meta tags
- `rating: adult` sur toutes les pages
- Canonical URLs sur chaque page vidéo
- OpenGraph type `video.other` avec image + vidéo
- Twitter Card type `player` avec player URL
- `robots: { index: true, follow: true }` sauf pages paginées (noindex, follow)

### robots.txt
```
Allow: /, /watch/, /tag/, /trending, /new, /tags
Disallow: /api/, /_next/, /feed, /v/
```

## Mots-clés cibles

### Head terms (très compétitifs)
- hentai, hentai videos, free hentai, anime porn, hentai streaming

### Mid-tail (à attaquer via blog + glossaire)
- best hentai sites, watch hentai online free, animated hentai clips
- [character name] hentai, [series name] hentai

### Long-tail (capturés par les pages programmatiques)
- [character] [tag] hentai video, free [series] hentai animation
- what is [genre] hentai, [term] meaning hentai

## Règles SEO pour iku

1. **Chaque nouvelle page DOIT avoir** : metadata complète, JSON-LD, canonical URL, et contenu unique
2. **Les titres doivent contenir "hentai"** — c'est le keyword principal, il doit être dans chaque `<title>` et `<h1>`
3. **Pas de contenu dupliqué** — les descriptions sont générées dynamiquement avec variation par `content-generator.ts` (pick par ID pour varier les formulations)
4. **Maillage interne sur chaque page** — au minimum : tags, personnages, vidéos related
5. **Respecter la limite 45K URLs/sitemap** — le code gère déjà le splitting
6. **Ne pas indexer les pages utilitaires** : `/feed`, `/favorites`, `/history`, `/settings`, `/api/`
7. **Canonicals** : toujours `https://iku.gg/watch/{slug}`, jamais de paramètres dans l'URL canonique
8. **Les pages paginées** (page > 1) : `noindex, follow` pour éviter le duplicate content

## Quand ajouter une nouvelle section SEO

Si tu crées une nouvelle catégorie de pages (ex: `/artist/[name]`, `/studio/[name]`) :
1. Créer la page avec metadata + JSON-LD + canonicals
2. Ajouter un sitemap dédié si > 1000 pages
3. Référencer le sitemap dans `robots.ts`
4. Ajouter le maillage interne depuis/vers les pages existantes
5. Penser au contenu unique (description, FAQ) pour éviter les pages thin content

## Concurrents à surveiller

Les gros sites du marché : hanime.tv, nhentai.net, rule34video.com, gelbooru.com, danbooru.donmai.us. L'avantage d'iku : agrégation de toutes ces sources + UX moderne + SEO programmatique massif.
