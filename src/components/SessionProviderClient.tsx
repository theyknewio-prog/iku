"use client";

import { SessionProvider } from "next-auth/react";

export function SessionProviderClient({
  children,
}: {
  children: React.ReactNode;
}) {
  // refetchOnWindowFocus=false + refetchWhenOffline=false: the default
  // background session refetches were firing /api/auth/session on every tab
  // focus for anon visitors, aborting mid-flight on navigation and logging
  // AuthJS 'Failed to fetch' console noise (audit 2026-07-08). Anon session
  // state never changes; one mount fetch is enough.
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      {children}
    </SessionProvider>
  );
}
