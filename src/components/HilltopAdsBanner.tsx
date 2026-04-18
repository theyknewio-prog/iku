"use client";

/**
 * HilltopAdsBanner — renders a HilltopAds banner/in-page zone in a srcdoc iframe.
 *
 * Same isolation pattern as AdsterraBanner: the HilltopAds IIFE references
 * `document.scripts[document.scripts.length - 1]` to insert itself next to
 * its own tag. Running multiple zones on the same document would race. Each
 * srcdoc iframe owns its document so the insertion anchor resolves cleanly.
 *
 * Zones (see src/lib/ad-config.ts HILLTOPADS_SCRIPTS):
 *   banner300x250       — 300x250 MPU
 *   inPagePush          — non-blocking slider (no fixed size)
 *   banner300x100Mobile — 300x100 sticky mobile banner
 *
 * NOT mounted anywhere yet. This ships only the component + the CSP + the
 * ad-config entries. Mount explicitly when you want to start serving.
 */

import { usePathname } from "next/navigation";
import { HILLTOPADS_SCRIPTS } from "@/lib/ad-config";

const FORMATS = {
  banner300x250: { w: 300, h: 250, src: HILLTOPADS_SCRIPTS.banner300x250 },
  inPagePush: { w: 0, h: 0, src: HILLTOPADS_SCRIPTS.inPagePush },
  banner300x100Mobile: {
    w: 300,
    h: 100,
    src: HILLTOPADS_SCRIPTS.banner300x100Mobile,
  },
} as const;

type HilltopFormat = keyof typeof FORMATS;

interface Props {
  format: HilltopFormat;
  className?: string;
  style?: React.CSSProperties;
}

function buildSrcDoc(w: number, h: number, src: string) {
  const injection = `(function(ht){var d=document,s=d.createElement('script'),l=d.scripts[d.scripts.length-1];s.settings=ht||{};s.src=${JSON.stringify(src)};s.async=true;s.referrerPolicy='no-referrer-when-downgrade';l.parentNode.insertBefore(s,l);})({})`;
  const sizeCSS =
    w && h ? `width:${w}px;height:${h}px;` : "width:100%;height:100%;";
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;${sizeCSS}}</style></head><body><script>${injection}</script></body></html>`;
}

export function HilltopAdsBanner({ format, className, style }: Props) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname.startsWith("/feed/");

  if (isFeed) return null;
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
    return null;

  const cfg = FORMATS[format];
  const srcDoc = buildSrcDoc(cfg.w, cfg.h, cfg.src);

  const wrapper: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    maxWidth: "100%",
    overflow: "hidden",
    margin: "0 auto",
    minHeight: cfg.h || undefined,
    ...style,
  };

  return (
    <div className={className} style={wrapper}>
      <iframe
        title={`hilltop-${format}`}
        srcDoc={srcDoc}
        width={cfg.w || "100%"}
        height={cfg.h || "100%"}
        scrolling="no"
        frameBorder={0}
        style={{ display: "block", border: "none", maxWidth: "100%" }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
