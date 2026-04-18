# iku.gg — Audit vitesse 2026-04-18

Mesures prises depuis Paris, 18:48 CET. Cloudflare Pro activé mais **cache HTML désactivé** (Cache-Control: private, no-store).

---

## 1. TTFB mesuré (brutal)

| URL                              | TTFB      | Download total | Taille |
| -------------------------------- | --------- | -------------- | ------ |
| `iku.gg/` (seul)                 | **7.5s**  | 53s            | 112KB  |
| `iku.gg/` (concurrent)           | **33.2s** | 48s            | 114KB  |
| `iku.gg/trending`                | 2.0s      | 28s            | 155KB  |
| `iku.gg/hentai`                  | **18.7s** | 35s            | 159KB  |
| `iku.gg/watch/*` (concurrent ×2) | **33.9s** | 33.9s          | 124KB  |
| **`redgifs.com/`**               | **34ms**  | 34ms           | 8KB    |

**Écart iku vs redgifs : 220× à 1000× plus lent.**

Le serveur queue les requêtes concurrentes : en solo le home répond en 7.5s, en parallèle × 2 → 33s. Signature classique de CPU saturé.

---

## 2. Santé serveur Hetzner CX33 (4 vCPU / 8GB)

```
load average: 6.08, 5.41, 5.57     ← 50% overload (load 4 = 100% d'un CX33)
Memory: 3.3GB / 7.5GB (swap 449MB — léger)
```

### CPU par container

| Container           | CPU %    | Commentaire                  |
| ------------------- | -------- | ---------------------------- |
| **iku-postgres**    | **149%** | 1,5 core bouffé par PG       |
| **app (Next.js)**   | **89%**  | presque 1 core               |
| **coolify (admin)** | **91%**  | ~1 core gaspillé par l'admin |
| coolify-proxy       | 34%      | Traefik, normal              |
| autres              | <5%      |                              |

**Total demandé ≈ 370% sur 400% disponible.** Le serveur est en saturation permanente. Tout ce qui n'a pas sa priorité CPU attend. D'où les TTFB 10-30s.

---

## 3. Goulot PostgreSQL

### La requête qui tue

Fichier : `src/lib/content.ts:540`

```sql
SELECT COUNT(*)::bigint FROM videos
WHERE NOT (tags && $1::text[])
  AND NOT (COALESCE(characters, ARRAY[]::text[]) && $1::text[])
  AND NOT (COALESCE(copyrights, ARRAY[]::text[]) && $1::text[])
```

- **Appelée sur chaque page avec pagination** : `/`, `/trending`, `/new`, `/hentai`, `/3d`, `/explore`, `/tag/*`, `/character/*`, `/series/*`
- **Memoize 1h** (`content.ts:568`) — mais chaque combinaison de filtres = clé unique, donc cache souvent miss
- **Plan d'exécution mesuré à vide (EXPLAIN ANALYZE)** : **Parallel Seq Scan sur 362K lignes, 404ms, 45K buffers lus (~350MB)**
- **Sous charge** : 3s+ (confirmé par `pg_stat_activity` — plusieurs "idle in transaction aborted" après statement_timeout 3s)

### Table videos

- 362,145 lignes, 528MB
- Cache hit 99.99% (buff/cache OK, pas un problème de disque)
- Le problème c'est le **FULL SEQ SCAN** : impossible d'utiliser l'index GIN avec un `NOT (array && array)` (index GIN ne gère que le positif `&&`, pas le `NOT`).

---

## 4. Cloudflare ne sert à rien

```
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
cf-cache-status: DYNAMIC
```

CF gère SSL/DDoS mais **passe 100% du trafic à l'origine**. Les 280 POPs mondiaux ne cachent rien. Chaque hit = 1 aller-retour Hetzner EU, y compris pour des users US ou JP.

Comparaison RedGifs : TTFB 34ms depuis Paris → HTML servi depuis edge Cloudflare (même provider).

---

## 5. Toutes les pages listing sont `force-dynamic`

| Route           | Mode          | PG hit à chaque request ? |
| --------------- | ------------- | ------------------------- |
| `/`             | force-dynamic | oui                       |
| `/trending`     | force-dynamic | oui                       |
| `/new`          | force-dynamic | oui                       |
| `/hentai`       | force-dynamic | oui                       |
| `/3d`           | force-dynamic | oui                       |
| `/explore`      | force-dynamic | oui                       |
| `/tag/*`        | force-dynamic | oui                       |
| `/character/*`  | force-dynamic | oui                       |
| `/series/*`     | force-dynamic | oui                       |
| `/watch/[slug]` | ISR 24h       | non (1er hit seulement)   |

Raison historique : au build Docker, PG n'est pas dispo donc impossible de pre-render. `force-dynamic` a été le contournement rapide. Aujourd'hui c'est un frein massif.

---

## 6. Causes racines classées

| #   | Cause                              | Impact TTFB              | Effort fix                   |
| --- | ---------------------------------- | ------------------------ | ---------------------------- |
| 1   | **CF ne cache aucune page HTML**   | ×10-50                   | 1-2h (Cache Rules dashboard) |
| 2   | **Serveur CX33 saturé** (load 6/4) | ×3-8                     | 20€/mois (upgrade CPX31)     |
| 3   | **COUNT(\*) seq scan 362K lignes** | +300-3000ms              | 2-4h (précompute table)      |
| 4   | **Pages listing force-dynamic**    | +500-2000ms              | 3-6h (passer en ISR)         |
| 5   | **Coolify mange 90% d'un core**    | +5-10% latence           | 1h investigation             |
| 6   | **Pas de Redis devant PG**         | marginal à cette échelle | 2-3h                         |

---

## 7. Ce que RedGifs fait de différent

1. **Cloudflare cache HTML** sur les pages browse — TTFB edge 34ms
2. **API JSON séparée** du HTML — shell statique + data fetch côté client
3. **Thumbnails + videos servis via CDN dédié** (gif-cdn.redgifs.com)
4. **Zéro SSR sur listing** — SPA qui fetch l'API
5. **Bundle JS minimal**, pas de React 19 / Next 16 lourd

On ne va pas refaire RedGifs. Mais on peut copier les points 1 et 4 partiellement.

---

## 8. Ma recommandation (à valider par Sab)

**Ordre de bataille par impact/effort :**

1. **Cloudflare Cache Rules sur pages publiques** — 2h de taf, TTFB passe de 7-33s à 30-60ms pour 95% du trafic. **C'est le plus gros ROI absolu.**

2. **Upgrade CX33 → CPX31** (8 vCPU, 16GB, ~20€/mois) — enlève la saturation CPU, divise les TTFB actuels par 3-5 même sans autre fix.

3. **Précompute les COUNT** — cron 15min qui stocke `(vertical, count)` dans une table 10 lignes. Plus jamais de seq scan.

4. **Investiguer Coolify 90% CPU** — probablement un bug de scheduler, facile.

5. **Plus tard** : passer /tag, /character, /series en ISR 1h.

**Les 2 premiers points suffisent probablement à atteindre la fluidité RedGifs.** Les autres c'est du polish.
