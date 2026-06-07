import { expect, test } from '@playwright/test';

/**
 * E2E for Spec 3B AC-19: the public /confidentialite privacy policy renders unauthenticated with the
 * required French sections, the retention figure, the rights, and the contact mailto. Runs against any
 * running app (E2E_BASE_URL) — no DB or auth needed.
 */
const configured = Boolean(process.env.E2E_BASE_URL);

test.describe('3B privacy policy', () => {
  test.skip(!configured, 'E2E_BASE_URL not configured');

  test('renders the required French sections without auth (not bounced to /login)', async ({ page }) => {
    await page.goto('/confidentialite');
    await expect(page).toHaveURL(/\/confidentialite$/); // not redirected to /login

    for (const heading of [
      'Responsables du traitement',
      'Finalités',
      'Destinataires',
      'Durée de conservation',
      'Vos droits',
      'Nous contacter',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }

    await expect(page.getByText(/36 mois/)).toBeVisible();
    await expect(page.getByText(/anonymis/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'confidentialite@cupdom.fr' })).toHaveAttribute(
      'href',
      'mailto:confidentialite@cupdom.fr',
    );
  });
});
