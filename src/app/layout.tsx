import type { Metadata, Viewport } from "next";
import { Righteous, Nunito } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SessionProviderClient } from "@/components/SessionProviderClient";
import { UserDataSync } from "@/components/UserDataSync";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { getNonce } from "@/lib/csp-nonce";
import { AdScript } from "@/components/AdScript";
import { PopunderAd } from "@/components/PopunderAd";
import { CamWidget } from "@/components/CamWidget";
import { AdsterraSocialBar } from "@/components/AdsterraSocialBar";
import { PushNotifications } from "@/components/PushNotifications";

// Fonts: Nunito (primary body) + Righteous (display/headings).
// Previously we also loaded Inter, Poppins, and Quicksand — they were
// declared but only ever referenced as CSS fallbacks behind Nunito/Righteous,
// which always load first. Removing saved ~80KB of font CSS + 3 preloads.
const righteous = Righteous({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-righteous",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "iku.gg — Free Hentai Videos | Stream Animated Hentai Online",
  description: "Stream 353,000+ free hentai videos on iku.gg. The best animated hentai clips featuring your favorite anime characters. Browse by tag, character, or trending.",
  keywords: ["hentai", "hentai videos", "animated hentai", "anime porn", "free hentai", "hentai streaming", "hentai clips"],
  other: { rating: "adult" },
  metadataBase: new URL("https://iku.gg"),
  robots: { index: true, follow: true },
  openGraph: {
    title: "iku.gg — Free Hentai Videos",
    description: "Stream 353,000+ free hentai videos. Browse animated hentai by tag, character, and score.",
    siteName: "iku",
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "iku.gg — Free Animated Hentai" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "iku.gg — Free Hentai Videos",
    description: "Stream 353,000+ free hentai videos. Browse animated hentai by tag, character, and score.",
    images: ["/og-default.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getNonce();

  // Pro status is determined CLIENT-SIDE via UserDataSync which calls
  // /api/profile after hydration and sets document.body.dataset.pro.
  // Previously we read auth() + PG at SSR time, which made the entire
  // layout (and all child routes) dynamic and broke ISR on 346K watch
  // pages. Rendering body with data-pro="0" is safe because ad
  // components (AdZoneClient etc.) re-check the attribute after mount.
  const isPro = false;

  return (
    <html lang="en" className={`${righteous.variable} ${nunito.variable}`} data-theme="dark">
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "iku.gg",
              url: "https://iku.gg",
              description: "Stream 353,000+ free hentai videos. The best animated hentai clips featuring your favorite anime characters.",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://iku.gg/tag/{search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body data-pro={isPro ? "1" : "0"}>
        <div className="sparkles-bg" aria-hidden="true">
          <div className="sparkle" /><div className="sparkle" /><div className="sparkle" />
          <div className="sparkle" /><div className="sparkle" /><div className="sparkle" />
          <div className="sparkle" /><div className="sparkle" /><div className="sparkle" />
          <div className="sparkle" />
        </div>
        <SessionProviderClient>
          <AnalyticsProvider />
          <UserDataSync />
          <AdScript />
          <PopunderAd />
          <AdsterraSocialBar />
          <CamWidget />
          {/* StickyFooterAd removed 2026-04-11: ExoClick 300x50 zone was
              serving a wrong-sized creative that got clipped above the
              mobile nav. Redundant with AdsterraSocialBar + CamWidget
              already occupying sticky corners. */}
          <PushNotifications />
          <AppShell>{children}</AppShell>
        </SessionProviderClient>
      </body>
    </html>
  );
}
// force rebuild 1775129902
