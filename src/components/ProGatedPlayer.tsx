"use client";

/**
 * ProGatedPlayer — client-side wrapper that flips between the real
 * WatchPlayer and the ProLockOverlay based on the current user's
 * Pro entitlement OR per-video unlock (gamification points).
 *
 * Lives client-side so the parent watch page can stay ISR-cached (24h).
 */

import { useCallback, useEffect, useState } from "react";
import { WatchPlayerWithPreroll } from "@/components/WatchPlayerWithPreroll";
import { ProLockOverlay } from "@/components/ProLockOverlay";

type Props = {
  src: string;
  poster?: string;
  resolveUrl?: string;
  relatedVideos?: Array<{ slug: string; thumbnail: string; title: string }>;
  lockedThumbnail: string | null;
  lockedTitle: string;
  /** PG primary key — needed for the per-video unlock POST. */
  videoPk: number;
  /** Pre-computed unlock cost in points (server-side via unlockCost()). */
  unlockCost: number;
};

type State = {
  status: "loading" | "unlocked" | "locked-signed-out" | "locked-signed-in";
  score: number;
};

export function ProGatedPlayer(props: Props) {
  const [state, setState] = useState<State>({ status: "loading", score: 0 });

  const refresh = useCallback(() => {
    fetch(`/api/pro-status?videoPk=${props.videoPk}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: {
          signedIn: boolean;
          pro: boolean;
          score: number;
          unlockedThisVideo: boolean;
        } | null) => {
          if (!d) {
            setState({ status: "locked-signed-out", score: 0 });
            return;
          }
          if (d.pro || d.unlockedThisVideo) {
            setState({ status: "unlocked", score: d.score });
          } else if (d.signedIn) {
            setState({ status: "locked-signed-in", score: d.score });
          } else {
            setState({ status: "locked-signed-out", score: 0 });
          }
        }
      )
      .catch(() => setState({ status: "locked-signed-out", score: 0 }));
  }, [props.videoPk]);

  useEffect(() => { refresh(); }, [refresh]);

  if (state.status === "loading") {
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

  if (state.status === "unlocked") {
    return (
      <WatchPlayerWithPreroll
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
      signedIn={state.status === "locked-signed-in"}
      videoPk={props.videoPk}
      unlockCost={props.unlockCost}
      userScore={state.score}
      onUnlocked={refresh}
    />
  );
}
