# Homepage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the homepage to match hanime.tv's curated editorial style with poster cards, better visual hierarchy, SEO-optimized sections, and ad-ready layout zones.

**Architecture:** The homepage (`src/app/page.tsx`) is a Server Component that fetches data from `getVideos()` and renders carousels. The CSS is in `globals.css` with `v2-` prefixed classes. We keep this architecture but upgrade the visual quality, add new sections (Popular Series, Popular Characters with thumbnails), improve the hero, and add ad placeholder zones. No new dependencies.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, vanilla CSS in `globals.css`, existing `getVideos()` / `getPopularTags()` / `getPopularCharacters()` data layer.

---

### Task 1: Upgrade Hero Section — Featured Video with Full-Bleed Background

**Files:**

- Modify: `src/app/globals.css` (search for `.v2-site-hero` and `.v2-hero` sections)
- Modify: `src/app/page.tsx:64-160`

**What changes:** Merge the two hero sections (brand hero + trending hero) into one impactful hero. The current design has a generic brand hero THEN a trending hero — this wastes above-the-fold space. Top sites (PornHub, hanime.tv) put the featured content directly in the hero.

- [ ] **Step 1: Merge the two hero sections in page.tsx**

Replace lines 64-160 (both hero sections) with a single hero that shows the #1 trending video as a full-bleed background, with the brand messaging overlaid:

```tsx
{
  /* ══ HERO — Featured Video + Brand ═══════════════════ */
}
<section
  className="hp-hero"
  style={
    hero?.preview
      ? {
          backgroundImage: `url(${hero.preview})`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }
      : undefined
  }
>
  <div className="hp-hero__overlay" />
  <div className="hp-hero__content">
    <span className="hp-hero__badge">
      <span className="hp-hero__badge-dot" />
      Trending #1
    </span>
    <h1 className="hp-hero__title">
      {heroTitle}
      <span className="hp-hero__title-dot">.</span>
    </h1>
    <div className="hp-hero__meta">
      <span>{new Date().getFullYear()}</span>
      <span className="hp-hero__meta-sep">·</span>
      <span>HD 1080P</span>
      <span className="hp-hero__meta-sep">·</span>
      {hero && (
        <span className="hp-hero__score">★ {hero.score.toLocaleString()}</span>
      )}
    </div>
    <div className="hp-hero__tags">
      {heroTags.map((tag) => (
        <span key={tag} className="hp-hero__tag">
          {tag.replace(/_/g, " ")}
        </span>
      ))}
    </div>
    <div className="hp-hero__actions">
      {hero && (
        <Link href={`/watch/${hero.slug}`} className="hp-btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Watch Now
        </Link>
      )}
      <Link href="/trending" className="hp-btn-secondary">
        Trending Now
      </Link>
    </div>
    <p className="hp-hero__sub">
      353,000+ free animated hentai clips · Updated daily
    </p>
  </div>
</section>;
```

- [ ] **Step 2: Add the new hero CSS in globals.css**

Add after the existing v2-hero section (or replace it):

```css
/* ══ Homepage Hero ══════════════════════════════════════ */
.hp-hero {
  position: relative;
  min-height: 70vh;
  display: flex;
  align-items: flex-end;
  padding: 0 24px 48px;
  background: #0a0a0a;
  overflow: hidden;
}
@media (max-width: 768px) {
  .hp-hero {
    min-height: 60vh;
    padding: 0 16px 32px;
  }
}
.hp-hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(10, 10, 10, 1) 0%,
    rgba(10, 10, 10, 0.85) 30%,
    rgba(10, 10, 10, 0.4) 60%,
    rgba(10, 10, 10, 0.2) 100%
  );
  z-index: 1;
}
.hp-hero__content {
  position: relative;
  z-index: 2;
  max-width: 640px;
}
.hp-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(232, 70, 124, 0.15);
  border: 1px solid rgba(232, 70, 124, 0.3);
  color: #e8467c;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  border-radius: 20px;
  margin-bottom: 16px;
}
.hp-hero__badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e8467c;
  animation: hp-pulse 2s ease infinite;
}
@keyframes hp-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.hp-hero__title {
  font-family: var(--font-poppins), sans-serif;
  font-size: clamp(28px, 5vw, 48px);
  font-weight: 800;
  color: #fff;
  line-height: 1.1;
  margin: 0 0 12px;
}
.hp-hero__title-dot {
  color: #e8467c;
}
.hp-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
}
.hp-hero__meta-sep {
  opacity: 0.3;
}
.hp-hero__score {
  color: #f59e0b;
}
.hp-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}
.hp-hero__tag {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.08);
  padding: 3px 10px;
  border-radius: 12px;
  text-transform: capitalize;
}
.hp-hero__actions {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.hp-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #e8467c, #c2255c);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.hp-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(232, 70, 124, 0.4);
}
.hp-btn-secondary {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.15s ease;
}
.hp-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.14);
}
.hp-hero__sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}
```

- [ ] **Step 3: Remove old hero CSS classes**

Search `globals.css` for `.v2-site-hero` and `.v2-hero` blocks and remove them (they're replaced by `.hp-hero`).

- [ ] **Step 4: Verify the page renders**

Run: `npm run dev` and check `http://localhost:3000`
Expected: Single hero section with trending video background, title, tags, Watch Now button.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat(homepage): merge dual hero into single featured-video hero"
```

---

### Task 2: Add Ad Placeholder Zones

**Files:**

- Modify: `src/app/page.tsx` (add ad zones between sections)
- Modify: `src/app/globals.css` (add `.hp-ad-zone` styles)

**What changes:** Add clearly marked ad placeholder divs between content sections. These are invisible by default and will be activated when ExoClick is integrated. The layout reserves space for them so adding ads later doesn't shift content.

- [ ] **Step 1: Create ad zone component inline**

Add this above the `HomePage` function in `page.tsx`:

```tsx
function AdZone({
  id,
  size,
}: {
  id: string;
  size: "leaderboard" | "medium-rect";
}) {
  return (
    <div
      className={`hp-ad-zone hp-ad-zone--${size}`}
      data-ad-slot={id}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: Place ad zones between content sections**

In the JSX, add:

- After the hero, before the tags row: `<AdZone id="hp-leaderboard-1" size="leaderboard" />`
- After the "Top Rated" carousel, before "New Releases": `<AdZone id="hp-medium-1" size="medium-rect" />`

- [ ] **Step 3: Add ad zone CSS**

```css
/* ══ Ad placeholder zones (invisible until ads activated) ══ */
.hp-ad-zone {
  display: none; /* hidden until ads integrated */
  margin: 24px auto;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  text-align: center;
}
.hp-ad-zone--leaderboard {
  max-width: 728px;
  height: 90px;
}
.hp-ad-zone--medium-rect {
  max-width: 300px;
  height: 250px;
}
/* When ads are active, show the zones */
.ads-active .hp-ad-zone {
  display: block;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat(homepage): add ad placeholder zones for future ExoClick integration"
```

---

### Task 3: Add Popular Series Section

**Files:**

- Modify: `src/app/page.tsx` (add series carousel)
- Read: `src/data/series.ts` (understand series data structure)

**What changes:** Add a "Popular Series" carousel between Trending and Top Rated. Shows series like Naruto, One Piece, Genshin Impact with character count. Links to `/series/[slug]`. This improves SEO internal linking (cocon sémantique).

- [ ] **Step 1: Import series data**

Add import at top of `page.tsx`:

```tsx
import { SERIES } from "@/data/series";
```

- [ ] **Step 2: Add series carousel after Trending**

After the Trending carousel (line ~184), add:

```tsx
{
  /* ── Popular Series ──────────────────────────────────── */
}
<Carousel title="Popular Series" seeAllHref="/series">
  {SERIES.slice(0, 12).map((series, i) => {
    const gradient = CHAR_GRADIENTS[i % CHAR_GRADIENTS.length];
    const initials = series.name
      .split(" ")
      .map((w) => w[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("");
    return (
      <Link
        key={series.slug}
        href={`/series/${series.slug}`}
        className="v2-char-card"
      >
        <div className="v2-char-card__avatar" style={{ background: gradient }}>
          <span className="v2-char-card__initials">{initials}</span>
        </div>
        <div className="v2-char-card__name">{series.name}</div>
        <div className="v2-char-card__count">
          {series.characters.length} characters
        </div>
      </Link>
    );
  })}
</Carousel>;
```

- [ ] **Step 3: Verify and commit**

Run: `npm run dev`, check homepage has "Popular Series" carousel.

```bash
git add src/app/page.tsx
git commit -m "feat(homepage): add Popular Series carousel for SEO internal linking"
```

---

### Task 4: Improve Popular Characters with Links to Character Pages

**Files:**

- Modify: `src/app/page.tsx` (fix character links to go to `/character/[slug]` instead of `/tag/`)

**What changes:** Currently characters link to `/tag/character_name` which is wrong — they should link to `/character/character_name`. This is critical for the SEO cocon sémantique.

- [ ] **Step 1: Fix character href**

In the Popular Characters carousel (~line 211), change:

```tsx
// FROM:
href={`/tag/${encodeURIComponent(char.name)}`}
// TO:
href={`/character/${encodeURIComponent(char.name)}`}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix(homepage): characters link to /character/ pages for SEO cocon"
```

---

### Task 5: Add SEO-Optimized Footer with Internal Links

**Files:**

- Modify: `src/app/page.tsx` (expand footer)
- Modify: `src/app/globals.css` (add footer styles)

**What changes:** The current footer has 3 links (Terms, Privacy, DMCA). Add a rich footer with columns for Browse (trending, new, explore), Characters (top 6), Series (top 6), About (blog, glossary, terms). This is massive for SEO internal linking.

- [ ] **Step 1: Replace the footer in page.tsx**

Replace the existing footer (lines ~286-293) with:

```tsx
<footer className="hp-footer">
  <div className="hp-footer__grid">
    <div className="hp-footer__col">
      <h3 className="hp-footer__heading">Browse</h3>
      <Link href="/trending" className="hp-footer__link">
        Trending
      </Link>
      <Link href="/new" className="hp-footer__link">
        New Releases
      </Link>
      <Link href="/explore" className="hp-footer__link">
        Explore All
      </Link>
      <Link href="/tags" className="hp-footer__link">
        All Tags
      </Link>
      <Link href="/feed" className="hp-footer__link">
        Video Feed
      </Link>
    </div>
    <div className="hp-footer__col">
      <h3 className="hp-footer__heading">Characters</h3>
      {characters.slice(0, 6).map((c) => (
        <Link
          key={c.name}
          href={`/character/${encodeURIComponent(c.name)}`}
          className="hp-footer__link"
        >
          {c.name.replace(/_/g, " ")}
        </Link>
      ))}
    </div>
    <div className="hp-footer__col">
      <h3 className="hp-footer__heading">Series</h3>
      {SERIES.slice(0, 6).map((s) => (
        <Link
          key={s.slug}
          href={`/series/${s.slug}`}
          className="hp-footer__link"
        >
          {s.name}
        </Link>
      ))}
    </div>
    <div className="hp-footer__col">
      <h3 className="hp-footer__heading">About</h3>
      <Link href="/blog" className="hp-footer__link">
        Blog
      </Link>
      <Link href="/glossary" className="hp-footer__link">
        Glossary
      </Link>
      <a href="/terms" className="hp-footer__link">
        Terms
      </a>
      <a href="/privacy" className="hp-footer__link">
        Privacy
      </a>
      <a href="/dmca" className="hp-footer__link">
        DMCA
      </a>
    </div>
  </div>
  <div className="hp-footer__bottom">
    <span className="hp-footer__logo">iku</span>
    <p className="hp-footer__copy">
      &copy; {new Date().getFullYear()} iku.gg — All rights reserved. 18+ only.
    </p>
  </div>
</footer>
```

- [ ] **Step 2: Add footer CSS**

```css
/* ══ Homepage Footer ════════════════════════════════════ */
.hp-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 48px 24px 24px;
  margin-top: 48px;
}
.hp-footer__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 32px;
  max-width: 900px;
  margin: 0 auto 32px;
}
.hp-footer__heading {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 12px;
}
.hp-footer__link {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  padding: 3px 0;
  transition: color 0.15s ease;
}
.hp-footer__link:hover {
  color: #e8467c;
}
.hp-footer__bottom {
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  padding-top: 20px;
}
.hp-footer__logo {
  font-family: var(--font-righteous), cursive;
  font-size: 20px;
  background: linear-gradient(135deg, #e8467c, #7b2ff7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hp-footer__copy {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  margin-top: 8px;
}
```

- [ ] **Step 3: Remove old footer CSS**

Search `globals.css` for `.v2-footer` and remove those rules.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat(homepage): rich SEO footer with character/series/browse internal links"
```

---

### Task 6: Final Polish — Clean Up Old CSS Prefixes

**Files:**

- Modify: `src/app/globals.css`

**What changes:** Remove all unused `v2-site-hero` and `v2-hero` CSS rules that were replaced by `hp-hero`. Keep `v2-` prefixed classes that are still used by other pages (AppShell, content area, tags, etc.).

- [ ] **Step 1: Search and remove dead CSS**

In `globals.css`, find and remove these blocks:

- `.v2-site-hero` and all `.v2-site-hero__*` rules
- `.v2-hero` and all `.v2-hero__*` rules
- `.v2-btn-play` and `.v2-btn-info` (replaced by `.hp-btn-primary` and `.hp-btn-secondary`)
- `.v2-footer` and all `.v2-footer__*` rules

Do NOT remove:

- `.v2-page`, `.v2-content`, `.v2-tags-row`, `.v2-tag-chip` (still used)
- `.v2-char-card` (still used by characters and series carousels)
- `.v2-tags-section`, `.v2-tag-pill` (still used by popular tags)
- `.v2-learn-section`, `.v2-learn-*` (still used by learn section)

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "chore(homepage): remove dead v2-hero and v2-footer CSS classes"
```

---

### Task 7: Build Verification

- [ ] **Step 1: Run the build**

```bash
NODE_OPTIONS='--max-old-space-size=6144' npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Test in dev mode**

```bash
npm run dev
```

Check:

- Homepage renders with single hero (trending #1 background)
- "Trending This Week" carousel works
- "Popular Series" carousel shows series
- "Top Rated" carousel works
- "New Releases" carousel works
- "Popular Characters" links go to `/character/[name]`
- Rich footer with 4 columns of links
- Ad placeholder zones exist in DOM (hidden)
- Mobile responsive (test at 375px width)

- [ ] **Step 3: Final commit and push**

```bash
git add -A
git commit -m "feat(homepage): complete redesign — hero, series, SEO footer, ad zones"
git push
```
