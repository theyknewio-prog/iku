"use client";

/**
 * AdsterraBanner — renders an Adsterra banner ad in an isolated srcdoc iframe.
 *
 * Why srcdoc iframe: all Adsterra banner formats share a global
 * `window.atOptions` variable. If you put more than one banner on the same
 * page via regular `<script>` tags, the LAST one wins and the others show
 * blank. The Adsterra publisher docs + multiple React/Next.js integration
 * guides (joshwp.com, adsterra blog) confirm that srcdoc iframes are the
 * only reliable way to run multiple banners per page.
 *
 * Each iframe runs a completely isolated document with its own atOptions,
 * loading its own invoke.js from highperformanceformat.com with the zone's
 * hashed token (see src/lib/ad-config.ts → ADSTERRA_SCRIPTS).
 *
 * Usage:
 *   <AdsterraBanner format="banner300x250" />
 *   <AdsterraBanner format="banner728x90" />
 *   <AdsterraBanner format="banner320x50" />
 *   <AdsterraBanner format="banner160x600" />
 *
 * Pro users and /feed route never render this.
 */

import { usePathname } from "next/navigation";
import { ADSTERRA_SCRIPTS } from "@/lib/ad-config";

// Size map — must match the Get Code modal "format" values
const FORMATS = {
  banner300x250: { w: 300, h: 250, url: ADSTERRA_SCRIPTS.banner300x250 },
  banner728x90: { w: 728, h: 90, url: ADSTERRA_SCRIPTS.banner728x90 },
  banner320x50: { w: 320, h: 50, url: ADSTERRA_SCRIPTS.banner320x50 },
  banner160x600: { w: 160, h: 600, url: ADSTERRA_SCRIPTS.banner160x600 },
} as const;

type BannerFormat = keyof typeof FORMATS;

interface AdsterraBannerProps {
  format: BannerFormat;
  className?: string;
  /** Optional inline style override for the outer wrapper */
  style?: React.CSSProperties;
  /**
   * Mobile fallback format. The 728x90 desktop unit gets squished to ~392x90
   * on mobile, which crops the ad creative and shows white space. Default
   * behavior: when `format` is `banner728x90`, swap to `banner300x250` on
   * screens <768px. Pass `null` to disable the downgrade.
   */
  mobileFormat?: BannerFormat | null;
}

/**
 * Extract the hashed token from the script URL so atOptions.key can be set.
 * Adsterra's banner invoke.js reads `atOptions.key` which is the hash that
 * lives in the script URL path, NOT the numeric zone ID.
 *
 * Script URL pattern:
 *   https://www.highperformanceformat.com/<32-char-hex-hash>/invoke.js
 * We want: <32-char-hex-hash>
 */
function extractKey(url: string): string {
  const m = url.match(/\/([a-f0-9]{32})\/invoke\.js/i);
  return m ? m[1] : "";
}

function buildSrcDoc(key: string, w: number, h: number, url: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>body{margin:0;padding:0;overflow:hidden;background:transparent}</style>
</head>
<body>
<script type="text/javascript">
  atOptions = {
    'key' : '${key}',
    'format' : 'iframe',
    'height' : ${h},
    'width' : ${w},
    'params' : {}
  };
</script>
<script src="${url}"></script>
</body>
</html>`;
}

function renderAdsterraIframe(
  format: BannerFormat,
  cfg: { w: number; h: number; url: string },
  key: string,
) {
  const srcDoc = buildSrcDoc(key, cfg.w, cfg.h, cfg.url);
  return (
    <iframe
      title={`ad-${format}`}
      srcDoc={srcDoc}
      width={cfg.w}
      height={cfg.h}
      loading="lazy"
      scrolling="no"
      frameBorder={0}
      style={{
        display: "block",
        border: "none",
        maxWidth: "100%",
      }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}

export function AdsterraBanner({
  format,
  className,
  style,
  mobileFormat,
}: AdsterraBannerProps) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  // Default: 728x90 downgrades to 300x250 on mobile (728 squished to ~392
  // looks broken). Other formats render as-is. Pass `mobileFormat={null}`
  // to disable the downgrade entirely.
  const resolvedMobileFormat: BannerFormat | null =
    mobileFormat === undefined
      ? format === "banner728x90"
        ? "banner300x250"
        : format
      : mobileFormat;

  const desktopCfg = FORMATS[format];
  const desktopKey = extractKey(desktopCfg.url);

  const useSplit =
    resolvedMobileFormat !== null && resolvedMobileFormat !== format;
  const mobileCfg = useSplit ? FORMATS[resolvedMobileFormat!] : desktopCfg;
  const mobileKey = useSplit ? extractKey(mobileCfg.url) : desktopKey;

  // Don't render on /feed or for Pro users
  if (isFeed) return null;
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
    return null;
  if (!desktopKey) return null;

  const wrapperBase: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    maxWidth: "100%",
    overflow: "hidden",
    margin: "0 auto",
    ...style,
  };

  if (!useSplit) {
    return (
      <div
        className={className}
        style={{ ...wrapperBase, minHeight: desktopCfg.h }}
      >
        {renderAdsterraIframe(format, desktopCfg, desktopKey)}
      </div>
    );
  }

  // Dual-render: CSS media query shows the right size per viewport.
  // Keeps parity with HentaiProsBanner's pattern so both ad networks
  // use the same responsive strategy.
  return (
    <>
      <style>{`
        @media (max-width: 767px) { .at-wrap--desktop { display: none !important; } }
        @media (min-width: 768px) { .at-wrap--mobile  { display: none !important; } }
      `}</style>
      <div
        className={["at-wrap", "at-wrap--desktop", className]
          .filter(Boolean)
          .join(" ")}
        style={{ ...wrapperBase, minHeight: desktopCfg.h }}
      >
        {renderAdsterraIframe(format, desktopCfg, desktopKey)}
      </div>
      <div
        className={["at-wrap", "at-wrap--mobile", className]
          .filter(Boolean)
          .join(" ")}
        style={{ ...wrapperBase, minHeight: mobileCfg.h }}
      >
        {renderAdsterraIframe(resolvedMobileFormat!, mobileCfg, mobileKey)}
      </div>
    </>
  );
}
