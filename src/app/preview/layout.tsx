/**
 * /preview/* — Sandbox for radical UI variants (2026-04-12).
 *
 * Bypasses the global AppShell so each variant can ship its own
 * header, navigation, and layout without interfering with the main
 * site. Sab can hit http://localhost:3000/preview/v1, /v2, /v3 to
 * compare three completely different designs.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iku.gg Preview — UI Variants",
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
