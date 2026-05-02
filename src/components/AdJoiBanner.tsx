/**
 * AdJoiBanner — homepage Placement A.
 *
 * Renders ONE 300x250 GIF from CrakRevenue's AI vertical creative pool,
 * picked at random per request (homepage is force-dynamic so each render
 * = fresh pick). Click goes to /go/joi-ai → CR offer 8080.
 *
 * Per `feedback_respect_ad_format.md`: ZERO wrapper, ZERO badge, ZERO
 * chrome. Plain `<a><img></a>` at native 300x250. The network's creative
 * is the entire visible element.
 */

const GIFS = [
  "https://www.imglnkx.com/10138/anime---succubus.gif",
  "https://www.imglnkx.com/10138/anime---tentacle.gif",
  "https://www.imglnkx.com/10138/anime---lesbian.gif",
  "https://www.imglnkx.com/10138/anime---slimebondage.gif",
  "https://www.imglnkx.com/10138/300x250---AI-Girls-Just-Want-To-Make-You-Cum---Copy.gif",
] as const;

export function AdJoiBanner() {
  const src = GIFS[Math.floor(Math.random() * GIFS.length)];
  return (
    <a
      href="/go/joi-ai"
      target="_blank"
      rel="sponsored noopener"
      style={{ display: "block", width: 300, height: 250, margin: "0 auto" }}
    >
      <img
        src={src}
        alt=""
        width={300}
        height={250}
        style={{ display: "block", width: 300, height: 250 }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </a>
  );
}
