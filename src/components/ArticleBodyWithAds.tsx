/**
 * ArticleBodyWithAds — blog article body with in-content ad slots every
 * 4 paragraphs (tube/content-site standard), brands rotated, capped at 5
 * slots. Replaces the old post-body 3-ad wall.
 *
 * SECURITY: the sanitization below is the EXACT strip previously inlined
 * in blog/[slug]/page.tsx (script tags, on* handlers, javascript: URIs).
 * Never weaken it — article.content is static today but seo-autopilot
 * writes articles automatically.
 *
 * Splitting happens ONLY at </p> boundaries (never mid-list/heading).
 * If the HTML has too few paragraphs (or an unexpected shape), we render
 * the body intact with a single trailing slot — fail-safe.
 */

import { AdRotationBanner } from "./AdJoiBanner";
import { SoulkynVerticalAd } from "./SoulkynVerticalAd";

function sanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
}

const BRANDS = ["candy-ai", "joi-ai", "swipey"] as const;
const PARAS_PER_SLOT = 4;
const MAX_SLOTS = 5;

export function ArticleBodyWithAds({ html }: { html: string }) {
  const safe = sanitize(html);
  // Lookbehind split: every piece keeps its own closing </p>.
  const pieces = safe.split(/(?<=<\/p>)/i).filter((s) => s.trim().length > 0);

  if (pieces.length < PARAS_PER_SLOT + 2) {
    return (
      <>
        <div
          className="blog-post-body"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
        <div style={{ margin: "24px auto" }}>
          <AdRotationBanner slug="candy-ai" surface="blog-article-mid" />
        </div>
      </>
    );
  }

  // Chunks of 4 paragraphs; an ad slot between chunks, capped at 5.
  const chunks: string[] = [];
  for (let i = 0; i < pieces.length; i += PARAS_PER_SLOT) {
    chunks.push(pieces.slice(i, i + PARAS_PER_SLOT).join(""));
  }
  const slotCount = Math.min(chunks.length - 1, MAX_SLOTS);
  const soulkynSlot = Math.floor(slotCount / 2);

  return (
    <>
      {chunks.map((chunk, i) => (
        <div key={i}>
          <div
            className="blog-post-body"
            dangerouslySetInnerHTML={{ __html: chunk }}
          />
          {i < slotCount &&
            (i === soulkynSlot ? (
              <div style={{ margin: "24px auto" }}>
                <SoulkynVerticalAd surface={`blog-inbody-${i}`} />
              </div>
            ) : (
              <div style={{ margin: "24px auto" }}>
                <AdRotationBanner
                  slug={BRANDS[i % BRANDS.length]}
                  surface={`blog-inbody-${i}`}
                />
              </div>
            ))}
        </div>
      ))}
    </>
  );
}
