import { expect, test, type Page } from '@playwright/test';

/**
 * E2E for Spec 1F: the Contacts CSV export mirrors the current scope.
 *
 * Requires a running app + a live test Supabase project (0001+) with two seeded
 * members and a contact owned by member B. Provide:
 *   E2E_BASE_URL, E2E_MEMBER_A_EMAIL, E2E_MEMBER_A_PASSWORD, E2E_MEMBER_B_COMPANY
 * Skipped when absent. Run: pnpm exec playwright install && pnpm test:e2e
 */
const A_EMAIL = process.env.E2E_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.E2E_MEMBER_A_PASSWORD;
const B_COMPANY = process.env.E2E_MEMBER_B_COMPANY;
const configured = Boolean(process.env.E2E_BASE_URL && A_EMAIL && A_PASSWORD && B_COMPANY);

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/apercu');
}

async function exportContacts(page: Page): Promise<string> {
  await page.getByRole('button', { name: /Exporter/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Contacts', { exact: true }).click(),
  ]);
  return (await download.path()) ?? '';
}

test.describe('1F Contacts export mirrors scope', () => {
  test.skip(!configured, 'E2E env not configured');

  test('Tous includes a colleague row; Moi does not', async ({ page }) => {
    const fs = await import('node:fs/promises');
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/contacts');

    await page.getByLabel('Vue').selectOption('all');
    const tousPath = await exportContacts(page);
    expect(tousPath).toMatch(/contacts_tous_\d{4}-\d{2}-\d{2}\.csv$/);
    const tousText = await fs.readFile(tousPath, 'utf8');
    expect(tousText.charCodeAt(0)).toBe(0xfeff);
    expect(tousText).toContain(B_COMPANY!);

    await page.getByLabel('Vue').selectOption('me');
    const moiPath = await exportContacts(page);
    expect(moiPath).toMatch(/contacts_moi_\d{4}-\d{2}-\d{2}\.csv$/);
    const moiText = await fs.readFile(moiPath, 'utf8');
    expect(moiText).not.toContain(B_COMPANY!);
  });
});
