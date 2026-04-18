<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# Agents & Workflow Rules

## Rôle

Tu travailles sur **iku.gg**, une plateforme de streaming d'hentai animé avec 353K+ vidéos agrégées depuis 5 sources. Le propriétaire (Sab) est débutant en code — explique toujours ce que tu fais et pourquoi.

## Règles absolues

### Code

- **TOUJOURS** lire `CLAUDE.md` en premier pour comprendre l'architecture
- **JAMAIS** éditer les fichiers JSON dans `src/data/` — ils sont auto-générés par les scrapers
- **TOUJOURS** tester avec `npm run build` après un changement structurel (le build peut OOM avec 6GB)
- **JAMAIS** casser les slugs existants — 353K pages dépendent du format actuel
- Respecter les conventions CSS : préfixes `v2-`, `wp-`, `player-`, BEM-like
- Utiliser `@/` pour tous les imports absolus
- Ne pas ajouter de nouvelles dépendances sans justification

### APIs externes

- **Danbooru** : max 5 req/sec, max 2 tags par recherche (compte free)
- **Gelbooru** : max 1 req/sec, toujours utiliser `throttle()`
- **Rule34** : max 2 req/sec
- Les clés API sont hardcodées dans les fichiers lib (à terme : env vars)

### SEO (priorité haute)

- Chaque nouvelle page DOIT avoir : metadata, JSON-LD, canonical URL
- Les titres doivent contenir "hentai" pour le SEO
- Ne pas créer de pages qui dupliquent du contenu existant
- Respecter la limite de 45K URLs par sitemap (déjà splitté)

### Déploiement

- Docker build via Coolify (auto-deploy depuis main)
- Le Dockerfile installe Python + yt-dlp pour `/api/resolve-video`
- Le serveur n'a que 8GB de RAM — être économe en mémoire
- Pas de swap configuré — un OOM kill = crash total

### Sécurité

- Rate limiter toute nouvelle API route
- Valider les URLs dans les proxies (whitelist de domaines)
- Ne pas exposer les clés API côté client
