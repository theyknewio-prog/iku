/**
 * buildGridInterleave — standard ad layout for BlacklistFilter grids
 * (explore, tag, character, series, search): 5 native affiliate cards
 * (1/8 density) + 2 full-row network breaks (~every 2 screens).
 *
 * Server-only module: the nodes are serialized through the RSC payload
 * into the client BlacklistFilter.
 */

import type { ReactNode } from "react";
import { NativeOfferCard } from "./NativeOfferCard";
import { GridAdBreak } from "./GridAdBreak";
import { AdRotationBanner } from "./AdJoiBanner";

export function buildGridInterleave(
  prefix: string,
): { index: number; node: ReactNode }[] {
  return [
    {
      index: 6,
      node: <NativeOfferCard slug="joi-ai" surface={`${prefix}-native-6`} />,
    },
    {
      index: 13,
      node: <NativeOfferCard slug="candy-ai" surface={`${prefix}-native-13`} />,
    },
    {
      index: 17,
      node: (
        <GridAdBreak>
          <AdRotationBanner slug="swipey" surface={`${prefix}-break-17`} />
        </GridAdBreak>
      ),
    },
    {
      index: 21,
      node: <NativeOfferCard slug="swipey" surface={`${prefix}-native-21`} />,
    },
    {
      index: 29,
      node: <NativeOfferCard slug="meet" surface={`${prefix}-native-29`} />,
    },
    {
      index: 33,
      node: (
        <GridAdBreak>
          <AdRotationBanner slug="candy-ai" surface={`${prefix}-break-33`} />
        </GridAdBreak>
      ),
    },
    {
      index: 37,
      node: <NativeOfferCard slug="joi-ai" surface={`${prefix}-native-37`} />,
    },
  ];
}
