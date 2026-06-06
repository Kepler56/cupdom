import { expect, test, type Page } from '@playwright/test';

/**
 * E2E for Spec 2A: campaign create → QR → duplicate → lifecycle → delete guard → read-only scope.
 *
 * Requires a running app + a live test Supabase project (migrations 0001+0002+0005+0006) with two
 * seeded members; member A must own a non-archived contact that has at least one deal. Provide:
 *   E2E_BASE_URL, E2E_MEMBER_A_EMAIL, E2E_MEMBER_A_PASSWORD,
 *   E2E_A_CONTACT_LABEL (the option text of A's own contact in the create form),
 *   E2E_B_CAMPAIGN_NAME (a campaign owned by member B, to assert read-only in "Tous")
 * Skipped when absent. Run: pnpm exec playwright install && pnpm test:e2e
 */
const A_EMAIL = process.env.E2E_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.E2E_MEMBER_A_PASSWORD;
const A_CONTACT = process.env.E2E_A_CONTACT_LABEL;
const B_CAMPAIGN = process.env.E2E_B_CAMPAIGN_NAME;
const configured = Boolean(process.env.E2E_BASE_URL && A_EMAIL && A_PASSWORD && A_CONTACT);

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/apercu');
}

async function createCampaign(page: Page, name: string, destination: string) {
  await page.getByRole('button', { name: '+ Nouvelle campagne' }).click();
  await page.getByLabel('Contact').selectOption({ label: A_CONTACT! });
  await page.getByLabel('Deal').selectOption({ index: 1 }); // first real deal
  await page.getByLabel('Nom de la campagne').fill(name);
  await page.getByLabel('Destination (http/https)').fill(destination);
  await page.getByRole('button', { name: 'Créer' }).click();
}

test.describe('2A campaigns end-to-end', () => {
  test.skip(!configured, 'E2E env not configured');

  const NAME = 'E2E Nike Été';
  const DEST = 'https://nike.fr/ete-e2e';

  test('create → QR immutable → lifecycle → delete guard', async ({ page }) => {
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/campagnes');

    // Deal required (AC-3): submitting without a deal shows the message.
    await page.getByRole('button', { name: '+ Nouvelle campagne' }).click();
    await page.getByLabel('Nom de la campagne').fill(NAME);
    await page.getByLabel('Destination (http/https)').fill(DEST);
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText('Un deal est requis.')).toBeVisible();
    // Invalid destination (AC-4).
    await page.getByLabel('Contact').selectOption({ label: A_CONTACT! });
    await page.getByLabel('Deal').selectOption({ index: 1 });
    await page.getByLabel('Destination (http/https)').fill('ftp://x');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText(/http\/https requis/)).toBeVisible();
    // Now valid (AC-1/2/8): the row appears Active.
    await page.getByLabel('Destination (http/https)').fill(DEST);
    await page.getByRole('button', { name: 'Créer' }).click();
    const row = page.getByRole('row', { name: new RegExp(NAME) });
    await expect(row.getByText('Active')).toBeVisible();

    // QR (AC-9/10): open, download SVG, capture the /s/<slug> URL.
    await row.getByRole('button', { name: 'Voir le QR' }).click();
    const urlText = await page.getByTitle('Copier le lien').textContent();
    expect(urlText).toMatch(/\/s\/[a-z2-9]{6,8}$/);
    const [svg] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'SVG' }).click(),
    ]);
    expect(svg.suggestedFilename()).toMatch(/^qr_[a-z2-9]{6,8}\.svg$/);
    await page.getByRole('button', { name: 'Fermer' }).click();

    // Lifecycle (AC-11/12): deactivate → Terminée; reactivate → Active.
    await row.getByRole('button', { name: 'Terminer' }).click();
    await expect(row.getByText('Terminée')).toBeVisible();
    await row.getByRole('button', { name: 'Réactiver' }).click();
    await expect(row.getByText('Active')).toBeVisible();

    // Destination edit keeps the slug/QR (AC-13).
    await row.getByRole('button', { name: "Plus d'actions" }).click();
    await page.getByRole('button', { name: 'Modifier la destination' }).click();
    await page.getByLabel('Destination (http/https)').fill(`${DEST}-v2`);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await row.getByRole('button', { name: 'Voir le QR' }).click();
    expect(await page.getByTitle('Copier le lien').textContent()).toBe(urlText);
    await page.getByRole('button', { name: 'Fermer' }).click();

    // Event log (AC-17): create + deactivate + reactivate + destination change.
    await row.getByRole('button', { name: "Plus d'actions" }).click();
    await page.getByRole('button', { name: 'Historique' }).click();
    await expect(page.getByText('Création')).toBeVisible();
    await expect(page.getByText('Désactivation')).toBeVisible();
    await expect(page.getByText('Changement de destination')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer' }).click();

    // Delete guard (AC-14): a freshly created, never-scanned campaign is deletable.
    await row.getByRole('button', { name: "Plus d'actions" }).click();
    await page.getByRole('button', { name: 'Supprimer' }).click();
    await page.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByRole('row', { name: new RegExp(NAME) })).toHaveCount(0);
  });

  test('read-only off-scope (AC-16/26): Tous hides create + edit controls, QR stays', async ({ page }) => {
    test.skip(!B_CAMPAIGN, 'E2E_B_CAMPAIGN_NAME not provided');
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/campagnes');
    await page.getByLabel('Vue').selectOption('all');

    await expect(page.getByRole('button', { name: '+ Nouvelle campagne' })).toHaveCount(0);
    const bRow = page.getByRole('row', { name: new RegExp(B_CAMPAIGN!) });
    await expect(bRow.getByRole('button', { name: 'Voir le QR' })).toBeVisible();
    await expect(bRow.getByRole('button', { name: 'Terminer' })).toHaveCount(0);
    await expect(bRow.getByRole('button', { name: 'Réactiver' })).toHaveCount(0);
  });
});
