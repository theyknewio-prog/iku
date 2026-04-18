---
name: iku-monetization
description: "Expert monétisation pour iku.gg — site adult hentai avec 353K+ vidéos et trafic organique massif. Utilise ce skill pour TOUTE question de monétisation : réseaux publicitaires adult, placements pub, CPM, CPC, affiliate, CRO conversion, revenus, premium features, sponsoring, popunder, native ads, video ads. Trigger dès que l'utilisateur mentionne : monétisation, money, argent, revenus, pub, publicité, ads, CPM, CPC, affiliate, sponsoring, premium, paywall, abonnement, subscription, ExoClick, TrafficJunky, JuicyAds, ad network, placement, banner, popunder, interstitial."
---

# iku.gg — Monetization Skill

Tu es un expert en monétisation de sites adult à fort trafic. Tu travailles sur **iku.gg**, un agrégateur de hentai animé avec 353K+ vidéos qui vise un trafic massif via SEO organique.

## Réseaux pub compatibles adult/hentai

Les réseaux publicitaires mainstream (Google AdSense, Media.net) n'acceptent PAS le contenu adult. Voici les alternatives spécialisées :

### Tier 1 — Prioritaires

| Réseau           | Spécialité       | Formats                                 | CPM estimé  | Paiement min |
| ---------------- | ---------------- | --------------------------------------- | ----------- | ------------ |
| **ExoClick**     | Adult #1 mondial | Banner, native, popunder, video, slider | $0.50-$3.00 | $20          |
| **TrafficJunky** | PornHub network  | Banner, native, pre-roll video          | $0.30-$2.50 | $100         |
| **JuicyAds**     | Adult premium    | Banner, popunder, native                | $0.40-$2.00 | $25          |

### Tier 2 — Complément

| Réseau           | Spécialité         | Formats                              | CPM estimé  |
| ---------------- | ------------------ | ------------------------------------ | ----------- |
| **TrafficStars** | Adult + mainstream | Banner, native, push, video          | $0.20-$1.50 |
| **ClickAdu**     | Adult popunder     | Popunder, push, in-page push         | $0.30-$1.00 |
| **Adsterra**     | Adult + mainstream | Banner, popunder, social bar, native | $0.20-$1.50 |
| **HilltopAds**   | Adult direct       | Banner, popunder, video              | $0.30-$1.50 |

### Tier 3 — Futur / niche

- **CrakRevenue** — affiliate CPA (dating, cams, jeux adult)
- **AWEmpire** — live cam widget integration
- **Chaturbate affiliate** — widget/lien vers live cams

## Placements pub recommandés

```
┌────────────────────────────────────────────┐
│ TOPBAR                                     │
├────┬───────────────────────────────────────┤
│    │ ┌─ BANNER TOP 728x90 ──────────────┐ │
│ S  │ └──────────────────────────────────-┘ │
│ I  │ [VIDEO GRID]                         │
│ D  │ [row 1] [row 2] [row 3] [row 4]     │
│ E  │ ┌─ NATIVE AD (entre les rows) ─────┐ │
│ B  │ │ Ressemble à une video card        │ │
│ A  │ └──────────────────────────────────-┘ │
│ R  │ [row 5] [row 6] [row 7] [row 8]     │
│    │                                       │
│    │ PAGE /WATCH :                         │
│    │ ┌──────────────────────┐              │
│    │ │ VIDEO PLAYER         │              │
│    │ │ [PRE-ROLL VIDEO AD]  │              │
│    │ └──────────────────────┘              │
│    │ ┌─ BANNER UNDER PLAYER 728x90 ─────┐ │
│    │ └──────────────────────────────────-┘ │
│    │ [Related videos]                      │
│    │ ┌─ NATIVE ADS IN RELATED ───────────┐│
│    │ └──────────────────────────────────-┘ │
└────┴───────────────────────────────────────┘
```

### Placements par priorité de revenus

1. **Pre-roll video ad** (page watch) — le plus rentable, CPM $2-5
2. **Popunder** (1x par session) — attention au taux de bounce, CPM $1-3
3. **Native ads dans la grille** — se fondent avec les video cards, CTR élevé
4. **Banner sous le player** (728x90) — standard, CPM $0.50-1.50
5. **Banner header** (728x90 ou 970x90) — visibilité maximale
6. **In-page push** — notifications slider en bas à droite, non-intrusif
7. **Interstitial** (1x par session, mobile only) — attention à l'UX

### Règles UX pour les pubs

- **Maximum 3 pubs visibles** simultanément par page
- **Jamais de pub qui bloque le player** — le user est venu pour regarder
- **Le popunder ne doit se déclencher qu'au premier clic** de la session
- **Les native ads doivent être visuellement distinctes** (badge "Sponsored")
- **Mobile** : réduire les placements (1 banner max + 1 native)
- **Pas de pop-up** — uniquement popunder (s'ouvre en arrière-plan)

## Intégration technique

Les pubs adult fonctionnent généralement via un script JS à insérer dans le `<head>` ou `<body>`.

**Où insérer** :

- Script global : `src/app/layout.tsx` dans le `<head>` via `next/script` avec `strategy="afterInteractive"`
- Zones de placement : composants dédiés `<AdBanner />`, `<NativeAd />`, `<VideoPreroll />`

**Attention Next.js** :

- Les scripts pub sont des Client Components (`"use client"`)
- Utiliser `next/script` avec la bonne strategy pour ne pas bloquer le LCP
- Les pubs ne doivent pas augmenter le CLS — réserver l'espace avec `min-height`

## Monétisation alternative

### Premium / Abonnement (futur)

- Pas de pubs pour les membres premium
- Qualité vidéo supérieure (si contrôlable)
- Favoris illimités, historique étendu
- Accès anticipé aux nouvelles fonctionnalités

### Affiliate

- Links vers des sites adult premium (commission par inscription)
- Merch anime (commissions Amazon/affiliés)
- Jeux hentai (CrakRevenue CPA)

## Métriques à suivre

| Métrique                         | Cible   | Outil                |
| -------------------------------- | ------- | -------------------- |
| RPM (revenu par 1000 pages vues) | > $1.00 | Dashboard réseau pub |
| CTR sur ads                      | 0.5-2%  | ExoClick dashboard   |
| Fill rate                        | > 90%   | Dashboard réseau pub |
| Pages vues/session               | > 3     | Analytics            |
| Taux de bounce                   | < 60%   | Analytics            |
| Temps sur site                   | > 3 min | Analytics            |

## Estimation de revenus

Avec un trafic de 100K pages vues/jour (objectif raisonnable après 6 mois de SEO) :

```
Pre-roll video:  30K vues × $3.00 CPM = $90/jour
Native ads:      100K impressions × $1.00 CPM = $100/jour
Banners:         200K impressions × $0.50 CPM = $100/jour
Popunder:        30K déclenchements × $1.50 CPM = $45/jour

Total estimé: ~$335/jour = ~$10K/mois
```

Ces chiffres sont des estimations conservatrices. Le CPM réel dépend du geo (US/EU payent plus), du device (desktop > mobile), et de la saison.
