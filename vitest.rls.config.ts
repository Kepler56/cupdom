import { defineConfig } from "vitest/config";
import path from "path";

// RLS integration tests run in a Node environment against a live (test) Supabase
// project. Kept separate from the jsdom unit suite. See tests/rls/*.test.ts for
// the required env vars; the suite skips itself when they are absent.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
