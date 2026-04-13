"use client";

/**
 * ProGatedPlayer — client-side wrapper that flips between the real
 * WatchPlayer and the ProLockOverlay based on the current user's
 * Pro entitlement. Lives client-side so the parent watch page can
 * stay ISR-cached (24h).
 *
 * While the status resolves, render a dark placeholder to avoid a
 * flash of the unlocked player.
 */

import { useEffect, useState } from "react";
import { WatchPlayer } from "@/components/WatchPlayer";
import { ProLockOverlay } from "@/components/ProLockOverlay";

type Props = {
  src: string;
  poster?: string;
  resolveUrl?: string;
  relatedVideos?: Array<{ slug: string; thumbnail: string; title: string }>;
  lockedThumbnail: string | null;
  lockedTitle: string;
};

type Status = "loading" | "unlocked" | "locked-signed-out" | "locked-signed-in";

export function ProGatedPlayer(props: Props) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pro-status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { signedIn: false, pro: false }))
      .then((d: { signedIn: boolean; pro: boolean }) => {
        if (cancelled) return;
        if (d.pro) setStatus("unlocked");
        else if (d.signedIn) setStatus("locked-signed-in");
        else setStatus("locked-signed-out");
      })
      .catch(() => {
        if (!cancelled) setStatus("locked-signed-out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          background: "#0a0a0a",
          borderRadius: 10,
          overflow: "hidden",
        }}
      />
    );
  }

  if (status === "unlocked") {
    return (
      <WatchPlayer
        src={props.src}
        poster={props.poster}
        resolveUrl={props.resolveUrl}
        relatedVideos={props.relatedVideos}
      />
    );
  }

  return (
    <ProLockOverlay
      thumbnail={props.lockedThumbnail}
      title={props.lockedTitle}
      signedIn={status === "locked-signed-in"}
    />
  );
}
