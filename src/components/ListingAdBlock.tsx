/**
 * ListingAdBlock — renders ONE ad unit per call site. Previously this
 * rendered 3 networks in parallel (HP + ExoClick + Adsterra) which stacked
 * vertically on mobile and produced 9 consecutive ad tiles per route when
 * the page called top+mid+bottom. That wall of ads was hiding the video
 * grid below the fold on /hentai, /3d, /new, /tag/*, /character/*, etc.
 *
 * Now:
 *   - "top"    → HentaiPros 300x250 (known-clean, strongest CPM for this niche)
 *   - "mid"    → Adsterra 300x250 (mid-page diversity)
 *   - "bottom" → ExoClick 300x250 (bottom of grid)
 *
 * Callers get 1 ad per invocation. A listing page that calls all three
 * variants shows 3 ads total, not 9. Each variant renders the same 300x250
 * footprint so CLS stays stable across mobile + desktop.
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
        <HentaiProsBanner format="300x250" mobileFormat="300x250" />
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
