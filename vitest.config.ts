import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Node environment — we're testing server-side route handlers, not React.
    environment: "node",
    globals: true,
    // Only run files under src/**/*.test.ts — avoid picking up Next.js build artifacts.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Stripe and PG are mocked — we never hit real services.
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
