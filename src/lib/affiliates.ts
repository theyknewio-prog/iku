/**
 * affiliates.ts — Master list of AI girlfriend/companion affiliate programs.
 *
 * This is the single source of truth for affiliate data.
 * AffiliateCard, AffiliateRail, and the /go/[slug] route all read from here.
 *
 * To add a new affiliate:
 *   1. Add an entry to AFFILIATES below
 *   2. Add the slug → tracking URL in src/app/go/[slug]/route.ts
 *   3. Drop a thumbnail at public/img/affiliates/{slug}.jpg (360x480 or 728x90 depending on variant)
 */

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
    // Using CrakRevenue's official hentai-themed creative (300x250) directly
    // from imglnkx CDN — saves uploading our own asset and aligns visually
    // with the routed offer. CSP allows imglnkx.com in img-src.
    thumbnail:
      "https://www.imglnkx.com/9403/ADV-1207_DESIGN-21652_Hentai-Banners_300250.jpg",
    rating: 4.8,
    badge: "EDITOR'S PICK",
    category: "both",
  },
  {
    slug: "only-waifus",
    brand: "OnlyWaifus.AI",
    tagline:
      "Anime-style waifus that send you pictures and talk back — NSFW unlocked",
    thumbnail: "/img/affiliates/only-waifus.jpg",
    rating: 4.6,
    badge: "BEST FOR HENTAI",
    category: "both",
  },
  {
    slug: "anime-genius",
    brand: "Anime Genius",
    tagline: "Live3D-powered waifu companions with real-time 3D expressions",
    thumbnail: "/img/affiliates/anime-genius.jpg",
    rating: 4.4,
    category: "chat",
  },
  {
    slug: "kupid-ai",
    brand: "Kupid.AI",
    tagline: "Ultra-realistic AI partners — chat, images, and audio messages",
    thumbnail: "/img/affiliates/kupid-ai.jpg",
    rating: 4.5,
    badge: "MOST REALISTIC",
    category: "both",
  },
  {
    slug: "dream-gf",
    brand: "DreamGF.AI",
    tagline:
      "Design her from scratch — face, body, personality, kinks — and chat now",
    thumbnail: "/img/affiliates/dream-gf.jpg",
    rating: 4.7,
    badge: "FREE TRIAL",
    category: "both",
  },
  {
    slug: "crush-on",
    brand: "CrushOn.AI",
    tagline: "No filters, no limits — explicit AI chat with 2,000+ characters",
    thumbnail: "/img/affiliates/crush-on.jpg",
    rating: 4.5,
    category: "chat",
  },
  {
    slug: "soulkyn",
    brand: "Soulkyn",
    tagline:
      "Emotionally deep AI companions — goes way beyond surface-level flirting",
    thumbnail: "/img/affiliates/soulkyn.jpg",
    rating: 4.3,
    category: "chat",
  },
  {
    slug: "nomi-ai",
    brand: "Nomi.AI",
    tagline:
      "Your AI girlfriend remembers everything — evolving personality over time",
    thumbnail: "/img/affiliates/nomi-ai.jpg",
    rating: 4.6,
    category: "chat",
  },
] as const;

/** Utility — look up a single affiliate by slug. Returns undefined if not found. */
export function getAffiliate(slug: string): Affiliate | undefined {
  return AFFILIATES.find((a) => a.slug === slug);
}
