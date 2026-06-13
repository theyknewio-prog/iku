import type { Metadata, Viewport } from "next";
import { Righteous, Nunito } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { MegaFooter } from "@/components/MegaFooter";
import { SessionProviderClient } from "@/components/SessionProviderClient";
import { UserDataSync } from "@/components/UserDataSync";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { getNonce } from "@/lib/csp-nonce";
import { PushNotifications } from "@/components/PushNotifications";
import { PopAdsPopunder } from "@/components/PopAdsPopunder";
import { MondiadInterstitial } from "@/components/MondiadInterstitial";
import { MondiadInPagePush } from "@/components/MondiadInPagePush";

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
  title: "iku.gg — Free Hentai, 3D Hentai & Cartoon Porn | 360,000+ Videos",
  description:
    "Stream 360,000+ free hentai, 3D hentai & cartoon porn animations. Genshin, Overwatch, Blue Archive, SFM & classic 2D anime. Shorts feed included. No signup.",
  keywords: [
    "hentai",
    "3d hentai",
    "cartoon porn",
    "3d porn",
    "3d porn animation",
    "animation porn",
    "porn animation",
    "sfm porn",
    "hmv",
    "hentai compilation",
    "3d futa hentai",
    "genshin impact porn",
    "overwatch porn",
    "blue archive porn",
    "animated hentai",
    "free hentai",
    "hentai streaming",
    "hentai clips",
  ],
  other: { rating: "adult", clckd: "f87d90023de4b02956ca4b938e1939ea" },
  metadataBase: new URL("https://iku.gg"),
  robots: { index: true, follow: true },
  verification: {
    yandex: "bdf515e43c7b4f57",
  },
  openGraph: {
    title: "iku.gg — Free Hentai, 3D Cartoon Porn & Animation Tube",
    description:
      "360,000+ free videos: 3D hentai, SFM, cartoon porn, classic 2D anime & Shorts feed. Genshin, Overwatch, Blue Archive and more.",
    siteName: "iku",
    type: "website",
    images: [
      {
        url: "https://iku.gg/og-default.png",
        width: 1200,
        height: 630,
        alt: "iku.gg — Free Hentai, 3D & Cartoon Porn",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "iku.gg — Free Hentai, 3D & Cartoon Porn",
    description:
      "360,000+ free videos: 3D hentai, SFM, cartoon porn, 2D anime, Shorts feed. Genshin, Overwatch & more.",
    images: ["https://iku.gg/og-default.png"],
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
    <html
      lang="en"
      className={`${righteous.variable} ${nunito.variable}`}
      data-theme="dark"
    >
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
              description:
                "Stream 353,000+ free hentai videos. The best animated hentai clips featuring your favorite anime characters.",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://iku.gg/tag/{search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
        <meta
          name="e9a8710706a48b652c819394214276c5acd7d438"
          content="e9a8710706a48b652c819394214276c5acd7d438"
        />
        {/* Monetag (PropellerAds) site verification — site ID 3319518 */}
        <meta name="monetag" content="1c258acd4421e13c48d418e4cf06f894" />
        {/* Mondiad site verification (added 2026-05-08, signed up 2026-05-02) */}
        <meta name="mnd-ver" content="f29dtqlesjwyun1nvvdfg" />
        {/* Adult content classification (added 2026-06-13). Bing shows adult
            on default SafeSearch and Yandex ranks it freely — both need the
            site correctly bucketed as adult or they mis-classify and drop it.
            RTA label is the canonical adult-content signal for crawlers +
            parental filters. Pairs with other.rating="adult" above. */}
        <meta name="RATING" content="RTA-5042-1996-1400-1577-RTA" />
        <meta name="content-rating" content="mature" />
        {/* Yandex Metrica (counter 109826109) — added 2026-06-13. Webvisor ON.
            Feeds the behavioral signals (dwell time, CTR, scroll) that DOMINATE
            Yandex ranking (leaked 2023 algo) + speeds Yandex crawl of updates.
            Yandex already outperforms Google for iku.gg, so this is the highest-
            leverage channel signal. CSP hosts whitelisted in middleware.ts. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=109826109', 'ym');ym(109826109, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`,
          }}
        />
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/109826109"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
      </head>
      <body data-pro={isPro ? "1" : "0"}>
        <div className="sparkles-bg" aria-hidden="true">
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
          <div className="sparkle" />
        </div>
        <SessionProviderClient>
          <AnalyticsProvider />
          <UserDataSync />
          {/* 2026-05-02 — TOTAL AD NUKE #2. All ad surfaces removed (every
              network, every popunder, every affiliate card, every banner,
              every preroll). Site runs zero monetization while the new
              strategy is decided. */}
          {/* 2026-05-08 — PopAds popunder re-mounted (site approved
              2026-05-01, ID 5296964). Standard Adcode (no anti-adblock
              variant rotation, simpler CSP). Free Pro users still don't
              see it because the script no-ops via early-return on data-pro=1
              (TODO if we want full Pro silence). */}
          <PopAdsPopunder />
          {/* Mondiad — site 27564 accepted 2026-05-11, 11-day 100% revshare
              window. Interstitial fires once per page-load after window.load
              + 1.5s delay (avoids blocking LCP). In-page push runs globally. */}
          <MondiadInterstitial />
          <MondiadInPagePush />
          <PushNotifications />
          <AppShell footer={<MegaFooter />}>{children}</AppShell>
        </SessionProviderClient>
      </body>
    </html>
  );
}
// force rebuild 1775129902
