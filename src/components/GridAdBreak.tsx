/**
 * GridAdBreak — full-row ad slot inside a CSS grid (.video-grid etc.).
 *
 * Spans every column (gridColumn 1/-1) so the network/affiliate creative
 * sits centered at its NATIVE IAB size between two full rows of cards —
 * never squeezed into a single grid cell (the old bug: 300px creative
 * overflowing a 174px cell).
 */

import type { ReactNode } from "react";

export function GridAdBreak({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        justifyContent: "center",
        padding: "6px 0",
      }}
    >
      {children}
    </div>
  );
}
