---
name: iku-video-streaming
description: "Expert streaming vidéo pour iku.gg — player custom HLS 958 lignes, yt-dlp resolution, proxy Gelbooru, formats vidéo (MP4, WebM, HLS/m3u8), adaptive bitrate, preloading. Utilise ce skill pour TOUTE question de lecture vidéo : player, HLS, hls.js, MP4, WebM, m3u8, streaming, buffer, preload, résolution vidéo, yt-dlp, proxy, fullscreen, theater mode, PiP, keyboard shortcuts, mobile player, contrôles vidéo, volume, seek, vitesse. Trigger dès que l'utilisateur mentionne : player, vidéo, video, HLS, hls.js, stream, streaming, buffer, preload, play, pause, fullscreen, theater, PiP, picture-in-picture, volume, seek, vitesse, speed, résolution, quality, MP4, WebM, m3u8."
---

# iku.gg — Video Streaming Skill

Tu es un expert en streaming vidéo web (HTML5, HLS, adaptive bitrate). Tu travailles sur **iku.gg** qui a un player vidéo custom de 958 lignes.

## Architecture du player

**Fichier** : `src/components/WatchPlayer.tsx` (958 lignes, `"use client"`)

### Props

```typescript
interface WatchPlayerProps {
  src: string; // URL directe du fichier vidéo (MP4/WebM/HLS)
  poster?: string; // Thumbnail
  resolveUrl?: string; // Pour rule34video: URL de page à résoudre via yt-dlp
}
```

### Flow de lecture selon la source

```
1. DANBOORU / GELBOORU / RULE34
   → src = URL directe du fichier vidéo (MP4/WebM)
   → Le player charge directement via <video src="">
   → Gelbooru nécessite le proxy /api/proxy pour bypass hotlink

2. RULE34VIDEO / WORDPRESS
   → src = "" (vide)
   → resolveUrl = URL de la page source
   → Le player appelle /api/resolve-video avec l'URL
   → yt-dlp retourne l'URL du stream
   → Le player charge cette URL
   → Si c'est du HLS (.m3u8) → hls.js prend le relais
   → Si c'est du MP4 → lecture directe
```

### Fonctionnalités du player

| Feature            | Implémenté | Notes                                  |
| ------------------ | ---------- | -------------------------------------- |
| Play/Pause         | ✅         | Click sur la vidéo ou bouton           |
| Seek bar           | ✅         | Barre de progression avec preview      |
| Volume             | ✅         | Slider + mute toggle                   |
| Fullscreen         | ✅         | Bouton + double-tap mobile             |
| Theater mode       | ✅         | Élargit le player sur toute la largeur |
| Picture-in-Picture | ✅         | API PiP native du navigateur           |
| Vitesse de lecture | ✅         | 0.5x, 1x, 1.25x, 1.5x, 2x              |
| Keyboard shortcuts | ✅         | Via hook `useVideoShortcuts`           |
| Double-tap seek    | ✅         | Via hook `useDoubleTap` (±10s)         |
| HLS adaptive       | ✅         | Via hls.js (import dynamique)          |
| Loading spinner    | ✅         | Pendant le buffering                   |
| Seek overlay       | ✅         | Animation "+10s" / "-10s"              |
| Auto-hide controls | ✅         | Disparaissent après 3s d'inactivité    |
| Erreur fallback    | ✅         | Message d'erreur avec retry            |

### Raccourcis clavier (`useVideoShortcuts`)

| Touche     | Action                  |
| ---------- | ----------------------- |
| Espace / K | Play/Pause              |
| ← / →      | Seek -10s / +10s        |
| ↑ / ↓      | Volume +10% / -10%      |
| M          | Mute/Unmute             |
| F          | Fullscreen toggle       |
| T          | Theater mode toggle     |
| P          | Picture-in-Picture      |
| < / >      | Vitesse -0.25x / +0.25x |

### HLS.js

Le player détecte automatiquement si l'URL est un stream HLS (`.m3u8`) :

```typescript
// Import dynamique pour ne pas alourdir le bundle initial
const Hls = await import("hls.js");

if (Hls.isSupported()) {
  const hls = new Hls({
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
  });
  hls.loadSource(url);
  hls.attachMedia(videoElement);
}
```

**Safari** supporte HLS nativement via `<video>`, pas besoin de hls.js.

## Les 3 modes de livraison vidéo

### Mode 1 : URL directe (Danbooru, Rule34.xxx)

```
Browser → <video src="https://cdn.donmai.us/original/...mp4">
```

Simple, performant, pas de proxy nécessaire.

### Mode 2 : Proxy (Gelbooru)

```
Browser → /api/proxy?url=https://video-cdn1.gelbooru.com/...mp4
           → Server fetch avec Referer: https://gelbooru.com
           → Stream la réponse au client
```

Nécessaire car Gelbooru bloque les requêtes sans le bon Referer.

**Fichier** : `src/app/api/proxy/route.ts`
**Headers ajoutés** : `Referer: https://gelbooru.com`

### Mode 3 : Résolution yt-dlp (Rule34Video, WordPress)

```
Browser → /api/resolve-video?url=https://rule34video.com/videos/12345/
           → Server spawn: yt-dlp -j --no-download [url]
           → Parse JSON → extraire l'URL du stream
           → Retourner l'URL au client
Browser → <video src="[URL résolue]">
```

**Fichier** : `src/app/api/resolve-video/route.ts`

**Limitations** :

- 10 req/min/IP (rate limit)
- Max 3 process yt-dlp simultanés (concurrency guard)
- Cache in-memory 1h (Map<url, resolvedUrl>)
- yt-dlp ~500MB RAM par process
- Peut timeout si le site source est lent

## Optimisation de la lecture vidéo

### Preloading

- `preload="metadata"` par défaut (charge juste la durée/dimensions)
- `preload="auto"` uniquement quand l'utilisateur a cliqué play
- Le poster (thumbnail) est affiché avant le play

### Buffering

- HLS.js gère le buffer adaptif automatiquement
- Pour les MP4 directs, le navigateur gère le range requests
- Afficher un spinner pendant le buffering (pas de freeze sans feedback)

### Mobile

- Pas d'autoplay (bloqué par les navigateurs)
- Fullscreen via l'API Fullscreen (requestFullscreen)
- Double-tap gauche/droite pour seek ±10s
- Contrôles plus gros pour les doigts (min 44x44px)

## Problèmes connus

1. **WatchPlayer.tsx fait 958 lignes** — trop gros pour un seul composant. Devrait être découpé en sous-composants (PlayerControls, PlayerOverlay, PlayerProgress, etc.)

2. **Inline styles** — beaucoup de styles en `style={{}}` au lieu de classes CSS. Impact sur la maintenabilité.

3. **SVG icons inline** — les icônes play/pause/volume/etc. sont des composants SVG dans le même fichier. Devrait être extrait dans un fichier séparé.

4. **State management** — beaucoup de `useState` individuels. Un `useReducer` serait plus adapté pour un état aussi complexe.

5. **yt-dlp peut retourner des URLs qui expirent** — le cache de 1h peut contenir des URLs mortes. Implémenter un retry automatique quand la lecture échoue.

## Formats supportés

| Format      | Extension | Source                              | Player                    |
| ----------- | --------- | ----------------------------------- | ------------------------- |
| MP4 (H.264) | .mp4      | Danbooru, Gelbooru, Rule34          | `<video>` natif           |
| WebM (VP9)  | .webm     | Danbooru                            | `<video>` natif           |
| HLS         | .m3u8     | Rule34Video, WordPress (via yt-dlp) | hls.js                    |
| DASH        | .mpd      | Rare (certains yt-dlp)              | Non supporté actuellement |

Si yt-dlp retourne du DASH (.mpd), le player ne le supporte pas. Il faudrait ajouter `dash.js` ou prioriser les formats MP4/HLS dans la commande yt-dlp.
