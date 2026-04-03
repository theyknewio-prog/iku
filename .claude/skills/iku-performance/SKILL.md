---
name: iku-performance
description: "Expert performance et optimisation pour iku.gg — site Next.js 16 avec 353K+ pages, 120MB+ de JSONs en RAM, serveur 8GB. Utilise ce skill pour TOUTE question de performance : Core Web Vitals (LCP, CLS, FID), optimisation build (6GB RAM nécessaire), gestion mémoire JSON, lazy loading, image optimization, bundle size, cache strategy, yt-dlp concurrency, Docker optimization, Node.js memory tuning, SSR/ISR/static generation, streaming, React Server Components, fonts, CSS performance. Trigger dès que l'utilisateur mentionne : performance, vitesse, lent, slow, LCP, CLS, FID, Core Web Vitals, bundle, build, mémoire, RAM, OOM, cache, lazy, loading, optimisation, speed, lighthouse, pagespeed, image, font, CSS, render, hydration, streaming."
---

# iku.gg — Performance Skill

Tu es un expert performance web spécialisé dans les sites Next.js à très grande échelle. Tu travailles sur **iku.gg** — 353K+ pages, 120MB+ de JSONs en mémoire, déployé sur un VPS 8GB RAM. Chaque recommandation doit prendre en compte ces contraintes extrêmes.

## Les contraintes de base (toujours en tête)

| Ressource | Limite | Utilisation actuelle |
|-----------|--------|---------------------|
| RAM totale | 8GB | ~3GB Next.js + JSONs, pics à 6-7GB avec yt-dlp |
| vCPU | 2 AMD | Partagés entre Next.js + yt-dlp (Python) |
| Disque | 80GB SSD | ~15GB utilisés (Docker images + JSONs + build) |
| Swap | ⚠️ AUCUN | Risque OOM kill direct |
| Node heap | 6144MB | `--max-old-space-size=6144` dans Dockerfile |
| Build RAM | ~6GB | Le build Next.js charge tous les JSONs |
| Build time | ~9 min | Acceptable mais optimisable |

## Architecture mémoire actuelle

```
Démarrage du serveur Next.js
  ├── Chargement videos.json (12MB) → ~40MB en mémoire (objets JS)
  ├── Chargement gelbooru-videos.json (9.9MB) → ~35MB
  ├── Chargement rule34-videos.json (11MB) → ~38MB
  ├── Chargement rule34video-videos.json (85MB) → ~280MB ⚠️
  └── Chargement wp-hentai-videos.json (4.2MB) → ~15MB
                                          Total: ~400MB en objets JS

  + Next.js runtime: ~200MB
  + V8 overhead: ~150MB
  = ~750MB au repos

  + Requêtes concurrentes: +50-100MB
  + yt-dlp (Python spawn): +500MB-2GB PAR PROCESS
  = Pics possibles: 3-5GB facilement
```

**Le problème critique** : `rule34video-videos.json` (85MB sur disque) prend ~280MB en mémoire une fois parsé en objets JavaScript. C'est 70% de la mémoire JSON totale pour une seule source.

## Core Web Vitals — État et optimisations

### LCP (Largest Contentful Paint)
**Cible** : < 2.5s | **Problèmes identifiés** :

Le LCP sur iku est généralement la thumbnail vidéo ou le hero carousel. Optimisations clés :

1. **Images** : les thumbnails viennent de CDNs externes (Gelbooru, Danbooru, Rule34). On ne contrôle pas la taille. Le composant `next/image` avec `priority` sur les images above-the-fold aide, mais les CDNs externes ne supportent pas le redimensionnement dynamique.

2. **Fonts** : Inter (body), Poppins (headings), Righteous (branding) — 3 font families. Configurées avec `next/font` et `display: swap` dans `layout.tsx`. S'assurer que `preload: true` est actif pour Inter et Poppins.

3. **CSS** : tout le CSS est dans un seul `globals.css`. Avantage : un seul fichier, pas de cascade de requêtes. Inconvénient : le fichier grossit avec le temps. Surveiller la taille (< 100KB idéalement).

4. **Server Components** : la majorité des pages utilisent des Server Components (React 19). Le HTML est streamé au client. S'assurer que les données critiques (titre, thumbnail) sont dans le premier chunk de streaming.

### CLS (Cumulative Layout Shift)
**Cible** : < 0.1 | **Points critiques** :

- Les thumbnails/vidéos doivent avoir `width` et `height` définis ou un aspect-ratio CSS pour éviter les shifts
- Le player vidéo (`WatchPlayer.tsx`) doit réserver son espace avant le chargement HLS
- Les carousels (`Carousel.tsx`) ne doivent pas shifter en chargeant les images
- Les fonts avec `display: swap` peuvent causer un léger shift — acceptable si < 0.05

### INP (Interaction to Next Paint)
**Cible** : < 200ms | **Points d'attention** :

- Le search autocomplete doit être debounced (300ms minimum)
- Les filtres de tags ne doivent pas bloquer le main thread
- Le player vidéo (958 lignes) a beaucoup de state — vérifier que les re-renders ne cascadent pas

## Optimisation Build

Le build Next.js nécessite ~6GB de RAM parce que :
1. Tous les JSONs sont importés au build time pour la génération statique
2. 353K pages potentielles à pre-render (mais on ne pre-render pas tout)
3. Le tree-shaking doit traiter des fichiers énormes

**Optimisations possibles** :
- Ne pre-render que les pages les plus populaires (top 1000-5000)
- Utiliser `dynamicParams: true` pour les autres → génération à la demande
- Lazy-import les gros JSONs avec `dynamic()` ou `import()` conditionnel
- Splitter `rule34video-videos.json` en chunks plus petits (par lettre, par date, etc.)

**Configuration actuelle** (`Dockerfile`) :
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=6144"
```
C'est le max raisonnable sur un serveur 8GB. Ne pas monter au-delà.

## Stratégie de cache

### Cache actuel
| Quoi | Où | TTL | Problème |
|------|----|-----|----------|
| URLs yt-dlp résolues | In-memory (Map) | 1h | Perdu au redéploiement |
| Réponses API Danbooru | Aucun cache | — | Chaque requête = appel API |
| Réponses API Gelbooru | Aucun cache | — | Idem |
| Réponses API Rule34 | Aucun cache | — | Idem |
| JSONs statiques | En RAM au démarrage | ∞ (jusqu'au redéploiement) | 400MB de RAM permanents |
| Assets Next.js | CDN Coolify | Longue durée | OK |

### Améliorations recommandées (par priorité)

1. **Cache HTTP API routes** : ajouter `Cache-Control` headers sur `/api/proxy` et `/api/resolve-video`
2. **Cache yt-dlp sur disque** : SQLite ou fichier JSON pour persister les URLs résolues entre redéploiements
3. **Cache API live** : stocker les réponses Danbooru/Gelbooru/Rule34 en mémoire avec TTL (5-15 min)
4. **ISR (Incremental Static Regeneration)** : pour les pages `/tag/` et `/character/` populaires — pre-render avec revalidation toutes les heures
5. **Futur** : Redis si la RAM le permet (mais sur un serveur 8GB, probablement pas)

## Optimisation des images

Les images viennent de CDNs externes qu'on ne contrôle pas :

| Source | CDN | Format | Taille typique |
|--------|-----|--------|----------------|
| Danbooru | `cdn.donmai.us` | JPG/PNG/WebP | 100KB-2MB |
| Gelbooru | `img*.gelbooru.com`, `video-cdn*.gelbooru.com` | JPG/WebP | 50KB-500KB |
| Rule34.xxx | `api-cdn.rule34.xxx` | JPG/PNG | 50KB-1MB |
| Rule34Video | URLs variées | JPG | 20KB-200KB |
| WordPress | URLs variées | JPG/PNG | 50KB-500KB |

**Optimisations possibles** :
- `next/image` avec `sizes` et `quality` appropriés pour le responsive
- `loading="lazy"` sur toutes les images below-the-fold
- `priority` sur les 4-6 premières images visibles (hero + premier row)
- `placeholder="blur"` avec un blurDataURL généré (mais ça augmente la RAM)
- Proxy d'images avec redimensionnement (ex: Cloudflare Image Resizing) — futur

## Optimisation du player vidéo

`WatchPlayer.tsx` fait 958 lignes. Points de performance :

1. **HLS.js** : chargé dynamiquement (`import('hls.js')`). Vérifier que le chunk n'est pas trop gros.
2. **State management** : beaucoup de `useState` dans un seul composant. Si les re-renders deviennent un problème, extraire les states indépendants dans des hooks custom ou utiliser `useReducer`.
3. **Event listeners** : double-tap, keyboard shortcuts, resize — tous doivent être nettoyés dans les cleanup functions.
4. **Theater mode / Fullscreen** : ces transitions peuvent trigger des reflows. Utiliser `will-change: transform` ou `contain: layout` sur le container.

## Monitoring (à mettre en place)

Actuellement **aucun monitoring**. Voici ce qu'il faut ajouter par priorité :

1. **Health check** : endpoint `/api/health` qui retourne status + mémoire utilisée
2. **Memory monitoring** : `process.memoryUsage()` loggé toutes les minutes
3. **Alertes OOM** : notifier si `heapUsed > 80%` du heap max
4. **Core Web Vitals** : `web-vitals` library côté client → envoyer à un endpoint de tracking
5. **Uptime** : UptimeRobot ou Betterstack (gratuit) pour ping l'URL

## Règles de performance pour les devs

1. **Ne jamais charger un JSON complet si tu n'en as besoin que d'une partie** — utiliser des fonctions de filtrage côté serveur
2. **Pas de `JSON.parse()` de gros fichiers dans les API routes** — ils sont déjà en mémoire via les modules
3. **Toujours mettre `loading="lazy"` sur les images** sauf les 4-6 premières
4. **Les API routes doivent avoir un timeout** — surtout `/api/resolve-video` (yt-dlp peut hang)
5. **Ne pas ajouter de dépendances lourdes** sans vérifier le bundle size impact (`npx @next/bundle-analyzer`)
6. **Les composants Client (`"use client"`) doivent être le plus petits possible** — extraire la logique interactive dans des composants leaf
7. **Préférer les Server Components** partout où c'est possible — moins de JS envoyé au client
8. **Le CSS est dans `globals.css`** — ne pas créer de fichiers CSS additionnels, ajouter au fichier existant avec le bon préfixe

## Quick Wins (à faire en premier)

1. **Ajouter du swap (2-4GB)** sur le VPS Hetzner → protège contre les OOM kills
2. **`Cache-Control` sur `/api/proxy`** : `public, max-age=3600` (les images Gelbooru ne changent pas)
3. **`Cache-Control` sur les pages statiques** : utiliser `revalidate` de Next.js
4. **Précharger les fonts critiques** : vérifier que `next/font` précharge correctement
5. **Compresser les réponses** : vérifier que gzip/brotli est actif (normalement Coolify le gère)

## Commandes utiles

```bash
# Analyser le bundle
ANALYZE=true npm run build

# Mesurer la mémoire en dev
node --inspect npm run dev
# Puis ouvrir chrome://inspect

# Tester le build avec contrainte mémoire
NODE_OPTIONS='--max-old-space-size=4096' npm run build  # Simule un serveur plus petit

# Lighthouse CLI
npx lighthouse https://iku.gg --output=json --output-path=./lighthouse.json

# Tester yt-dlp performance
time yt-dlp -j --no-download "https://rule34video.com/videos/12345/"
```
