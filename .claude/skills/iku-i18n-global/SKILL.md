---
name: iku-i18n-global
description: "Expert internationalisation et expansion mondiale pour iku.gg — stratégie EN first puis global, hreflang, URL multilingue, SEO international, traduction, marché anime mondial. Utilise ce skill pour TOUTE question d'internationalisation : traduction, langue, language, i18n, hreflang, multilingue, multilingual, localisation, marché international, japonais, espagnol, portugais, français, allemand, expansion, global, worldwide. Trigger dès que l'utilisateur mentionne : traduction, langue, language, i18n, international, global, mondial, hreflang, multilingue, localisation, japonais, espagnol, portugais, français, allemand, expansion."
---

# iku.gg — i18n & Global Expansion Skill

Tu es un expert en SEO international et internationalisation de sites web. Tu travailles sur **iku.gg** dont la stratégie est "EN first, puis mondial".

## Stratégie d'expansion

### Phase 1 — Anglais (actuelle)

Dominer le marché anglophone :

- US, UK, Canada, Australie
- C'est le marché le plus rentable (CPM pub les plus élevés)
- Tout le contenu est en anglais
- Pas de i18n technique nécessaire à ce stade

### Phase 2 — Langues à fort volume (objectif)

Par ordre de priorité basé sur le volume de recherche hentai :

| Priorité | Langue            | Marché           | Volume estimé | Difficulté                       |
| -------- | ----------------- | ---------------- | ------------- | -------------------------------- |
| 1        | Japonais (ja)     | Japon            | Très élevé    | Haute (concurrence locale forte) |
| 2        | Espagnol (es)     | Latam + Espagne  | Élevé         | Moyenne                          |
| 3        | Portugais (pt-BR) | Brésil           | Élevé         | Moyenne                          |
| 4        | Français (fr)     | France + Afrique | Moyen         | Faible                           |
| 5        | Allemand (de)     | DACH             | Moyen         | Moyenne                          |
| 6        | Russe (ru)        | Russie + CEI     | Élevé         | Haute (blocages possibles)       |
| 7        | Coréen (ko)       | Corée du Sud     | Moyen         | Haute                            |
| 8        | Indonésien (id)   | Indonésie        | Élevé         | Faible (mais CPM bas)            |

### Phase 3 — Couverture mondiale

Langues restantes via traduction automatique + review.

## Architecture URL

### Option recommandée : sous-répertoires

```
iku.gg/         → anglais (défaut)
iku.gg/es/      → espagnol
iku.gg/fr/      → français
iku.gg/ja/      → japonais
iku.gg/pt-br/   → portugais brésilien
```

**Pourquoi les sous-répertoires** (vs sous-domaines vs TLDs) :

- Un seul domaine = une seule autorité de domaine SEO
- Pas besoin de configs DNS séparées
- Plus simple à gérer dans Next.js (middleware + i18n routing)
- Les backlinks bénéficient à tout le site

### Implémentation Next.js

```typescript
// next.config.ts (ou middleware.ts)
// Utiliser le middleware Next.js pour détecter la locale

// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const locales = ["en", "es", "fr", "ja", "pt-br", "de"];
const defaultLocale = "en";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Vérifier si le pathname a déjà une locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return;

  // Détecter la locale depuis Accept-Language ou cookie
  const locale = detectLocale(request) || defaultLocale;

  // Ne pas rediriger pour l'anglais (c'est le défaut)
  if (locale === "en") return;

  // Rediriger vers la version localisée
  return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
}
```

### Structure des routes

```
src/app/
  [locale]/           ← layout avec la locale
    page.tsx           ← home localisée
    watch/[slug]/
      page.tsx         ← page vidéo localisée
    tag/[tag]/
      page.tsx         ← page tag localisée
    glossary/[term]/
      page.tsx         ← glossaire localisé
    blog/[slug]/
      page.tsx         ← blog localisé
```

## hreflang — SEO international

Chaque page doit avoir des balises hreflang pour indiquer à Google les versions linguistiques :

```html
<link rel="alternate" hreflang="en" href="https://iku.gg/watch/gel-12345" />
<link rel="alternate" hreflang="es" href="https://iku.gg/es/watch/gel-12345" />
<link rel="alternate" hreflang="fr" href="https://iku.gg/fr/watch/gel-12345" />
<link rel="alternate" hreflang="ja" href="https://iku.gg/ja/watch/gel-12345" />
<link
  rel="alternate"
  hreflang="x-default"
  href="https://iku.gg/watch/gel-12345"
/>
```

**Règles hreflang** :

- `x-default` pointe toujours vers la version anglaise
- Chaque page doit référencer TOUTES les versions linguistiques (y compris elle-même)
- Les hreflang doivent aussi être dans les sitemaps
- Bidirectionnel : si EN linke vers ES, ES doit linker vers EN

## Ce qu'il faut traduire (et ce qu'il ne faut PAS)

### À traduire

- Interface utilisateur (boutons, navigation, labels)
- Titres de page et meta descriptions
- Contenu du glossaire (chaque terme dans chaque langue)
- Articles de blog (écrire du contenu natif par langue, pas juste traduire)
- FAQ auto-générées
- Messages d'erreur, age gate

### À NE PAS traduire

- Les tags vidéo (garder en anglais/japonais — c'est comme ça que les gens cherchent)
- Les noms de personnages (universels)
- Les noms de séries (garder le titre original)
- Les slugs URL (garder en anglais pour la cohérence)

## Fichiers de traduction

Structure recommandée :

```
src/
  locales/
    en.json    ← anglais (source de vérité)
    es.json
    fr.json
    ja.json
    pt-br.json
```

Format :

```json
{
  "nav.home": "Home",
  "nav.browse": "Browse",
  "nav.trending": "Trending",
  "nav.new": "New",
  "nav.tags": "Tags",
  "player.play": "Play",
  "player.pause": "Pause",
  "player.fullscreen": "Fullscreen",
  "search.placeholder": "Search videos, tags, characters...",
  "age_gate.title": "Age Verification",
  "age_gate.confirm": "I am 18 or older"
}
```

## SEO par marché

### Contenu localisé pour le SEO

Chaque marché a ses propres requêtes de recherche :

| Marché | Requêtes populaires                                    | Notes                      |
| ------ | ------------------------------------------------------ | -------------------------- |
| EN     | "hentai", "anime porn", "[character] hentai"           | Marché le plus compétitif  |
| ES     | "hentai en español", "anime xxx", "hentai sin censura" | Fort volume en Latam       |
| FR     | "hentai français", "hentai vostfr", "anime hentai"     | Volume moyen mais CPM ok   |
| JA     | "エロアニメ", "同人アニメ", "無修正アニメ"             | Concurrence locale extrême |
| PT-BR  | "hentai legendado", "anime hentai br"                  | Volume élevé, CPM bas      |

### Stratégie de contenu par langue

- **Ne PAS simplement traduire les articles EN** — écrire du contenu natif qui cible les requêtes locales
- Un article "Top 10 hentai genres" en anglais ne sera pas aussi efficace traduit en espagnol qu'un article "Los mejores géneros de hentai para principiantes" écrit pour le marché hispanophone
- Les glossaires DOIVENT être traduits car les définitions sont cherchées dans la langue locale

## Coûts et outils de traduction

| Outil               | Coût                 | Qualité    | Usage                         |
| ------------------- | -------------------- | ---------- | ----------------------------- |
| DeepL API           | ~$5.49/million chars | Excellente | Traduction initiale           |
| GPT-4 / Claude      | Variable             | Très bonne | Review + contenu natif        |
| Traducteurs humains | $0.05-0.10/mot       | Parfaite   | Contenu clé (meta, glossaire) |
| Google Translate    | Gratuit              | Moyenne    | Jamais pour le SEO            |

**Recommandation** : DeepL pour la base, review humain pour les meta descriptions et le glossaire.
