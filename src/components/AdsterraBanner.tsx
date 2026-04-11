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

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ADSTERRA_SCRIPTS } from "@/lib/ad-config";

// Size map — must match the Get Code modal "format" values
const FORMATS = {
  banner300x250: { w: 300, h: 250, url: ADSTERRA_SCRIPTS.banner300x250 },
  banner728x90:  { w: 728, h: 90,  url: ADSTERRA_SCRIPTS.banner728x90 },
  banner320x50:  { w: 320, h: 50,  url: ADSTERRA_SCRIPTS.banner320x50 },
  banner160x600: { w: 160, h: 600, url: ADSTERRA_SCRIPTS.banner160x600 },
} as const;

type BannerFormat = keyof typeof FORMATS;

interface AdsterraBannerProps {
  format: BannerFormat;
  className?: string;
  /** Optional inline style override for the outer wrapper */
  style?: React.CSSProperties;
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

export function AdsterraBanner({ format, className, style }: AdsterraBannerProps) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  const cfg = FORMATS[format];
  const key = extractKey(cfg.url);

  // Build the srcdoc HTML. The script runs inside the iframe's own document
  // with its own window, so atOptions doesn't collide with anything.
  const srcDoc = useMemo(() => {
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
    'height' : ${cfg.h},
    'width' : ${cfg.w},
    'params' : {}
  };
</script>
<script src="${cfg.url}"></script>
</body>
</html>`;
  }, [key, cfg.h, cfg.w, cfg.url]);

  // Don't render on /feed or for Pro users
  if (isFeed) return null;
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1") return null;
  if (!key) return null;

  return (
    <iframe
      title={`ad-${format}`}
      srcDoc={srcDoc}
      width={cfg.w}
      height={cfg.h}
      scrolling="no"
      frameBorder={0}
      className={className}
      style={{
        display: "block",
        border: "none",
        margin: "0 auto",
        ...style,
      }}
      // Security: sandbox the iframe so it can only run its own scripts
      // and open links in new tabs — no access to parent page data.
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
