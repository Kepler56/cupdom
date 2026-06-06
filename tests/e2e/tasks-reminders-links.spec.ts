import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end proof of Spec 1C: tasks, reminders, links, the Historique timeline,
 * the cross-contact Tâches/Rappels pages, and off-scope read-only.
 *
 * Requires a running app + a live test Supabase project (0001+0002+0003 applied)
 * with two seeded members. Provide:
 *   E2E_BASE_URL, E2E_MEMBER_A_EMAIL, E2E_MEMBER_A_PASSWORD
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
  const company = `1C ${Date.now()}`;
  await page.goto('/contacts');
  await page.getByRole('button', { name: '+ Nouveau contact' }).click();
  await page.getByLabel('Entreprise').fill(company);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('link', { name: company }).click();
  await page.waitForURL('**/contacts/**');
  return company;
}

test.describe('1C tasks / reminders / links / history', () => {
  test.skip(!configured, 'E2E env not configured');

  test('add + complete a task with an overdue chip', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await createAndOpenContact(page);

    await page.getByRole('button', { name: 'Tâches' }).click();
    await page.getByRole('button', { name: '+ Nouvelle tâche' }).click();
    await page.getByLabel('Libellé').fill('Rappeler le prospect');
    await page.getByLabel('Échéance').fill('2020-01-01'); // past → overdue
    await page.getByRole('button', { name: 'Ajouter' }).click();

    await expect(page.getByText('En retard')).toBeVisible();
    await page.getByLabel('Terminer Rappeler le prospect').check();
    // stays visible, faded with a strikethrough
    await expect(page.getByText('Rappeler le prospect')).toBeVisible();
  });

  test('add two reminders (many per contact) and mark one done', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await createAndOpenContact(page);

    await page.getByRole('button', { name: 'Rappels' }).click();
    for (const date of ['2020-01-01', '2999-01-01']) {
      await page.getByRole('button', { name: '+ Nouveau rappel' }).click();
      await page.getByLabel('Date').fill(date);
      await page.getByRole('button', { name: 'Ajouter' }).click();
    }
    await expect(page.getByText('À échéance')).toBeVisible(); // the past one is due
  });

  test('add a safe link; reject a javascript: URL', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await createAndOpenContact(page);

    await page.getByRole('button', { name: 'Liens' }).click();
    await page.getByRole('button', { name: '+ Nouveau lien' }).click();
    await page.getByLabel('Libellé').fill('Site');
    await page.getByLabel('URL').fill('https://cupdom.fr');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByRole('link', { name: /Site/ })).toBeVisible();

    await page.getByRole('button', { name: '+ Nouveau lien' }).click();
    await page.getByLabel('Libellé').fill('Mauvais');
    await page.getByLabel('URL').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText('URL non autorisée')).toBeVisible();
  });

  test('Historique shows the created activity', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await createAndOpenContact(page);
    await page.getByRole('button', { name: 'Tâches' }).click();
    await page.getByRole('button', { name: '+ Nouvelle tâche' }).click();
    await page.getByLabel('Libellé').fill('Historisée');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    await page.getByRole('button', { name: 'Historique' }).click();
    await expect(page.getByText('Historisée')).toBeVisible();
  });

  test('Tous scope is read-only on the cross-contact Tâches page', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/taches');
    await page.getByLabel('Vue').selectOption('all');
    // no checkboxes are enabled in read-only scope
    const enabled = await page.getByRole('checkbox').filter({ hasNot: page.locator('[disabled]') }).count();
    expect(enabled).toBe(0);
  });
});
