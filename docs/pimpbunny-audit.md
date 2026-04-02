# PimpBunny.com - Complete UX/UI Audit
> Audited live on 2026-04-01 via browser automation

---

## 1. HOMEPAGE LAYOUT

### Structure (top to bottom)
1. **Pre-header banner** - Full-width gradient bar (purple-to-pink), 45px tall. Promotional text: "1,000,000+ premium videos in one subscription" with a CTA button "AVOIR ACCES" (localized)
2. **Secondary nav bar** - Small links row: partner/affiliate links (PimpBunny Live, VR Porn, AI Porn Chat, Lesbian Porn, XXBRITS, NSFW Tools, Live Sex Cams, Porn Dude, Live Porn, Amateur Porn, Fetish Porn, JAV Porn, Rule 34) + language selector (EN/ES/FR/PT/DE/IT/CN/JP/RU/TR)
3. **Main header** - Logo (left), search bar (center), action buttons (right: dark mode toggle, Watch Live Porn, AI Cumsluts, Upload & Earn, user icon)
4. **Primary nav** - Horizontal links: HOME, VIDEOS (dropdown), MODELS (dropdown), CATEGORIES (dropdown), LIVE SEX, TIKTOK PORN, LIVE GIRLS, SEX-DATER, UNDRESS AI, AI JERK OFF, BLACKED IS FREE + right-aligned utility links: Discord, Become A Model, Affiliate Program, Go Premium
5. **"FEATURED VIDEOS" section** - H2 heading, centered, uppercase, display font
6. **Video grid** - 5 columns at full width (1780px container), flex-wrap row
7. **"Newest Models" section** - Below video grid (H1 tag)
8. **Footer** - Logo (SVG), columns: Upgrade, Videos, Albums, Models, Categories, Tags, Upload (Video/Photos), Articles, Users, Partners, Support, Advertise, Affiliate Program, Discord icon, Terms, Privacy Policy, 2257, DMCA, Content Removal, Become A Model, Porn Sites, Porn Sites For Sale, Vicetemple

### Grid Layout
- Bootstrap-style responsive grid using `row-cols-*` classes
- `row-cols-1` (mobile) -> `row-cols-sm-2` -> `row-cols-md-3` -> `row-cols-lg-3` -> `row-cols-xl-4` -> `row-cols-xxl-5` (desktop)
- Column gutter: 10px left padding, -10px row margin (20px total gap)
- Container: full width with no max-width constraint (1780px measured at full viewport)

---

## 2. NAVIGATION

### Top Bar (Secondary)
- Small gray text links, all external partner/affiliate links
- Language selector with flag icon + "EN" text + dropdown chevron
- Font: Roboto Condensed, small size

### Main Header
- **Left**: SVG logo "PIMPBUNNY" with bunny ears icon
- **Center**: Search input field (pill-shaped, 30px border-radius)
- **Right**: Dark mode toggle (moon icon), "WATCH LIVE PORN" button (dark), "AI CUMSLUTS" button (dark), "Upload & Earn" button (pink primary), User avatar icon

### Primary Nav
- Horizontal list, uppercase, bold 700, 18px, Roboto Condensed
- Active link: pink `rgb(242, 97, 184)`
- Inactive links: dark purple `rgb(51, 24, 45)`
- Dropdowns on VIDEOS (Most Recent, Most Viewed, Best Rated, Exclusive), MODELS (All Models, Verified, Open to Collab), CATEGORIES (22 categories listed in dropdown)
- Some items are affiliate links (Live Sex, TikTok Porn, Live Girls, etc.)
- Right side has utility links with icons (Discord, Become A Model, Affiliate Program, Go Premium)

### No Bottom Nav
- No mobile bottom navigation visible
- No sidebar on homepage

---

## 3. COLOR SCHEME

### Primary Palette
| Token | Value | Usage |
|-------|-------|-------|
| **Dark Purple** | `rgb(51, 24, 45)` / `#33182D` | Body text, nav inactive, headings, secondary buttons bg |
| **Hot Pink** | `rgb(242, 97, 184)` / `#F261B8` | Primary accent, active nav, CTA buttons, model name links, 4K badge, active pagination, sort filter active |
| **White** | `rgb(255, 255, 255)` / `#FFFFFF` | Page background, button text |
| **Semi-transparent dark** | `rgba(51, 24, 45, 0.5)` | Duration badge overlay on thumbnails |
| **Semi-transparent border** | `rgba(51, 24, 45, 0.1)` | Search input border (3px solid) |

### Gradient
- Pre-header banner uses a purple-to-pink gradient (left to right)

### Dark Mode
- Has a theme switcher toggle (`.includes-header-theme-switcher__Lu7k8J`) - moon icon button in header

---

## 4. TYPOGRAPHY

### Fonts (Google Fonts, self-hosted @font-face)
1. **Londrina Solid** - Display/heading font (section titles like "FEATURED VIDEOS", "CATEGORIES")
2. **Roboto Condensed** - Primary body font (everything else: nav, cards, info text, buttons)

### Type Scale
| Element | Font | Size | Weight | Transform | Color |
|---------|------|------|--------|-----------|-------|
| Body | Roboto Condensed | 18px | 400 | none | `rgb(51, 24, 45)` |
| Section H2 ("Featured Videos") | Londrina Solid | 28px | 400 | uppercase | `rgb(51, 24, 45)` |
| Section H1 ("Newest Models") | Londrina Solid | 28px | 400 | uppercase | `rgb(51, 24, 45)` |
| Primary nav links | Roboto Condensed | 18px | 700 | uppercase | `rgb(51, 24, 45)` / pink when active |
| Video card title | Roboto Condensed | 16px | 700 | none | `rgb(51, 24, 45)` |
| Video card info | Roboto Condensed | 14px | 400 | none | `rgb(51, 24, 45)` |
| Model name link | Roboto Condensed | 14px | 400 | none | `rgb(242, 97, 184)` (pink) |
| Duration badge | Roboto Condensed | 14px | 400 | none | white |
| Category card title | Roboto Condensed | 20px | 700 | capitalize | `rgb(51, 24, 45)` |
| Sort filter active | Roboto Condensed | 18px | 700 | uppercase | `rgb(242, 97, 184)` |
| Buttons | Roboto Condensed | 15-18px | 500 | none | white |

---

## 5. VIDEO THUMBNAIL CARDS

### Card Structure (HTML)
```
ui-card-root (div)
  ui-card-link (a) -> /videos/slug/
    ui-card-image (div, padding-bottom: 56.25% = 16:9)
      ui-card-thumbnail (img, lazy-load, 800x450)
      ui-card-duration (div, absolute bottom-right)
        "5:34"
        ui-card-pbn-4k (span, optional) "4K"
    ui-card-title (div, text-truncate) "Video Title Here"
  ui-card-info-wrapper (div)
    ui-card-related-models (div)
      a.accent -> model name (pink link)
    ui-card-info (div)
      [eye icon SVG] "18K"
      [thumbs up icon SVG] "94%"
      "8 hours ago"
```

### Card Details
- **Aspect ratio**: 16:9 (padding-bottom: 56.25%)
- **Thumbnail size**: 800x450px source images
- **Border radius**: 0px (no rounded corners on cards)
- **Background**: transparent
- **Padding/margin**: 0px
- **Title**: Single line, truncated with `text-truncate` (CSS ellipsis)

### Duration Badge
- Position: absolute, bottom: 10px, right: 10px
- Background: `rgba(51, 24, 45, 0.5)` (semi-transparent dark purple)
- Color: white
- Border radius: 5px
- Padding: 0 5px
- Font: 14px Roboto Condensed

### 4K Badge
- Inline next to duration
- Background: `rgb(242, 97, 184)` (hot pink)
- Color: white
- Border radius: 5px
- Padding: 0 5px
- Font: 14px

### AD Badge
- Orange "AD" badge appears on sponsored video cards

### Hover Effect
- **Video preview on hover**: Each thumbnail has `data-preview` attribute pointing to a `.mp4` preview file
- On hover, the static thumbnail gets replaced by a video preview playing inline

### Info Row
- Model name(s) in pink, comma-separated
- Eye icon + view count (e.g., "18K")
- Thumbs-up icon + percentage (e.g., "94%")
- Relative time (e.g., "8 hours ago")
- Some models have a verification badge (checkmark icon)

---

## 6. VIDEO PLAYER PAGE (`/videos/slug/`)

### Layout
- **2-column layout**: Main content (col-10 col-lg / ~70%) + Sidebar (col-lg-auto / ~30%, ads)
- Same header/nav as homepage

### Structure (top to bottom in main column)
1. **Pre-header ad banner** (gradient, same as homepage)
2. **Video player** - Full width of main column, 16:9 aspect ratio, HTML5 video player with quality selector (1080p, 720p, 480p, 360p), no subtitles option
3. **Ad banner below player** (inline)
4. **Video title** - H1-styled heading (`ui-heading-h1`), bold, Roboto Condensed
5. **Meta row**: Eye icon + "20K" views, "8 hours ago" timestamp
6. **Actions row** (right-aligned): Like (33) / Dislike (2) buttons with thumbs SVG icons, Download button, more actions
7. **Model info section** (`pages-view-video-info`): Model avatar image, model name as H3 link, "Subscribe" button (tertiary style)
8. **Tags**: Tag links (e.g., "Big Ass Blonde", "Blonde", "Hot Blonde", "Beach", "Sex", "Outdoor", "Beautiful")
9. **Comments section**: Toggle "Comments (3)", user comments with timestamps and vote counts
10. **Report/flag section** (hidden by default)

### Right Sidebar
- Display ad (300px wide area, dark background)
- Live cam widget (bottom-right corner overlay with "LIVE" badge)

### Below Main Content
- **Promoted Models** section (horizontal carousel)
- **Promoted Videos** section
- **Similar Videos** grid (same card layout as homepage)

---

## 7. CATEGORY/TAG PAGES

### Categories Index (`/categories/`)
- Same header/nav
- H2 "CATEGORIES" centered, Londrina Solid uppercase
- **Grid**: Same responsive row-cols system as homepage
- **Category cards**:
  - Aspect ratio: 1:1 (padding-bottom: 100%) - square thumbnails
  - Title: 20px, bold 700, capitalize, Roboto Condensed
  - Video count: "2144 videos" in small text below title
  - No border radius, no special styling

### Videos Listing Page (`/videos/`)
- **Left Sidebar** (340px width, 60px right padding):
  - **Duration filter**: "DURATION MINUTES" heading + ion.rangeSlider (0-30 min)
  - **Categories list**: All (82,182), 4K (2,164), Anal (4,793), BBC (3,383), BDSM (639), Big Boobs (5,261), etc.
- **Sort tabs** (centered above grid): MOST RECENT | MOST VIEWED | BEST RATED | EXCLUSIVE
  - Active: pink, bold, uppercase
  - Inactive: darker, lighter weight
- **Video grid**: 4 columns in main content area
- **Pagination** at bottom:
  - "Show: 32 | 64 | 96 | 128" per-page selector
  - Page numbers: 1, 2, 3, 4, 5, ..., 2569
  - Active page: pink circle (40x40px, border-radius: 50%, bg: `rgb(242, 97, 184)`, white text)
  - Inactive: transparent bg, dark text
  - Next arrow: SVG chevron icon
  - Gap between items: 2px

---

## 8. SEARCH

- Search bar in main header, center-positioned
- Input: pill-shaped (border-radius: 30px), 40px height, 18px font
- Border: 3px solid `rgba(51, 24, 45, 0.1)`
- Background: transparent
- Placeholder: "Search"
- Submit button with magnifying glass SVG icon
- Close/clear button (X icon, hidden until active)
- Form action: `https://pimpbunny.com/search/` with `?q=` GET parameter
- No visible autocomplete observed (may load via JS)

---

## 9. MOBILE UX

- Responsive grid: 1 column on mobile, 2 on sm, 3 on md, 4 on xl, 5 on xxl
- Buttons have mobile-specific text variants (e.g., "AI CUMSLUTS" becomes "AI" on mobile via `d-none d-xl-block` / `d-xl-none` classes)
- Duration filter has separate mobile rendering (`d-md-none` class)
- No bottom navigation bar
- Viewport meta: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0`

---

## 10. WHAT MAKES IT LOOK PREMIUM

### Spacing
- Footer padding: 80px top/bottom
- Card grid gutters: 20px
- Section margins generous (40px row-gap class `gy-40`)
- Header sections have clear vertical separation

### Polish Details
- **Video preview on hover**: MP4 preview plays inline when hovering thumbnails (data-preview attribute on each img)
- **Lazy loading**: Images use lazy-load class, loading on scroll
- **WebP support**: data-webp attribute for modern image format
- **SVG icons throughout**: Custom SVG icons for views, likes, navigation (not icon fonts)
- **Consistent pink accent**: One single accent color used everywhere (active states, CTAs, badges, model names)
- **Text truncation**: All card titles are single-line with ellipsis overflow
- **Pill-shaped buttons**: All CTA buttons use 30-40px border-radius
- **Minimal card design**: No borders, no shadows, no background on cards - content speaks
- **Dark mode toggle**: Moon icon in header for theme switching
- **Clean typography hierarchy**: Only 2 fonts, clear size/weight differentiation

### Animations
- Owl Carousel for model/promoted content sections
- Fancybox for modals/lightboxes (login, messaging)
- ion.rangeSlider for duration filter
- Select2 for enhanced dropdowns

---

## 11. LOGO

- **Type**: SVG (inline, not image file)
- **Text**: "PIMPBUNNY" in custom bold lettering
- **Icon**: Stylized bunny ears above the "P" - two curved pink strokes forming ears
- **Color**: Hot pink `rgb(242, 97, 184)` for the bunny ears icon, dark purple `rgb(51, 24, 45)` for the text
- **Size**: 245x40 viewBox in footer, proportionally similar in header
- **Style**: Bold condensed uppercase, playful but clean
- **OG image fallback**: `/static/images/logo.png`

---

## 12. AD PLACEMENT

### Observed Ad Locations
1. **Pre-header banner**: Full-width gradient bar at very top (premium subscription promo)
2. **Secondary nav links**: All external links in secondary nav are affiliate/partner links
3. **Primary nav items**: Some nav items are affiliate links (Live Sex, TikTok Porn, Live Girls, Sex-Dater, Undress AI, AI Jerk Off, Blacked Is Free)
4. **Header CTA buttons**: "Watch Live Porn" and "AI Cumsluts" are ad links
5. **Video card AD badge**: Sponsored video cards marked with orange "AD" badge on thumbnail
6. **Video page sidebar**: 300px-wide ad column on right side of video player
7. **Below video player**: Inline ad banner
8. **Bottom-right corner overlay**: Live cam widget with "LIVE" badge and model thumbnail (floating, can be closed with "Close ad x" button)
9. **Popunder**: Script loaded from `adsession.exacdn.com/popunder1000.js`
10. **Promoted sections on video page**: "Promoted Models" and "Promoted Videos" sections

### Ad Networks Used
- ExoClick (exacdn.com, pemsrv.com, magsrv.com)
- TrafficStars (tsyndicate.com)
- PopMagic (popunder)
- BlueTrafficStream (live cams widget)
- Various direct affiliate links

---

## 13. TECHNICAL STACK

### Frontend
- **No major JS framework** - vanilla JS with jQuery
- **CSS**: Custom CSS with BEM-like hashed class names (e.g., `ui-card-root__0dWeQJ`) suggesting CSS Modules or similar build tool
- **Grid**: Bootstrap-inspired row/col system (not full Bootstrap, custom implementation)
- **Libraries**:
  - Fancybox (lightbox/modals)
  - Owl Carousel (carousels)
  - ion.rangeSlider (duration filter)
  - Select2 (enhanced selects)
- **Assets**: Versioned CSS (`core.a1b1c9.css`, `modules.a1b3c4.css`)

### Fonts
- Google Fonts: Londrina Solid + Roboto Condensed (preconnected, self-hosted via @font-face)

### SEO/Meta
- Title: "Watch Porn & Chat With Models | PimpBunny"
- OG tags: url, title, image, description, type=website
- Twitter card: summary_large_image
- Sitemap: `https://pimpbunny.com/sitemap.xml`
- Robots.txt: Allows Googlebot, Bingbot, DuckDuckBot, Yandex, Baiduspider, Bravebot, AhrefsBot. Blocks all AI bots. Crawl-delay: 10s
- i18n: 10 language versions (EN/ES/FR/PT/DE/IT/CN/JP/RU/TR) via `/lang/` URL prefix

### Hosting
- Cloudflare (robots.txt managed section, CDN)
- Thumbnail CDN: own domain (`/contents/videos_screenshots/`)
- Video preview CDN: own domain (`/get_file/`)

---

## 14. DESIGN TOKENS SUMMARY (for iku.gg implementation)

```css
:root {
  /* Colors */
  --color-primary: #F261B8;        /* Hot pink - accent, CTAs, active states */
  --color-text: #33182D;           /* Dark purple - all body text */
  --color-bg: #FFFFFF;             /* White background */
  --color-duration-bg: rgba(51, 24, 45, 0.5);  /* Duration overlay */
  --color-input-border: rgba(51, 24, 45, 0.1); /* Search border */

  /* Typography */
  --font-display: 'Londrina Solid', sans-serif;  /* Section headings */
  --font-body: 'Roboto Condensed', sans-serif;   /* Everything else */

  /* Spacing */
  --grid-gap: 20px;
  --section-gap: 40px;
  --footer-padding: 80px;

  /* Radius */
  --radius-button: 40px;       /* Pill buttons */
  --radius-search: 30px;       /* Search input */
  --radius-badge: 5px;         /* Duration/4K badges */
  --radius-pagination: 50%;    /* Circular pagination */

  /* Sizes */
  --pagination-size: 40px;
  --search-height: 40px;
  --sidebar-width: 340px;
  --thumbnail-ratio: 56.25%;   /* 16:9 video cards */
  --category-ratio: 100%;      /* 1:1 category cards */
}
```

---

## 15. KEY TAKEAWAYS FOR IKU.GG

1. **Two-font system**: One display font for section headings (Londrina Solid), one workhorse font for everything else (Roboto Condensed). For a hentai site, swap Londrina Solid for something anime-appropriate.
2. **Single accent color strategy**: Pink used EVERYWHERE as the only accent - active nav, buttons, badges, model names, pagination. Creates instant brand recognition.
3. **Dark purple text instead of black**: `#33182D` instead of `#000000` gives a warmer, more premium feel.
4. **Cards are intentionally minimal**: No borders, no shadows, no background, no rounded corners. Content-first design.
5. **Video preview on hover is essential**: The MP4 preview on thumbnail hover is the single most important UX feature for engagement.
6. **Sidebar only on listing pages**: Homepage = no sidebar (full-width grid). Videos page = left sidebar with filters.
7. **Pagination with per-page selector**: Users can choose 32/64/96/128 videos per page.
8. **Aggressive monetization hidden in plain sight**: Many "nav items" are actually affiliate links. Ad placements are everywhere but don't feel overwhelming because they match the design language.
9. **i18n from day 1**: 10 languages supported.
10. **Bootstrap-like but custom**: Not actual Bootstrap - custom row/col system with hashed CSS module class names.
