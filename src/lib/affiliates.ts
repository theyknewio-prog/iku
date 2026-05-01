/**
 * affiliates.ts — Master list of AI girlfriend/companion affiliate programs.
 *
 * This is the single source of truth for affiliate data.
 * AffiliateCard, AffiliateRail, and the /go/[slug] route all read from here.
 *
 * Thumbnails point to CrakRevenue's hosted CDN creatives (imglnkx.com).
 * imglnkx is whitelisted in CSP img-src + media-src. Using the network's
 * own creatives means: (a) zero asset upload burden, (b) creatives stay
 * fresh as the network rotates them server-side, (c) visual style matches
 * the routed offer (Smartlink rotates 30+ AI offers behind any /go/* URL).
 *
 * Two CrakRevenue 300x250 creatives are currently in rotation; we alternate
 * across the 8 cards for visual variety. Pull more sizes/themes from the
 * CrakRevenue Creatives library and slot them in here as needed.
 */

const CRAK_HENTAI_300x250 =
  "https://www.imglnkx.com/9403/ADV-1207_DESIGN-21652_Hentai-Banners_300250.jpg";
const CRAK_GENERIC_300x250 =
  "https://www.imglnkx.com/9403/ADV-21652_DESIGN-21652_300250.jpg";

export interface Affiliate {
  slug: string;
  brand: string;
  tagline: string;
  thumbnail: string;
  rating: number;
  badge?: string;
  category: "chat" | "image" | "both";
}

export const AFFILIATES: readonly Affiliate[] = [
  {
    slug: "candy-ai",
    brand: "Candy.AI",
    tagline:
      "Build your perfect AI girlfriend — uncensored roleplay, voice, and photos",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.8,
    badge: "EDITOR'S PICK",
    category: "both",
  },
  {
    slug: "only-waifus",
    brand: "OnlyWaifus.AI",
    tagline:
      "Anime-style waifus that send you pictures and talk back — NSFW unlocked",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.6,
    badge: "BEST FOR HENTAI",
    category: "both",
  },
  {
    slug: "anime-genius",
    brand: "Anime Genius",
    tagline: "Live3D-powered waifu companions with real-time 3D expressions",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.4,
    category: "chat",
  },
  {
    slug: "kupid-ai",
    brand: "Kupid.AI",
    tagline: "Ultra-realistic AI partners — chat, images, and audio messages",
    thumbnail: CRAK_GENERIC_300x250,
    rating: 4.5,
    badge: "MOST REALISTIC",
    category: "both",
  },
  {
    slug: "dream-gf",
    brand: "DreamGF.AI",
    tagline:
      "Design her from scratch — face, body, personality, kinks — and chat now",
    thumbnail: CRAK_GENERIC_300x250,
    rating: 4.7,
    badge: "FREE TRIAL",
    category: "both",
  },
  {
    slug: "crush-on",
    brand: "CrushOn.AI",
    tagline: "No filters, no limits — explicit AI chat with 2,000+ characters",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.5,
    category: "chat",
  },
  {
    slug: "soulkyn",
    brand: "Soulkyn",
    tagline:
      "Emotionally deep AI companions — goes way beyond surface-level flirting",
    thumbnail: CRAK_GENERIC_300x250,
    rating: 4.3,
    category: "chat",
  },
  {
    slug: "nomi-ai",
    brand: "Nomi.AI",
    tagline:
      "Your AI girlfriend remembers everything — evolving personality over time",
    thumbnail: CRAK_HENTAI_300x250,
    rating: 4.6,
    category: "chat",
  },
] as const;

/** Utility — look up a single affiliate by slug. Returns undefined if not found. */
export function getAffiliate(slug: string): Affiliate | undefined {
  return AFFILIATES.find((a) => a.slug === slug);
}
