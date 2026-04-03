---
name: iku-analytics-growth
description: "Expert analytics et growth pour iku.gg — tracking, Google Search Console, rétention, A/B testing, funnels de conversion, métriques clés, user behavior, SEO analytics. Utilise ce skill pour TOUTE question d'analytics ou croissance : tracking, analytics, Google Analytics, Search Console, GSC, métriques, KPI, rétention, bounce rate, session duration, pages vues, A/B test, funnel, conversion, growth, croissance, trafic, traffic, indexation, impressions, clics, CTR, position, crawl budget. Trigger dès que l'utilisateur mentionne : analytics, tracking, Google Analytics, Search Console, GSC, métriques, KPI, rétention, bounce, session, pages vues, A/B test, funnel, conversion, growth, croissance, trafic, impressions, clics, CTR, position, crawl, indexation."
---

# iku.gg — Analytics & Growth Skill

Tu es un expert en web analytics et growth marketing pour sites à très grande échelle. Tu travailles sur **iku.gg** (353K+ pages) qui vise une croissance organique massive.

## Stack analytics recommandé

### Gratuit / Open source
| Outil | Rôle | Pourquoi |
|-------|------|----------|
| **Google Search Console** | SEO / Indexation | OBLIGATOIRE — seul outil qui montre comment Google voit le site |
| **Plausible** ou **Umami** | Analytics web | Privacy-friendly, léger, pas de cookie banner nécessaire |
| **Core Web Vitals (web-vitals)** | Performance réelle | Données terrain des vrais users |

### Pourquoi PAS Google Analytics
- Nécessite un cookie banner (RGPD) → friction UX sur un site adult
- Script lourd (45KB+) → impact sur le LCP
- Données échantillonnées sur les gros sites
- **Plausible/Umami** sont légers (~1KB), ne trackent pas les individus, pas de cookies

### Implémentation Plausible (self-hosted)
Plausible peut tourner sur le même serveur Hetzner (Docker) :
```html
<!-- Dans layout.tsx via next/script -->
<script defer data-domain="iku.gg" src="https://plausible.iku.gg/js/script.js" />
```
Ou utiliser Plausible Cloud ($9/mois pour 10K pages vues/mois, scales up).

### Implémentation Umami (self-hosted, gratuit)
```bash
# docker-compose.yml à ajouter sur le serveur Hetzner
# Attention à la RAM — Umami + PostgreSQL ~500MB
```

## Google Search Console — Le tableau de bord SEO

### Configuration
1. Vérifier la propriété `iku.gg` (DNS TXT ou meta tag)
2. Soumettre les sitemaps :
   - `https://iku.gg/sitemap.xml` (index)
   - `https://iku.gg/watch/sitemap/0.xml` à `N.xml` (vidéos par chunks de 45K)
3. Vérifier que les sitemaps sont acceptés (pas d'erreurs)

### Métriques à suivre quotidiennement

| Métrique | Cible Phase 1 | Cible Phase 2 | Signification |
|----------|--------------|--------------|---------------|
| Pages indexées | 50K+ | 200K+ | Combien de pages Google connaît |
| Impressions/jour | 10K+ | 100K+ | Combien de fois le site apparaît dans les SERPs |
| Clics/jour | 500+ | 10K+ | Trafic organique réel |
| CTR moyen | > 3% | > 5% | Qualité des titles/descriptions |
| Position moyenne | < 30 | < 15 | Visibilité globale |

### Analyse par type de page

| Type de page | Impressions attendues | Position cible |
|-------------|----------------------|----------------|
| Pages vidéo `/watch/` | Le gros du trafic | < 20 |
| Pages tag `/tag/` | Moyen | < 10 |
| Glossaire `/glossary/` | Longue traîne | < 5 |
| Blog `/blog/` | Mid-tail | < 10 |
| Pages personnage `/character/` | Variable | < 15 |

## Crawl Budget

Avec 353K+ pages, le crawl budget est un enjeu majeur :

**Crawl budget** = combien de pages Googlebot visite par jour sur ton site.

Pour un nouveau site : ~100-500 pages/jour au début, peut monter à 10K+/jour.

### Optimiser le crawl budget

1. **Sitemaps propres** : les sitemaps actuels (chunks de 45K) sont bien
2. **Pas de pages dupliquées** : canonicals corrects sur chaque page
3. **robots.txt** : ne pas bloquer les pages importantes, bloquer les pages inutiles (API routes, paramètres de recherche, etc.)
4. **Vitesse du site** : plus le site est rapide → plus Google crawl de pages
5. **Maillage interne** : aide Google à découvrir les pages sans passer par le sitemap
6. **Pages de faible qualité** : si certaines vidéos n'ont ni titre ni tags → `noindex` plutôt que de gaspiller du crawl budget

### Suivi de l'indexation
Créer un dashboard qui track :
- Nombre de pages dans le sitemap vs indexées dans GSC
- Ratio d'indexation (cible > 70%)
- Pages exclues et pourquoi (duplicate, noindex, crawled-not-indexed)

## KPIs par phase

### Phase 1 — Lancement (0-3 mois)
| KPI | Cible | Comment mesurer |
|-----|-------|-----------------|
| Pages indexées | > 10K | Google Search Console |
| Trafic organique | > 100/jour | Analytics |
| Bounce rate | < 70% | Analytics |
| Session duration | > 2 min | Analytics |
| Pages/session | > 2.5 | Analytics |

### Phase 2 — Croissance (3-6 mois)
| KPI | Cible |
|-----|-------|
| Pages indexées | > 50K |
| Trafic organique | > 1K/jour |
| Returning visitors | > 30% |
| Keyword rankings top 10 | > 500 keywords |

### Phase 3 — Domination (6-12 mois)
| KPI | Cible |
|-----|-------|
| Pages indexées | > 200K |
| Trafic organique | > 10K/jour |
| Returning visitors | > 40% |
| Keyword rankings top 3 | > 200 keywords |
| Revenue | > $5K/mois |

## Rétention et engagement

### Métriques de rétention
- **Returning visitors** : % de visiteurs qui reviennent dans les 7 jours
- **Session depth** : nombre de vidéos regardées par session
- **Watch time** : durée moyenne de visionnage par vidéo

### Leviers de rétention
1. **Historique** (`/history`) : permet de retrouver les vidéos vues
2. **Favoris** (`/favorites`) : donne une raison de revenir
3. **Feed personnalisé** (`/feed`) : contenu adapté aux goûts
4. **"New" section** (`/new`) : contenu frais quotidien (grâce au cron de scraping)
5. **Push notifications** (futur) : alerter sur les nouvelles vidéos d'une série/personnage suivi
6. **PWA** (futur) : installation sur mobile → accès rapide → rétention++

## A/B Testing

Pour un site de cette taille, l'A/B testing est puissant car le volume de trafic permet d'atteindre la significativité statistique rapidement.

### Tests prioritaires
1. **Layout de la grille** : 4 colonnes vs 5 colonnes (impact sur le CTR des cards)
2. **Taille des thumbnails** : plus grand = plus de clics ?
3. **Ordre de tri par défaut** : trending vs newest vs most viewed
4. **Position du search** : topbar vs page dédiée
5. **CTA pub** : quel placement génère le plus de revenus sans tuer la rétention

### Implémentation simple
Pas besoin d'un outil A/B testing complexe. Un cookie random + condition dans le code :
```typescript
// Middleware ou composant
const variant = cookies().get('ab_variant')?.value ||
  (Math.random() > 0.5 ? 'A' : 'B');
```
Tracker la variante dans l'analytics et comparer les métriques.

## Core Web Vitals — Tracking terrain

```typescript
// src/app/layout.tsx ou composant dédié
import { onLCP, onFID, onCLS, onINP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Envoyer à ton endpoint ou Plausible
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
    }),
  });
}

onLCP(sendToAnalytics);
onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Cela permet de mesurer les vrais Core Web Vitals des vrais utilisateurs, pas juste les scores Lighthouse en lab.

## Outils SEO complémentaires

| Outil | Usage | Coût |
|-------|-------|------|
| **Google Search Console** | Indexation, impressions, positions | Gratuit |
| **Ahrefs / SEMrush** | Analyse concurrence, backlinks, keywords | $99+/mois |
| **Screaming Frog** | Audit technique SEO (crawl du site) | Gratuit < 500 pages |
| **PageSpeed Insights** | Core Web Vitals lab | Gratuit |
| **Schema Markup Validator** | Tester les JSON-LD | Gratuit |
| **Rich Results Test** | Vérifier l'éligibilité rich snippets | Gratuit |
