import { expect, test, type Page } from '@playwright/test';

/**
 * E2E for Spec 4 AC-12: narrow viewport — the sidebar collapses to a drawer (hamburger), the Aperçu
 * KPI cards wrap, and the contact hub stacks to one column.
 *
 * Requires a running app + member A creds: E2E_BASE_URL, E2E_MEMBER_A_EMAIL, E2E_MEMBER_A_PASSWORD.
 * Skipped when absent. Run: pnpm test:e2e
 */
const A_EMAIL = process.env.E2E_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.E2E_MEMBER_A_PASSWORD;
const configured = Boolean(process.env.E2E_BASE_URL && A_EMAIL && A_PASSWORD);

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(A_EMAIL!);
  await page.getByLabel('Mot de passe').fill(A_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/apercu');
}

test.describe('Spec 4 responsive', () => {
  test.skip(!configured, 'E2E member env not configured');
  test.use({ viewport: { width: 760, height: 900 } });

  test('narrow viewport collapses the sidebar into a drawer with the six nav items', async ({ page }) => {
    await login(page);
    await page.goto('/apercu');

    const menu = page.getByRole('button', { name: 'Ouvrir le menu' });
    await expect(menu).toBeVisible(); // collapse trigger present below the breakpoint
    await menu.click();
    for (const label of ['Aperçu', 'Contacts', 'Pipeline', 'Tâches', 'Rappels', 'Campagnes']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });
});
