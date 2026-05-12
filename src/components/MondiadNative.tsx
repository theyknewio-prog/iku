"use client";

const ZONE_SCRIPT = "https://ss.mrmnd.com/native.js";

function buildSrcDoc(width: number, height: number) {
  const injection = `(function(){var d=document,s=d.createElement('script');s.src=${JSON.stringify(ZONE_SCRIPT)};s.async=true;d.head.appendChild(s);})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;width:${width}px;}</style></head><body><script>${injection}</script></body></html>`;
}

export function MondiadNative({
  width = 300,
  height = 250,
}: {
  width?: number;
  height?: number;
}) {
  if (typeof document !== "undefined" && document.body?.dataset.pro === "1")
    return null;

  return (
    <iframe
      title="mondiad-native"
      srcDoc={buildSrcDoc(width, height)}
      width={width}
      height={height}
      scrolling="no"
      frameBorder={0}
      style={{
        display: "block",
        border: "none",
        margin: "0 auto",
        width,
        height,
      }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
