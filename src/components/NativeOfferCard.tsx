/**
 * NativeOfferCard — affiliate /go/ offer disguised as a video card.
 *
 * Renders inside .video-grid as one grid cell using the exact .video-card
 * markup (16:9 media + title row) so it reads like a thumbnail — the
 * pattern every major tube uses for in-grid natives. The creative is OUR
 * affiliate GIF (CrakRevenue pools), not a network ad, so cropping it to
 * cover 16:9 is allowed. An "AD" pill sits where duration usually lives
 * plus a "Sponsored" meta line — disclosed but native.
 *
 * Server component: creative picked at random per render (per-request on
 * dynamic pages, per-regeneration on ISR pages).
 */

const OFFERS: Record<string, { titles: string[]; pool: string[] }> = {
  "joi-ai": {
    titles: [
      "Your AI Waifu Is Waiting For You",
      "She Does Anything You Ask — AI Girlfriend",
    ],
    pool: [
      "https://www.imglnkx.com/10138/anime---succubus.gif",
      "https://www.imglnkx.com/10138/anime---lesbian.gif",
      "https://www.imglnkx.com/10138/anime---tentacle.gif",
      "https://www.imglnkx.com/10138/anime---monsters.gif",
      "https://www.imglnkx.com/10138/anime---tied.gif",
      "https://www.imglnkx.com/10138/50k-characters.gif",
    ],
  },
  "candy-ai": {
    titles: [
      "Build Your Dream Hentai Girl",
      "Design Her. Undress Her. Chat Now",
    ],
    pool: [
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset1.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset2.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset3.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset4.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset5.gif",
      "https://www.imglnkx.com/10022/CandyAI_202507_Cartoon-Hentai_300x250_Hasset6.gif",
    ],
  },
  swipey: {
    titles: ["Swipe. Match. She Strips For You", "AI Girls Want To Meet You"],
    pool: [
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Anime_15.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Anime_16.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_1.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_5.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_9.gif",
    ],
  },
  // Hub dating géo-routé /go/meet (US→Instabang, DE→lovefrauen, ROW→
  // smartlink) — créas realistic Swipey réutilisées faute de pool dédié.
  meet: {
    titles: ["Girls Near You Want To Chat", "She's Online Right Now"],
    pool: [
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_2.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_7.gif",
      "https://www.imglnkx.com/10100/Swipey_202506_300250_Realistic_12.gif",
    ],
  },
};

interface Props {
  slug: keyof typeof OFFERS | string;
  surface: string;
}

export function NativeOfferCard({ slug, surface }: Props) {
  const offer = OFFERS[slug] ?? OFFERS["candy-ai"];
  const src = offer.pool[Math.floor(Math.random() * offer.pool.length)];
  const title = offer.titles[Math.floor(Math.random() * offer.titles.length)];
  return (
    <a
      href={`/go/${slug}`}
      target="_blank"
      rel="sponsored noopener"
      className="video-card video-card--sponsored"
      data-surface={surface}
    >
      <div className="video-card__media">
        {/* Plain <img>: creatives are animated GIFs — next/image would
            freeze or re-encode them. .video-card__thumbnail already does
            absolute-fill + object-fit cover. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          className="video-card__thumbnail"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <span className="video-card__duration video-card__ad-pill">AD</span>
      </div>
      <div className="video-card__body">
        <h3 className="video-card__title">{title}</h3>
        <div className="video-card__meta">
          <span className="video-card__meta-item">Sponsored</span>
        </div>
      </div>
    </a>
  );
}
