import { expect, test } from '@playwright/test';

/**
 * E2E for Spec 4 AC-10/11: the two public pages are a separate, unauthenticated surface (no (app)
 * shell) sharing only the tokens — the minimal lead form and the branded ended page.
 *
 * Requires a running app (E2E_BASE_URL) and a seeded Active campaign slug (E2E_ACTIVE_SLUG) for the
 * form. The ended page needs no DB. Skipped when E2E_BASE_URL is absent. Run: pnpm test:e2e
 */
const BASE = process.env.E2E_BASE_URL;
const ACTIVE = process.env.E2E_ACTIVE_SLUG;
const configured = Boolean(BASE);

test.describe('Spec 4 public pages', () => {
  test.skip(!configured, 'E2E_BASE_URL not configured');

  test('the ended page is branded, unauthenticated, and has no app shell', async ({ page }) => {
    await page.goto('/campagne-terminee');
    await expect(page).toHaveURL(/\/campagne-terminee$/); // not bounced to /login
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Découvrir Cupdom' })).toHaveAttribute('href', 'https://cupdom.fr');
    // No (app) shell chrome (the sidebar nav is absent on the public surface).
    await expect(page.getByRole('link', { name: 'Pipeline' })).toHaveCount(0);
  });

  test('the lead form is minimal: four fields + un-ticked consent + Confidentialité, no shell', async ({ page }) => {
    test.skip(!ACTIVE, 'E2E_ACTIVE_SLUG not provided');
    await page.goto(`/c/${ACTIVE}`);
    await expect(page.getByLabel('Prénom')).toBeVisible();
    await expect(page.getByLabel('Nom')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Téléphone')).toBeVisible();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByRole('link', { name: 'Politique de confidentialité' })).toBeVisible();
    await expect(page.getByRole('button', { name: "Recevoir l'offre" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pipeline' })).toHaveCount(0); // no app shell
  });
});
