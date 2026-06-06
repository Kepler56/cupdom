import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end proof of Spec 1E: archive → hidden → Archivés → restore, + read-only scope.
 *
 * Requires a running app + a live test Supabase project (0001–0005 applied) with two
 * seeded members. Provide: E2E_BASE_URL, E2E_MEMBER_A_EMAIL, E2E_MEMBER_A_PASSWORD.
 * Skipped when absent. Run: pnpm exec playwright install && pnpm test:e2e
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

async function createAndOpenContact(page: Page): Promise<string> {
  const company = `1E ${Date.now()}`;
  await page.goto('/contacts');
  await page.getByRole('button', { name: '+ Nouveau contact' }).click();
  await page.getByLabel('Entreprise').fill(company);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('link', { name: company }).click();
  await page.waitForURL('**/contacts/**');
  return company;
}

test.describe('1E archive / restore', () => {
  test.skip(!configured, 'E2E env not configured');

  test('archive hides the contact; Archivés lists it; restore brings it back', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    const company = await createAndOpenContact(page);

    // Archive from the hub.
    await page.getByRole('button', { name: 'Archiver' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Archiver' }).click();
    await page.waitForURL('**/contacts');

    // Gone from the active list.
    await expect(page.getByRole('link', { name: company })).toHaveCount(0);

    // Present in Archivés with a purge countdown.
    await page.getByRole('button', { name: 'Archivés' }).click();
    await expect(page.getByText(company)).toBeVisible();
    await expect(page.getByText(/Supprimé dans/)).toBeVisible();

    // Restore → returns to the active list.
    await page.getByRole('button', { name: 'Restaurer' }).first().click();
    await page.getByRole('button', { name: 'Actifs' }).click();
    await expect(page.getByRole('link', { name: company })).toBeVisible();
  });

  test('Tous scope hides archive/restore controls (read-only)', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/contacts');
    await page.getByLabel('Vue').selectOption('all');
    await page.getByRole('button', { name: 'Archivés' }).click();
    await expect(page.getByRole('button', { name: 'Restaurer' })).toHaveCount(0);
  });
});
