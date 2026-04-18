# iku.gg — Architecture Design Spec

## Overview

iku.gg is a hentai video aggregation platform combining a TikTok-style swipe feed with SEO-optimized individual pages. Content is sourced from Danbooru API (65K+ animated MP4s with open CORS and permanent URLs), with hanime.tv batch downloads as a secondary source for traditional 2D anime hentai.

**Primary growth channel: SEO.** No manual promotion. 66,500+ indexable pages targeting 30-40M monthly searches for hentai-related terms.

**Monetization: ExoClick ads** — our player, our ad zones, our revenue. No third-party embeds.

---

## Routes & Pages

| Route                     | Rendering | Purpose                                                 |
| ------------------------- | --------- | ------------------------------------------------------- |
| `/`                       | SSR       | Homepage — trending grid + category navigation + search |
| `/watch/[slug]`           | SSR       | Individual video page — the SEO workhorse               |
| `/tag/[tag]`              | SSR       | Tag listing with video grid — mid-tail SEO              |
| `/character/[name]`       | SSR       | Character page — captures character name searches       |
| `/trending`               | SSR       | Trending videos — head term SEO                         |
| `/new`                    | SSR       | Newest content — freshness signal for Google            |
| `/feed`                   | CSR       | TikTok-style vertical swipe feed — engagement/retention |
| `/search?q=xxx`           | CSR       | Search results                                          |
| `/sitemap.xml`            | Dynamic   | Auto-generated sitemap index                            |
| `/sitemap/videos-[n].xml` | Dynamic   | Paginated video sitemaps                                |
| `/sitemap/tags.xml`       | Dynamic   | Tag page sitemap                                        |
| `/sitemap/characters.xml` | Dynamic   | Character page sitemap                                  |

---

## Page Specs

### `/watch/[slug]` — Video Page (SEO Critical)

Server-side rendered. Every video gets its own page.

**Head/Meta:**

- `<title>` — `{character} Hentai - {copyright} | iku.gg` or `{tags} Hentai | iku.gg`
- `<meta name="description">` — Generated from tags, character, copyright
- `<meta name="rating" content="adult">`
- OpenGraph: `og:title`, `og:description`, `og:image` (thumbnail), `og:video` (MP4 URL), `og:type: video.other`
- Twitter Card: `twitter:card: player`, `twitter:player` (video URL)
- Canonical URL
- JSON-LD VideoObject schema

**Body:**

- Video player (native `<video>` tag with our controls)
- Title (character + copyright or tags)
- Tag pills (linked to `/tag/[tag]`)
- Character link → `/character/[name]`
- Score, artist credit
- **Ad zone 1**: Banner below video (ExoClick 300x250 or 728x90)
- Related videos grid (tag-based similarity)
- **Ad zone 2**: Native ad between related videos
- "Open in swipe mode" button → `/feed?start=[id]`

**Schema.org:**

```json
{
  "@type": "VideoObject",
  "name": "...",
  "description": "...",
  "thumbnailUrl": "...",
  "contentUrl": "...",
  "duration": "PT{seconds}S",
  "uploadDate": "...",
  "interactionStatistic": { "@type": "InteractionCounter", "interactionType": "LikeAction", "userInteractionCount": score }
}
```

### `/tag/[tag]` — Tag Page (SEO)

Server-side rendered. ~500 tag pages.

**Head/Meta:**

- `<title>` — `{Tag} Hentai Videos - Best {Tag} Anime Porn | iku.gg`
- `<meta name="description">` — `Watch the best {tag} hentai videos. {count} free {tag} anime porn clips on iku.gg`

**Body:**

- H1: `{Tag} Hentai`
- Video count
- Grid of video thumbnails (20 per page, paginated)
- Each thumbnail links to `/watch/[slug]`
- **Ad zone**: Banner top + native ad mid-grid
- Pagination (SSR, not infinite scroll — Google needs to crawl)
- Related tags sidebar

### `/character/[name]` — Character Page (SEO)

Same pattern as tag pages but for characters. Captures "raiden shogun hentai", "d.va hentai" type searches.

### `/` — Homepage

- Search bar prominent
- Trending section (top 20 by score)
- New uploads section
- Popular tags grid
- Popular characters grid
- **Ad zone**: Leaderboard top
- **1 popunder per session max** (ExoClick)

### `/feed` — Swipe Feed (Engagement)

Client-side rendered. The TikTok experience.

- Full-screen vertical video
- Swipe up = next video
- CSS `scroll-snap-type: y mandatory`
- Intersection Observer for autoplay/pause
- Optional `?start=[id]` param to start from a specific video
- Optional `?tag=[tag]` param for filtered feed
- **Ad zone**: Native ad card every 6-8 videos (same visual format as video cards)
- Muted by default, tap to unmute

---

## Content Sources

### Primary: Danbooru API

- **Endpoint**: `https://danbooru.donmai.us/posts.json`
- **Query**: `tags=animated filetype:mp4 order:score rating:e`
- **Auth**: None required for reads
- **Rate limit**: 10 req/sec
- **CDN**: `cdn.donmai.us` — CORS open, URLs permanent (hash-based), cached 1 year
- **Volume**: 65K+ MP4 videos
- **Data per post**: id, file_url, preview_file_url, score, tag_string_general, tag_string_character, tag_string_copyright, tag_string_artist, image_width, image_height, file_size, media_asset.duration

**Slug generation**: `{id}-{character}-{copyright}` → e.g. `5083150-marie-rose-dead-or-alive`

### Secondary: hanime.tv batch downloads (Phase 2)

- yt-dlp + hanime-plugin extracts MP4s (confirmed working on VPS)
- Cron job downloads top 500 episodes as 30-second clips
- Stored on VPS in `/var/iku/videos/`
- Served as static files via Next.js or nginx
- ~1.5GB for 500 clips (fits on VPS)

### Tertiary: Gelbooru API (Phase 2)

- API key available (user_id: 1943515)
- 237K animated posts
- Filter for score > 50 to ensure quality
- Same direct MP4 URL pattern as Danbooru

---

## Monetization

### Ad Zones (ExoClick)

| Zone         | Format            | Placement                                | Trigger       |
| ------------ | ----------------- | ---------------------------------------- | ------------- |
| Popunder     | 1 per session     | First video play                         | Session start |
| Banner       | 300x250 or 728x90 | Below video on `/watch/`                 | Page load     |
| Native       | In-feed card      | Every 6-8 videos in `/feed`              | Scroll        |
| Native       | Mid-grid          | Between rows on tag/character pages      | Page load     |
| Interstitial | Full-screen       | Between page navigations (max 1/5 pages) | Navigation    |

### Future (Phase 3+)

- Push notifications (ProPush)
- Nutaku game affiliate links
- Premium tier (ad-free)

---

## Technical Architecture

### Stack

- **Framework**: Next.js 15 App Router
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript strict
- **Hosting**: Hetzner VPS CX23 (4.79€/mo) + Coolify
- **Domain**: iku.gg (Porkbun)
- **Video delivery**: Direct from Danbooru CDN (cdn.donmai.us) — zero bandwidth on our side
- **Search**: Client-side tag filtering initially, Meilisearch later

### Data Flow

```
User visits /watch/xxx
      ↓
Next.js SSR fetches Danbooru API → post data
      ↓
Renders full HTML with meta tags, schema, video player
      ↓
Client hydrates → video autoplay
      ↓
Related videos loaded client-side
      ↓
User clicks tag → /tag/milf (SSR)
      ↓
User clicks "swipe mode" → /feed?tag=milf (CSR)
```

### SEO Technical

- All `/watch/`, `/tag/`, `/character/` pages are SSR (full HTML on first request)
- Dynamic XML sitemaps auto-generated from Danbooru catalog
- `<meta name="rating" content="adult">` on all pages
- Canonical URLs on every page
- Internal linking: every tag pill links to `/tag/`, every character links to `/character/`
- Pagination via `?page=2` (not infinite scroll) on listing pages — Google needs links to crawl

### File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, dark theme, fonts, meta
│   ├── page.tsx                # Homepage (trending + categories)
│   ├── watch/
│   │   └── [slug]/page.tsx     # Video page (SSR)
│   ├── tag/
│   │   └── [tag]/page.tsx      # Tag listing (SSR)
│   ├── character/
│   │   └── [name]/page.tsx     # Character page (SSR)
│   ├── trending/page.tsx       # Trending (SSR)
│   ├── new/page.tsx            # Newest (SSR)
│   ├── feed/page.tsx           # Swipe feed (CSR)
│   ├── search/page.tsx         # Search (CSR)
│   ├── sitemap.xml/route.ts    # Sitemap index
│   ├── sitemap/
│   │   ├── videos/[page]/route.ts
│   │   ├── tags/route.ts
│   │   └── characters/route.ts
│   └── api/
│       ├── feed/route.ts       # Feed API (paginated videos)
│       ├── search/route.ts     # Search API
│       └── related/route.ts    # Related videos API
├── components/
│   ├── VideoPlayer.tsx         # Our custom player with ad hooks
│   ├── VideoCard.tsx           # Thumbnail card for grids
│   ├── SwipeFeed.tsx           # TikTok vertical feed
│   ├── SwipeVideoCard.tsx      # Full-screen video in feed
│   ├── TagPill.tsx             # Clickable tag
│   ├── VideoGrid.tsx           # Grid layout for listings
│   ├── Pagination.tsx          # SSR pagination
│   ├── SearchBar.tsx           # Search input
│   ├── AgeGate.tsx             # 18+ verification
│   ├── AdZone.tsx              # ExoClick ad container
│   └── RelatedVideos.tsx       # Related videos section
├── lib/
│   ├── danbooru.ts             # Danbooru API client
│   ├── seo.ts                  # Meta tag & schema generators
│   ├── slugify.ts              # Slug generation from post data
│   └── ads.ts                  # ExoClick integration helpers
└── types/
    └── video.ts                # Shared types
```

---

## Design / Visual

- **Dark theme**: Background #0a0a0a, Surface #1a1a1a, Border #2a2a2a
- **Accent**: Pink/purple gradient (#e879f9 → #a855f7)
- **Font**: Inter (UI) via Google Fonts
- **Mobile-first**: Design for 375px, scale up
- **Thumbnails**: 16:9 aspect ratio, lazy loaded, blurhash placeholder
- **Video player**: Dark, minimal chrome, big play button, mute toggle
- **Grid**: 2 columns mobile, 3 tablet, 4 desktop
- **No light mode** — dark only

---

## Phase Plan

### Phase 1: Launch (this session)

- All SSR pages (watch, tag, character, trending, new)
- Danbooru API integration
- Video player with our controls
- Age gate
- Sitemap generation
- SEO meta tags + schema
- Deploy on iku.gg

### Phase 2: Engagement (week 2)

- Swipe feed on /feed
- ExoClick ad integration
- Search functionality
- Related videos algorithm
- hanime.tv batch download pipeline

### Phase 3: Scale (month 2)

- Gelbooru content integration
- Push notifications (ProPush)
- User favorites (localStorage)
- Recommendation engine (tag-based)
- Google Search Console optimization

### Phase 4: Monetize (month 3)

- ExoClick optimization
- Nutaku affiliate integration
- Premium tier (ad-free)
- A/B testing ad placements

---

## Success Metrics

| Metric               | Target (Month 3) | Target (Month 6) |
| -------------------- | ---------------- | ---------------- |
| Pages indexed        | 50K+             | 65K+             |
| Organic visits/month | 50K              | 200K             |
| RPM                  | $2-4             | $5-10            |
| Revenue/month        | $200-500         | $1K-3K           |
| Avg session duration | 3+ min           | 5+ min           |
