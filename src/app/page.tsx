import { AgeGate } from "@/components/AgeGate";
import { SwipeFeed } from "@/components/SwipeFeed";

/*
  Homepage = age-gated vertical swipe feed (TikTok UX).
  The catalog/browse pages are at /browse, /tags, /v/[slug].
*/
export default function Home() {
  return (
    <AgeGate>
      <SwipeFeed />
    </AgeGate>
  );
}
