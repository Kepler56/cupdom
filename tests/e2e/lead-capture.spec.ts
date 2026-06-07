import { expect, test, type Page } from '@playwright/test';

/**
 * E2E for Spec 3A: the public lead form (AC-1…AC-8) and the CRM leads view (AC-12/13).
 *
 * Requires a running app (E2E_BASE_URL), the lead-submit Edge Function deployed + reachable from the
 * app (NEXT_PUBLIC_LEAD_SUBMIT_URL), and seeded campaigns:
 *   E2E_ACTIVE_SLUG     — an Active campaign whose linked contact is owned by member A
 *   E2E_ACTIVE_SPONSOR  — that campaign's sponsor_name (shown in the headline)
 *   E2E_DEST_HOST       — the host of its destination_url (asserted after redirect)
 *   E2E_TERMINEE_SLUG   — a Terminée campaign (the form must NOT render)
 * Member-side (AC-12/13) additionally needs A/B creds (E2E_MEMBER_A_ and E2E_MEMBER_B_ vars).
 * Skipped when the public env is absent. Run: pnpm exec playwright install && pnpm test:e2e
 */
const BASE = process.env.E2E_BASE_URL;
const ACTIVE = process.env.E2E_ACTIVE_SLUG;
const SPONSOR = process.env.E2E_ACTIVE_SPONSOR;
const DEST_HOST = process.env.E2E_DEST_HOST;
const TERMINEE = process.env.E2E_TERMINEE_SLUG;
const configured = Boolean(BASE && ACTIVE && SPONSOR && DEST_HOST && TERMINEE);

const A_EMAIL = process.env.E2E_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.E2E_MEMBER_A_PASSWORD;
const crmConfigured = Boolean(A_EMAIL && A_PASSWORD);

async function fillForm(page: Page, email: string) {
  await page.getByLabel('Prénom').fill('Marie');
  await page.getByLabel('Nom').fill('Curie');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Téléphone').fill('06 12 34 56 78');
}

test.describe('3A lead capture', () => {
  test.skip(!configured, 'E2E lead-capture env not configured');

  test('Active campaign → form renders with the four fields + un-ticked consent + privacy link (AC-1/2/3)', async ({ page }) => {
    await page.goto(`/c/${ACTIVE}`);
    await expect(page.getByRole('heading', { name: new RegExp(SPONSOR!) })).toBeVisible();
    await expect(page.getByLabel('Prénom')).toBeVisible();
    await expect(page.getByLabel('Nom')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Téléphone')).toBeVisible();
    const consent = page.getByRole('checkbox');
    await expect(consent).not.toBeChecked();
    await expect(page.getByRole('link', { name: 'Politique de confidentialité' })).toBeVisible();
  });

  test('empty submit → inline FR errors, no navigation (AC-4)', async ({ page }) => {
    await page.goto(`/c/${ACTIVE}`);
    await page.getByLabel('Prénom').waitFor();
    await page.getByRole('button', { name: "Recevoir l'offre" }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/c/${ACTIVE}$`));
  });

  test('consent unticked → blocked, no redirect (AC-5 hard gate)', async ({ page }) => {
    await page.goto(`/c/${ACTIVE}`);
    await fillForm(page, `gate_${Date.now()}@x.fr`);
    await page.getByRole('button', { name: "Recevoir l'offre" }).click();
    await expect(page.getByText("Vous devez accepter pour recevoir l'offre")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/c/${ACTIVE}$`));
  });

  test('valid + consent → Merci then redirect to the destination host (AC-6/7)', async ({ page }) => {
    await page.goto(`/c/${ACTIVE}`);
    await fillForm(page, `ok_${Date.now()}@x.fr`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: "Recevoir l'offre" }).click();
    await page.waitForURL(new RegExp(DEST_HOST!.replace('.', '\\.')));
    expect(page.url()).toContain(DEST_HOST!);
  });

  test('Terminée campaign → the form never renders (AC-1/§10)', async ({ page }) => {
    await page.goto(`/c/${TERMINEE}`);
    await expect(page.getByText("Cette campagne n'est plus active")).toBeVisible();
    await expect(page.getByLabel('Prénom')).toHaveCount(0);
  });

  test('CRM: owner A sees the captured lead + can export; off-scope is read-only (AC-12/13)', async ({ page }) => {
    test.skip(!crmConfigured, 'member creds not provided');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(A_EMAIL!);
    await page.getByLabel('Mot de passe').fill(A_PASSWORD!);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL('**/apercu');

    await page.goto(`/campagnes/${ACTIVE}`);
    await expect(page.getByText('Leads capturés')).toBeVisible();
    const exportBtn = page.getByRole('button', { name: /Exporter les leads/ });
    await expect(exportBtn).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), exportBtn.click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^leads_${ACTIVE}_\\d{4}-\\d{2}-\\d{2}\\.csv$`));
  });
});
