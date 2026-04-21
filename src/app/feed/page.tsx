import React from "react";
import type { Metadata } from "next";
import { AgeGate } from "@/components/AgeGate";
import { SwipeFeed } from "@/components/SwipeFeed";
import { isLikelyBot } from "@/lib/is-bot";

export const metadata: Metadata = {
  title: "Hentai Shorts Feed — Swipe & Watch | iku.gg",
  description:
    "Endless vertical hentai shorts. Swipe through 360,000+ free animated clips — TikTok-style feed on iku.gg.",
  other: { rating: "adult" },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://iku.gg/feed" },
};

export default async function FeedPage() {
  const bot = await isLikelyBot();
  const Wrapper = bot ? React.Fragment : AgeGate;

  return (
    <Wrapper>
      <SwipeFeed />
    </Wrapper>
  );
}
