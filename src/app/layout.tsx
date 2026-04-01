import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "iku — swipe hentai",
  description: "The TikTok of hentai. Swipe through the best anime content.",
  metadataBase: new URL("https://iku.gg"),
  robots: { index: false },
  openGraph: {
    title: "iku.gg",
    description: "Swipe. Discover. Enjoy.",
    siteName: "iku",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
