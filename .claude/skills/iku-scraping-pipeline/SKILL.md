---
name: iku-scraping-pipeline
description: "Expert pipeline de scraping pour iku.gg — 5 sources vidéo (Danbooru, Gelbooru, Rule34.xxx, Rule34Video, WordPress), 353K+ vidéos, système de slugs à préfixes, yt-dlp resolution, cron GitHub Actions. Utilise ce skill pour TOUTE question de scraping : ajouter une source, modifier un scraper, normaliser des données, système de slug/préfixe, scripts/scrape-*.ts, yt-dlp, rule34video-videos.json, API rate limits, data dedup, tag mapping. Trigger dès que l'utilisateur mentionne : scrape, scraper, scraping, source, danbooru, gelbooru, rule34, rule34video, wordpress, wp-hentai, slug, préfixe, prefix, yt-dlp, vidéo, video, JSON, data, pipeline, cron, workflow, API."
---

# iku.gg — Scraping Pipeline Skill

Tu es un expert en scraping web et pipelines de données à grande échelle. Tu travailles sur **iku.gg** qui agrège des vidéos hentai de 5 sources différentes pour un total de 353K+ vidéos.

## Les 5 sources de données

### 1. Danbooru (API live)

- **Fichier** : `src/lib/danbooru.ts`, `scripts/scrape-danbooru.ts`
- **JSON** : `src/data/videos.json` (~12MB)
- **API** : `https://danbooru.donmai.us/posts.json`
- **Auth** : Pas de clé API (public)
- **Rate limit** : 5 requêtes/sec (throttle côté code)
- **Limite API** : max 2 tags par recherche
- **User-Agent** : `IkuApp/1.0 (danbooru.donmai.us/users/XXXXX)`
- **Filtre** : `rating:explicit` + `animated` + pas de tag blacklisté
- **Slug prefix** : aucun (les vidéos Danbooru n'ont pas de préfixe)
- **CDN images** : `cdn.donmai.us`

### 2. Gelbooru (API live + proxy)

- **Fichier** : `src/lib/gelbooru.ts`, `scripts/scrape-gelbooru.ts`
- **JSON** : `src/data/gelbooru-videos.json` (~9.9MB)
- **API** : `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1`
- **Auth** : API key + user ID **⚠️ HARDCODÉS dans le fichier**
  ```
  API_KEY = "3ed16caf...1a41"
  USER_ID = "1943515"
  ```
- **Rate limit** : 1 req/sec (MIN_INTERVAL = 1000ms)
- **User-Agent** : `IkuApp/1.0 (server-side)`
- **Proxy** : `/api/proxy` route pour bypass hotlink protection CDN (ajoute Referer header)
- **Slug prefix** : `gel-`
- **CDN images** : `img*.gelbooru.com`, `video-cdn*.gelbooru.com`
- **Revalidation** : 600 secondes

### 3. Rule34.xxx (API live)

- **Fichier** : `src/lib/rule34-search.ts`, `scripts/scrape-rule34.ts`
- **JSON** : `src/data/rule34-videos.json` (~11MB)
- **API** : `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1`
- **Auth** : API key **⚠️ HARDCODÉE dans le fichier**
- **Rate limit** : 2 req/sec
- **Slug prefix** : `r34-`
- **CDN images** : `api-cdn.rule34.xxx`, `api-cdn-mp4.rule34.xxx`

### 4. Rule34Video (JSON statique + yt-dlp)

- **Fichier** : `src/lib/rule34video.ts`, `scripts/scrape-rule34video.ts`
- **JSON** : `src/data/rule34video-videos.json` (~85MB ⚠️ LE PLUS GROS)
- **Nombre** : ~278K vidéos
- **Pas d'API live** — les données viennent d'un scrape statique
- **Résolution URL** : les URLs vidéo ne sont PAS stockées dans le JSON. Pour lire une vidéo, il faut appeler `/api/resolve-video` qui exécute `yt-dlp -j --no-download [url]` en temps réel
- **Rate limit résolution** : 10 requêtes/min/IP, max 3 yt-dlp concurrents
- **Cache résolution** : in-memory Map avec TTL 1h
- **Slug prefix** : `r34v-`
- **Particularité** : seules les métadonnées sont dans le JSON (titre, tags, thumbnail, URL page), pas l'URL du stream vidéo

### 5. WordPress sites (JSON statique + yt-dlp)

- **Fichier** : `src/lib/wp-hentai.ts`, `scripts/scrape-wp-sites.ts`
- **JSON** : `src/data/wp-hentai-videos.json` (~4.2MB)
- **Nombre** : ~17.8K vidéos
- **Sources WordPress** multiples : HentaiMama, HentaiTV, AIDub, WatchHentai, HentaiGasm, HentaiWorld
- **Résolution URL** : même système yt-dlp que Rule34Video
- **Slug prefixes** : `hmm-`, `htv-`, `aid-`, `wh-`, `hw-`, `hg-` (un par site WP)
- **Lazy loading** : les données sont chargées à la demande, pas au démarrage

## Le système de slugs et préfixes

Le slug identifie de manière unique chaque vidéo et encode sa source :

```
gel-12345      → Gelbooru, post ID 12345
r34-67890      → Rule34.xxx, post ID 67890
r34v-my-video  → Rule34Video
hmm-episode-1  → HentaiMama (WordPress)
htv-episode-2  → HentaiTV (WordPress)
12345          → Danbooru (pas de préfixe)
```

**Fichier** : `src/lib/slugify.ts`

**Fonctions** :

- `slugify(video)` → génère le slug avec le bon préfixe selon la source
- `parseSlug(slug)` → retourne `{ source, id }` pour router vers le bon loader
- Le slug est utilisé dans l'URL : `/watch/[slug]`

**Règle critique** : le préfixe est le SEUL moyen de savoir de quelle source vient une vidéo. Si tu changes le système de préfixes, TOUTES les URLs existantes cassent → impact SEO catastrophique.

## Le pipeline de scraping (cron quotidien)

Le workflow `.github/workflows/daily-scrape.yml` s'exécute tous les jours à 4h UTC :

```
1. Checkout du repo
2. Install tsx (TypeScript runner)
3. Publish contenu programmé (scripts/publish-scheduled.ts)
4. Commit si changements de contenu (blog/glossaire)
5. Scrape Danbooru    → scripts/scrape-danbooru.ts
6. Scrape Gelbooru    → scripts/scrape-gelbooru.ts
7. Scrape Rule34.xxx  → scripts/scrape-rule34.ts
8. Scrape Rule34Video → scripts/scrape-rule34video.ts
9. Scrape WordPress   → scripts/scrape-wp-sites.ts
10. Commit les JSONs si changements
11. Push
12. Trigger Coolify deploy via API
```

**Timeout** : 30 minutes max pour tout le pipeline.

## Le content layer unifié

**Fichier** : `src/lib/content.ts`

La fonction `getVideos()` fusionne les 5 sources :

```typescript
const results = await Promise.allSettled([
  getDanbooruVideos(),
  getGelbooruVideos(),
  getRule34Videos(),
  getRule34VideoVideos(),
  getWpHentaiVideos(),
]);
// Merge → dedup → sort → return
```

`Promise.allSettled` assure que si une source fail, les 4 autres sont quand même disponibles. Pas de point de défaillance unique.

## Comment ajouter une 6ème source

Guide pas-à-pas :

1. **Choisir un préfixe** unique (2-4 lettres + `-`)
2. **Créer le fichier API** : `src/lib/[source-name].ts`
   - Implémenter la fonction de recherche qui retourne `PaginatedResult<Video>`
   - Respecter le type `Video` de `src/types/video.ts`
   - Ajouter le rate limiting
3. **Créer le script scraper** : `scripts/scrape-[source-name].ts`
   - Output dans `src/data/[source-name]-videos.json`
4. **Mettre à jour `slugify.ts`** : ajouter le préfixe dans le switch
5. **Mettre à jour `content.ts`** : ajouter la source dans `getVideos()`
6. **Mettre à jour le type Video** : ajouter la source dans l'union type `source`
7. **Mettre à jour la page watch** : `src/app/watch/[slug]/page.tsx` — ajouter le case pour le nouveau préfixe
8. **Ajouter au workflow** : `.github/workflows/daily-scrape.yml`
9. **Mettre à jour `next.config.ts`** : ajouter le domaine CDN dans `images.remotePatterns`
10. **Tester** : vérifier que le build passe et que les vidéos s'affichent

## Normalisation des données

Chaque source a ses propres formats. Le pipeline normalise vers le type `Video` commun :

```typescript
interface Video {
  id: string;
  source: "danbooru" | "gelbooru" | "rule34" | "rule34video" | string;
  title: string;
  tags: string[];
  thumbnail: string;
  videoUrl?: string; // Absent pour rule34video/wp (résolution yt-dlp)
  pageUrl?: string; // URL source originale
  width?: number;
  height?: number;
  score?: number;
  createdAt?: string;
}
```

**Tags** : chaque source formate les tags différemment. Danbooru utilise des underscores (`big_breasts`), Gelbooru aussi, Rule34Video utilise des espaces. Le pipeline doit normaliser en snake_case.

## yt-dlp — Le système de résolution vidéo

Pour Rule34Video et WordPress, les URLs vidéo ne sont pas dans les JSONs. On les résout à la volée :

**Endpoint** : `/api/resolve-video`
**Commande** : `yt-dlp -j --no-download [url]`
**Process** : spawn Python → parse JSON output → extraire l'URL du stream

**Protections** :

- Rate limit : 10 requêtes/minute/IP
- Concurrency guard : max 3 process yt-dlp simultanés
- Cache in-memory : TTL 1h (Map)
- Timeout : le process yt-dlp a un timeout (éviter les hangs)

**⚠️ Problème connu** : yt-dlp consomme beaucoup de RAM (~500MB par process). Sur un serveur 8GB, 3 process concurrents = 1.5GB rien que pour yt-dlp. D'où la limite stricte de concurrence.

## Scripts de scraping (`scripts/`)

Chaque script suit le même pattern :

1. Charger le JSON existant (ou créer un array vide)
2. Appeler l'API/site source avec pagination
3. Normaliser les nouvelles données vers le type `Video`
4. Merger avec les données existantes (dedup par ID)
5. Sauvegarder le JSON

**Convention** : les scripts ne suppriment jamais de données, ils ajoutent ou mettent à jour. Si une vidéo existe déjà (même ID), elle est mise à jour avec les nouvelles métadonnées.
