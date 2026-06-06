import { defineConfig, devices } from '@playwright/test';

// E2E config. Requires a running app (E2E_BASE_URL) + a live test Supabase project
// with two seeded members. Run: pnpm exec playwright install && pnpm test:e2e
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
