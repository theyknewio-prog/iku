import { AgeGate } from "@/components/AgeGate";
import { SwipeFeed } from "@/components/SwipeFeed";

/*
  /feed = age-gated vertical swipe feed (TikTok UX).
  The catalog/browse is at / (homepage).
*/
export default function FeedPage() {
  return (
    <AgeGate>
      <SwipeFeed />
    </AgeGate>
  );
}
