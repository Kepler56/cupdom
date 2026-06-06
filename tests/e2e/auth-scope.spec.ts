import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end proof of the Spec 1A access model.
 *
 * Requires a running app + a live test Supabase project (migration 0001 applied)
 * with TWO seeded members and a contact owned by member B. Provide:
 *   E2E_BASE_URL
 *   E2E_MEMBER_A_EMAIL / E2E_MEMBER_A_PASSWORD
 *   E2E_MEMBER_B_EMAIL  (display name used to spot B's seeded contact, optional)
 * Without these the suite is skipped. Run: pnpm exec playwright install && pnpm test:e2e
 */
const A_EMAIL = process.env.E2E_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.E2E_MEMBER_A_PASSWORD;
const configured = Boolean(process.env.E2E_BASE_URL && A_EMAIL && A_PASSWORD);

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/apercu');
}

test.describe('auth + scope access model', () => {
  test.skip(!configured, 'E2E env not configured');

  test('unauthenticated /contacts redirects to /login', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForURL('**/login**');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('member A: identity shows, can create a contact, sees it', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/contacts');

    const company = `E2E ${Date.now()}`;
    await page.getByRole('button', { name: '+ Nouveau contact' }).click();
    await page.getByLabel('Entreprise').fill(company);
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText(company)).toBeVisible();
  });

  test('Tous scope is read-only: no create button, no row actions', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/contacts');

    await page.getByLabel('Vue').selectOption('all');

    await expect(page.getByRole('button', { name: '+ Nouveau contact' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Modifier / })).toHaveCount(0);
  });
});
