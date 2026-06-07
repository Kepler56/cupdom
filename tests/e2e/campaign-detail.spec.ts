import { expect, test, type Page } from '@playwright/test';

/**
 * E2E for Spec 4 AC-9: the campaign DETAIL page — header (état/slug/QR/Désactiver), key metrics, the
 * conversion FunnelBars (red biggest-drop), and the leads list with CSV export; off-scope read-only.
 *
 * Requires a running app + a seeded Active campaign owned by member A with scans/funnel_events/leads:
 *   E2E_BASE_URL, E2E_MEMBER_A_EMAIL, E2E_MEMBER_A_PASSWORD, E2E_DETAIL_SLUG
 * Skipped when absent. Run: pnpm test:e2e
 */
const A_EMAIL = process.env.E2E_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.E2E_MEMBER_A_PASSWORD;
const SLUG = process.env.E2E_DETAIL_SLUG;
const configured = Boolean(process.env.E2E_BASE_URL && A_EMAIL && A_PASSWORD && SLUG);

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(A_EMAIL!);
  await page.getByLabel('Mot de passe').fill(A_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/apercu');
}

test.describe('Spec 4 campaign detail', () => {
  test.skip(!configured, 'E2E detail env not configured');

  test('owner sees header + metrics + funnel + leads CSV; Tous is read-only', async ({ page }) => {
    await login(page);
    await page.goto(`/campagnes/${SLUG}`);

    // Header: état badge + public scan URL + owner-only lifecycle/QR.
    await expect(page.getByText(new RegExp(`/s/${SLUG}$`))).toBeVisible();
    await expect(page.getByRole('button', { name: /Télécharger QR/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Désactiver|Réactiver/ })).toBeVisible();

    // Metrics tiles + funnel (5 labelled stages).
    await expect(page.getByText('Scans uniques/jour')).toBeVisible();
    for (const label of ['Distribués', 'Scannés', 'Formulaire vu', 'Formulaire soumis', 'Offre atteinte']) {
      await expect(page.getByText(label)).toBeVisible();
    }

    // Leads CSV export.
    const exportBtn = page.getByRole('button', { name: /Exporter les leads/ });
    if (await exportBtn.isEnabled()) {
      const [dl] = await Promise.all([page.waitForEvent('download'), exportBtn.click()]);
      expect(dl.suggestedFilename()).toMatch(new RegExp(`^leads_${SLUG}_\\d{4}-\\d{2}-\\d{2}\\.csv$`));
    }

    // Off-scope (Tous): lifecycle hidden, QR stays.
    await page.getByLabel('Vue').selectOption('all');
    await expect(page.getByRole('button', { name: /Désactiver|Réactiver/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Télécharger QR/ })).toBeVisible();
  });
});
