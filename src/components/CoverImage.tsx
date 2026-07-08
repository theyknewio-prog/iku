"use client";

import { useState } from "react";

/**
 * CoverImage — thumbnail for character/series covers that self-heals when
 * the source 404s (gelbooru/source deletes old thumbnails; the /api/proxy
 * wrapper then returns 404 too). On error it unmounts the <img>, revealing
 * the gradient + initials fallback rendered underneath by the parent.
 *
 * Plain <img> (not next/image): covers are already sized by their CSS
 * container (absolute-fill), and next/image adds no value on a
 * fill-cover thumbnail we don't want optimized.
 */
export function CoverImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}
