/**
 * ListingAdBlock — renders ONE ad unit per call site. Previously this
 * rendered 3 networks in parallel (HP + ExoClick + Adsterra) which stacked
 * vertically on mobile and produced 9 consecutive ad tiles per route when
 * the page called top+mid+bottom. That wall of ads was hiding the video
 * grid below the fold on /hentai, /3d, /new, /tag/*, /character/*, etc.
 *
 * Now:
 *   - "top"    → HentaiPros 728x90 desktop / 300x250 mobile (above-fold leaderboard,
 *                universal pattern across HentaiCity / Hentaigasm / Hentai.tv)
 *   - "mid"    → Adsterra 300x250 (mid-page diversity)
 *   - "bottom" → ExoClick 300x250 (bottom of grid)
 *
 * Ship #3 2026-04-20: top variant upgraded from 300x250 to 728x90/300x250 to
 * match competitor leaderboard density. Mid + bottom unchanged.
 *
 * Callers get 1 ad per invocation. A listing page that calls all three
 * variants shows 3 ads total. Each variant uses HentaiPros's mobile=300x250
 * downgrade so CLS stays stable on small viewports.
 */

import { HentaiProsBanner } from "./HentaiProsBanner";
import { AdZoneClient } from "./AdZoneClient";
import { AdsterraBanner } from "./AdsterraBanner";
import { AD_ZONES } from "@/lib/ad-config";

type Variant = "top" | "mid" | "bottom";

const wrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  margin: "16px 0",
};

export function ListingAdBlock({ variant }: { variant: Variant }) {
  if (variant === "top") {
    return (
      <div style={wrap}>
        <HentaiProsBanner format="728x90" mobileFormat="300x250" />
      </div>
    );
  }

  if (variant === "mid") {
    return (
      <div style={wrap}>
        <AdsterraBanner format="banner300x250" />
      </div>
    );
  }

  // bottom
  return (
    <div style={wrap}>
      <AdZoneClient zoneId={AD_ZONES.exoclick.sidebar300} size="300x250" lazy />
    </div>
  );
}
