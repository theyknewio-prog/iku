/**
 * SoulkynVerticalAd — 4:5 vertical AI companion ad.
 *
 * Direct affiliate (Soulkyn — first month 35%, then 15% recurring on
 * monthly plans, 10% on yearly). Native vertical 1080x1350 PNG/JPG
 * creatives provided by Soulkyn partner dashboard, hotlinked from their
 * CloudFront CDN (img-src https://*.cloudfront.net already in CSP, hotlink
 * test 2026-05-08 returned 200 with iku.gg referer).
 *
 * Why vertical: 90% of iku.gg traffic is mobile. A 4:5 portrait card sized
 * to viewport width is the native "Instagram story" format — far more
 * eye-catching than a side-letterboxed 300x250 on a 360px-wide phone.
 * Display capped to 360px max on desktop so it doesn't dominate the
 * sidebar.
 *
 * Per `feedback_respect_ad_format.md`: zero wrapper, zero badge, zero
 * chrome — plain <a><img></a> at native 4:5.
 *
 * Routed via /go/soulkyn → soulkyn.com/?_go=sab35 (PostHog click event
 * fires server-side on the redirect).
 */

const POOL = [
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27892/Visuel_4.jpg",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27890/Visuel_3-1__1_.png",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27889/Visuel_2__1_.jpg",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27888/Visuel_1__1_.jpg",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27887/CREA-4-V1.png",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27886/CREA-3-V1.png",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27885/CREA-2-V2.png",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27884/CREA-2-V1.png",
  "https://d2gdx5nv84sdx2.cloudfront.net/uploads/xrsnt2j5/marketing_asset/banner/27883/CREA-1-V1.png",
] as const;

interface Props {
  /** Surface name for analytics — kept as string, not enumerated. */
  surface: string;
  /** Max display width in px on desktop. Default 360. Mobile = 100vw. */
  maxWidth?: number;
}

export function SoulkynVerticalAd({
  surface: _surface,
  maxWidth = 360,
}: Props) {
  const src = POOL[Math.floor(Math.random() * POOL.length)];
  return (
    <a
      href="/go/soulkyn"
      target="_blank"
      rel="sponsored noopener"
      style={{
        display: "block",
        width: "100%",
        maxWidth: `${maxWidth}px`,
        margin: "0 auto",
        aspectRatio: "1080 / 1350",
      }}
    >
      <img
        src={src}
        alt=""
        width={1080}
        height={1350}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: 12,
        }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </a>
  );
}
