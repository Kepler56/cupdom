import { expect, test } from '@playwright/test';

/**
 * E2E for Spec 2B: the branded "Campagne terminée / indisponible" page (AC-19 scanner side).
 *
 * Part A (direct render) runs against any running app (E2E_BASE_URL) — no DB needed; it proves
 * the page an anonymous scanner lands on, including that it is NOT bounced to /login.
 *
 * Part B (full hand-off) drives the real edge redirect `/s/<slug>` → `/campagne-terminee` for a
 * Terminée slug. That requires the Netlify edge runtime (`netlify dev`) and a seeded inactive
 * campaign, so it only runs when E2E_SCAN_BASE_URL + E2E_TERMINEE_SLUG are provided; otherwise the
 * redirect decision is covered by the Task 2 node --test branch suite (scan.test.mjs).
 */
const configured = Boolean(process.env.E2E_BASE_URL);
const SCAN_BASE = process.env.E2E_SCAN_BASE_URL; // a `netlify dev` origin serving the edge function
const TERMINEE_SLUG = process.env.E2E_TERMINEE_SLUG;

test.describe('2B ended campaign page', () => {
  test.skip(!configured, 'E2E_BASE_URL not configured');

  test('anonymous visitor lands on the branded ended page (no login bounce)', async ({ page }) => {
    await page.goto('/campagne-terminee');
    await expect(page).toHaveURL(/\/campagne-terminee$/); // not redirected to /login
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Cette campagne n'est plus active");
    await expect(page.getByText(/ne pointe vers aucune offre/)).toBeVisible();
    const cta = page.getByRole('link', { name: 'Découvrir Cupdom' });
    await expect(cta).toHaveAttribute('href', 'https://cupdom.fr');
  });

  test('scanning a Terminée slug ends on the ended page (edge hand-off)', async ({ page }) => {
    test.skip(!SCAN_BASE || !TERMINEE_SLUG, 'netlify dev origin / Terminée slug not provided');
    await page.goto(`${SCAN_BASE}/s/${TERMINEE_SLUG}`);
    await expect(page).toHaveURL(/\/campagne-terminee$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Cette campagne n'est plus active");
  });
});
