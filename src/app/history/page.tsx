import type { Metadata } from "next";
import { auth } from "@/auth";
import { getUserHistory } from "@/lib/content";
import { AdRotationBanner } from "@/components/AdJoiBanner";
import { SoulkynVerticalAd } from "@/components/SoulkynVerticalAd";
import { HistoryClient, type InitialHistoryItem } from "./history-client";

export const metadata: Metadata = {
  title: "Watch History — iku.gg",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://iku.gg/history" },
};

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await auth();

  let initialItems: InitialHistoryItem[] | null = null;
  if (session?.user?.id) {
    const videos = await getUserHistory(session.user.id);
    initialItems = videos.map((v) => ({
      id: v.id,
      slug: v.slug,
      title:
        v.title ||
        v.characters[0]?.replace(/_/g, " ") ||
        v.copyrights[0]?.replace(/_/g, " ") ||
        v.tags.slice(0, 2).join(", ") ||
        "Animated",
      thumbnail: v.thumbnail,
    }));
  }

  return (
    <>
      <HistoryClient
        initialItems={initialItems}
        isAuthenticated={Boolean(session?.user?.id)}
      />
      {/* AI banners at the bottom of /history — noindex page, no SEO
          impact, but logged-in users on this page are highly engaged. */}
      <div style={{ margin: "24px auto 8px" }}>
        <AdRotationBanner slug="joi-ai" surface="page-history" />
      </div>
      <div style={{ margin: "8px auto" }}>
        <AdRotationBanner slug="swipey" surface="page-history-swipey" />
      </div>
      <div style={{ margin: "16px auto 48px" }}>
        <SoulkynVerticalAd surface="page-history-vertical" />
      </div>
    </>
  );
}
