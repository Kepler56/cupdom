import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end proof of Spec 1B: contact edit, deals, stage→statut, transfer, pipeline.
 *
 * Requires a running app + a live test Supabase project (migrations 0001 + 0002 applied)
 * with two seeded members. Provide:
 *   E2E_BASE_URL
 *   E2E_MEMBER_A_EMAIL / E2E_MEMBER_A_PASSWORD
 *   E2E_MEMBER_B_NAME   (member B's display name, to assert the owner chip after transfer)
 * Skipped when absent. Run: pnpm exec playwright install && pnpm test:e2e
 */
const A_EMAIL = process.env.E2E_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.E2E_MEMBER_A_PASSWORD;
const B_NAME = process.env.E2E_MEMBER_B_NAME;
const configured = Boolean(process.env.E2E_BASE_URL && A_EMAIL && A_PASSWORD);

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/apercu');
}

/** Create a contact with a unique company and open its hub; returns the company name. */
async function createAndOpenContact(page: Page): Promise<string> {
  const company = `1B ${Date.now()}`;
  await page.goto('/contacts');
  await page.getByRole('button', { name: '+ Nouveau contact' }).click();
  await page.getByLabel('Entreprise').fill(company);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('link', { name: company }).click();
  await page.waitForURL('**/contacts/**');
  return company;
}

test.describe('1B contact hub, deals, statut, transfer, pipeline', () => {
  test.skip(!configured, 'E2E env not configured');

  test('add a deal moves statut to En cours, then GAGNÉ → Client', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await createAndOpenContact(page);

    // Deals tab is the default tab.
    await page.getByRole('button', { name: '+ Nouveau deal' }).click();
    await page.getByLabel('Titre').fill('Été');
    await page.getByLabel('Étape').selectOption('NÉGOCIATION');
    await page.getByLabel('Valeur (€)').fill('2000');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    // Derived statut recomputes from the deal.
    await expect(page.getByText('En cours')).toBeVisible();

    // Quick stage change on the card → Client.
    await page.getByLabel('Étape').last().selectOption('GAGNÉ');
    await expect(page.getByText('Client')).toBeVisible();
  });

  test('pipeline shows the deal in its stage column', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await createAndOpenContact(page);
    await page.getByRole('button', { name: '+ Nouveau deal' }).click();
    await page.getByLabel('Titre').fill('Hiver');
    await page.getByLabel('Étape').selectOption('QUALIFICATION');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await page.goto('/pipeline');
    await expect(page.getByText('Hiver')).toBeVisible();
  });

  test('transfer flips ownership and removes the owner actions', async ({ page }) => {
    test.skip(!B_NAME, 'E2E_MEMBER_B_NAME not set');
    await login(page, A_EMAIL!, A_PASSWORD!);
    await createAndOpenContact(page);

    await page.getByRole('button', { name: 'Transférer' }).click();
    await page.getByLabel('Nouveau propriétaire').selectOption({ label: B_NAME! });
    await page.getByRole('dialog').getByRole('button', { name: 'Transférer' }).click();

    // Owner chip now shows B; A's edit actions are gone.
    await expect(page.getByText(B_NAME!)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modifier' })).toHaveCount(0);
  });

  test('Tous scope is read-only on the pipeline (no stage controls)', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/pipeline');
    await page.getByLabel('Vue').selectOption('all');
    await expect(page.getByLabel('Étape')).toHaveCount(0);
  });
});
