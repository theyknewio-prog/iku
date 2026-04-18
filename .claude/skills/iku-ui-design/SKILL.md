---
name: iku-ui-design
description: "Expert UI/UX design pour iku.gg — site de streaming hentai dark premium avec glassmorphism, neon pink/purple, Tailwind CSS v4. Utilise ce skill pour TOUTE question de design : composants, layout, responsive, dark theme, couleurs, typography, sidebar, topbar, mobile bottom nav, cards, carousel, grille vidéo, thumbnails, animations, hover effects, skeletons, loading states, UX de sites vidéo adultes. Trigger dès que l'utilisateur mentionne : design, UI, UX, composant, component, layout, sidebar, topbar, mobile, responsive, couleur, color, thème, theme, dark, card, carousel, grille, grid, thumbnail, animation, hover, skeleton, loading, CSS, Tailwind, glassmorphism, style."
---

# iku.gg — UI Design Skill

Tu es un expert UI/UX spécialisé dans les sites de streaming vidéo adult/anime premium. Tu travailles sur **iku.gg** dont le design system est basé sur un thème dark premium avec glassmorphism et accents neon pink/purple.

## Design System v2.0

### Palette de couleurs

Le système utilise Tailwind CSS v4 avec une config CSS-first (`@theme inline` dans `globals.css`).

**Primitives** :

```
Neutrals (surfaces) :
  neutral-0:   #ffffff (texte principal)
  neutral-100: #e8e8e8 (texte secondaire)
  neutral-300: #a0a0a0 (texte muted)
  neutral-400: #6e6e6e (bordures subtiles)
  neutral-600: #2e2e2e (bordures)
  neutral-700: #1e1e1e (surfaces élevées)
  neutral-800: #141414 (cards)
  neutral-900: #0d0d0d (fond)
  neutral-950: #0a0a0a (fond principal)

Accents :
  pink-400: #ff4d96 (hover, links actifs)
  pink-500: #ff2080 (CTA principal, accent primaire)
  pink-600: #e6006e (active states)
  purple-400: #9055ff (accent secondaire)
  purple-500: #7c3aff (gradients)
```

**Surfaces sémantiques** :

```
bg-base:       #0a0a0a (fond de page)
bg-elevated:   #111111 (éléments au-dessus)
bg-overlay:    #161616 (modals, drawers)
bg-card:       #141414 (video cards)
bg-card-hover: #1a1a1a (hover sur cards)
bg-muted:      #1e1e1e (backgrounds discrets)
bg-glass:      rgba(255,255,255,0.04) (glassmorphism)
```

### Typography

3 font families chargées via `next/font` dans `layout.tsx` :

- **Inter** — corps de texte, UI (variable, `--font-inter`)
- **Poppins** — titres, headings (weight 600-700, `--font-poppins`)
- **Righteous** — branding/logo uniquement (weight 400, `--font-righteous`)

### Architecture de layout

```
┌──────────────────────────────────────────────┐
│ TOPBAR (fixe, blur backdrop, z-50)           │
│  [Logo iku] [Search...] [Home Trending New...│
├────┬─────────────────────────────────────────┤
│ S  │                                         │
│ I  │  CONTENU PRINCIPAL                      │
│ D  │  (pages, grilles vidéo, etc.)           │
│ E  │                                         │
│ B  │                                         │
│ A  │                                         │
│ R  │                                         │
│    │                                         │
│60px│                                         │
├────┴─────────────────────────────────────────┤
│ MOBILE BOTTOM NAV (visible < 768px)          │
│  [Home] [Browse] [Feed] [Trending] [More]    │
└──────────────────────────────────────────────┘
```

**Sidebar** (`v2-sidebar`) : 60px de large, icônes uniquement + tooltips au hover. Items : Home, Browse, Trending, New, Tags, Feed, History, Favorites, Settings. Avatar en bas.

**Topbar** (`v2-topbar`) : logo + barre de recherche autocomplete + nav links desktop. Effet `backdrop-blur` quand scrollé.

**Mobile bottom nav** : 4 items (Home, Browse, Feed, Trending) + bouton "More" qui ouvre un drawer avec History, Favorites, Tags, Settings.

**Exception** : la route `/feed` n'a PAS de shell (swipe feed plein écran type TikTok).

### Composants existants

| Composant            | Fichier                  | Description                                      |
| -------------------- | ------------------------ | ------------------------------------------------ |
| `AppShell`           | `AppShell.tsx`           | Layout principal : sidebar + topbar + bottom nav |
| `WatchPlayer`        | `WatchPlayer.tsx`        | Player vidéo custom (958 lignes) avec HLS        |
| `VideoCard`          | `VideoCard.tsx`          | Card vidéo pour les grilles                      |
| `ThumbnailCard`      | `ThumbnailCard.tsx`      | Card avec thumbnail + info                       |
| `PosterCard`         | `PosterCard.tsx`         | Card format poster (vertical)                    |
| `Carousel`           | `Carousel.tsx`           | Carousel horizontal de vidéos                    |
| `HomeFeed`           | `HomeFeed.tsx`           | Feed de la page d'accueil                        |
| `HomePageClient`     | `HomePageClient.tsx`     | Client wrapper pour la home                      |
| `SwipeFeed`          | `SwipeFeed.tsx`          | Feed swipe vertical (type TikTok)                |
| `Pagination`         | `Pagination.tsx`         | Navigation entre pages                           |
| `SearchAutocomplete` | `SearchAutocomplete.tsx` | Barre de recherche avec suggestions              |
| `SearchBar`          | `SearchBar.tsx`          | Barre de recherche simple                        |
| `AgeGate`            | `AgeGate.tsx`            | Modal de vérification d'âge                      |
| `BlacklistFilter`    | `BlacklistFilter.tsx`    | Filtre de tags blacklistés                       |
| `SkeletonGrid`       | `SkeletonGrid.tsx`       | Grille de placeholders skeleton                  |
| `SiteFooter`         | `SiteFooter.tsx`         | Footer du site                                   |
| `SiteHeader`         | `SiteHeader.tsx`         | Header alternatif                                |
| `WatchActions`       | `WatchActions.tsx`       | Actions sous le player (like, share, etc.)       |

### Conventions CSS

- **Tout le CSS est dans `src/app/globals.css`** — pas de fichiers CSS séparés
- **Tailwind CSS v4** avec configuration inline (`@theme inline`)
- **Classes de composant** : préfixe `v2-` pour le design system v2 (ex: `v2-shell`, `v2-sidebar`, `v2-topbar`)
- **Pas de CSS Modules** — tout en classes globales ou Tailwind utilities
- **Glassmorphism** : `backdrop-blur` + `bg-glass` pour les overlays
- **Transitions** : `transition: all 0.15s ease` pour les hovers, `0.3s` pour les layouts
- **Border-radius** : 8px pour les cards, 6px pour les boutons, 12px pour les modals

### Patterns UX pour sites de streaming adult

1. **Grille de vidéos** : 2 colonnes mobile → 3 tablette → 4-5 desktop. Ratio 16:9 pour les thumbnails.
2. **Hover sur card** : scale(1.03) + ombre + overlay avec durée/nombre de vues
3. **Infinite scroll** OU pagination — jamais les deux sur la même page
4. **Loading states** : skeleton screens qui matchent la forme des cards
5. **Player vidéo** : contrôles custom qui disparaissent après 3s d'inactivité
6. **Theater mode** : le player prend toute la largeur, contenu en dessous
7. **Sidebar** : collapse en icônes uniquement sur desktop (comme YouTube)
8. **Recherche** : autocomplete avec suggestions de tags, personnages, séries
9. **Tags** : chips cliquables, couleur différente si selected
10. **Age gate** : modal bloquant au premier accès, stocké en cookie/localStorage

### Responsive breakpoints

```
Mobile:  < 640px   — bottom nav, 2 colonnes, search réduit
Tablet:  640-1024px — sidebar collapse, 3 colonnes
Desktop: > 1024px   — sidebar fixe, 4-5 colonnes, topbar complet
```

### Règles design strictes

1. **Ne jamais utiliser de blanc pur** — le fond le plus clair est `neutral-700` (#1e1e1e)
2. **L'accent pink est réservé aux éléments interactifs** — CTA, links, active states
3. **Le purple est secondaire** — gradients, badges, éléments décoratifs
4. **Contraste texte** : texte principal `neutral-0` (#fff), secondaire `neutral-300` (#a0a0a0), muted `neutral-400` (#6e6e6e)
5. **Toujours supporter le mobile first** — commencer par le mobile, puis ajouter les breakpoints
6. **Les SVG icons sont inline** — pas de library externe (Lucide, Heroicons, etc.) pour garder le bundle petit
7. **Les animations doivent respecter `prefers-reduced-motion`**
8. **Pas d'emojis dans l'interface** — le ton est premium, pas casual
