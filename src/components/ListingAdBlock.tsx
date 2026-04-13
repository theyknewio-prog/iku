/**
 * ListingAdBlock — server component that renders a parallel cluster of ads
 * from multiple networks at once. Used between every section on listing
 * pages to maximize density without giving up if one network has a poor
 * fill rate at a given moment.
 *
 * Variants:
 *   - "top"     → 3 ads stacked (HP 300x250 + ExoClick 728/300x50 + Adsterra 300x250)
 *   - "mid"     → 3 ads in a flex row (HP 728x90 + Adsterra 728x90 + ExoClick 300x250)
 *   - "bottom"  → 3 ads stacked (HP 300x100 + Adsterra 300x250 + ExoClick 728/300x50)
 */

import { HentaiProsBanner } from "./HentaiProsBanner";
import { AdZoneClient } from "./AdZoneClient";
import { AdsterraBanner } from "./AdsterraBanner";
import { AD_ZONES } from "@/lib/ad-config";

type Variant = "top" | "mid" | "bottom";

const wrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 12,
  margin: "16px 0",
};

export function ListingAdBlock({ variant }: { variant: Variant }) {
  if (variant === "top") {
    return (
      <div style={wrap}>
        <HentaiProsBanner format="300x250" mobileFormat={null} />
        <AdZoneClient
          zoneId={AD_ZONES.exoclick.watchUnderplayer728}
          size="728x90"
          mobileZoneId={AD_ZONES.exoclick.mobileBanner300x50 ?? undefined}
          mobileSize="300x50"
          lazy
        />
        <AdsterraBanner format="banner300x250" />
      </div>
    );
  }

  if (variant === "mid") {
    return (
      <div style={wrap}>
        <HentaiProsBanner format="728x90" mobileFormat="300x250" />
        <AdsterraBanner format="banner728x90" mobileFormat="banner300x250" />
        <AdZoneClient
          zoneId={AD_ZONES.exoclick.sidebar300}
          size="300x250"
          lazy
        />
      </div>
    );
  }

  // bottom
  return (
    <div style={wrap}>
      <HentaiProsBanner format="300x100" mobileFormat={null} />
      <AdsterraBanner format="banner300x250" />
      <AdZoneClient
        zoneId={AD_ZONES.exoclick.watchUnderplayer728}
        size="728x90"
        mobileZoneId={AD_ZONES.exoclick.mobileBanner300x50 ?? undefined}
        mobileSize="300x50"
        lazy
      />
    </div>
  );
}
