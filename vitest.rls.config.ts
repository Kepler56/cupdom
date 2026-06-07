import { defineConfig } from "vitest/config";
import path from "path";
import { existsSync, readFileSync } from "fs";

// RLS integration tests run in a Node environment against a live (test) Supabase
// project. Kept separate from the jsdom unit suite. See tests/rls/*.test.ts for
// the required env vars; the suite skips itself when they are absent.

// Vitest does not auto-load .env files (unlike Next.js), so load .env.local here into
// process.env for these integration tests. CLI / shell env always wins over the file.
const envFile = path.resolve(__dirname, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

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
