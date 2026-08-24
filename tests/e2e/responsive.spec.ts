import { expect, test, type Page } from '@playwright/test';

/**
 * E2E for Spec 4 AC-12: narrow viewport — the sidebar collapses to a drawer (hamburger), the Aperçu
 * KPI cards wrap, and the contact hub stacks to one column.
 *
 * Requires a running app + member A creds: E2E_BASE_URL, E2E_MEMBER_A_EMAIL, E2E_MEMBER_A_PASSWORD.
 * Skipped when absent. Run: pnpm test:e2e
 */
const WIDTHS = [
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'tablette portrait', width: 820, height: 1180 },
  { name: 'bureau', width: 1440, height: 900 },
];

/**
 * The page must never scroll sideways, whatever a table inside it does.
 *
 * A table that scrolls inside its own `overflow-x-auto` box is correct — that is
 * how seven columns reach a 390 px screen without anything being hidden. A PAGE
 * that scrolls sideways is the bug: it drags the header and the nav off with it,
 * and a reader cannot tell that apart from a broken site.
 */
async function expectNoPageOverflow(page: Page, where: string) {
  const box = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    box.scrollWidth,
    `${where} déborde : ${box.scrollWidth}px de contenu pour ${box.clientWidth}px de fenêtre`,
  ).toBeLessThanOrEqual(box.clientWidth + 1); // +1 absorbs sub-pixel rounding
}

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

/**
 * The public surface needs no credentials — and it is the one a consumer meets on
 * a phone, straight off a QR scan, so it is the one that must never be broken.
 */
test.describe('surface publique responsive', () => {
  test.skip(!process.env.E2E_BASE_URL, 'E2E_BASE_URL not configured');

  for (const viewport of WIDTHS) {
    test(`la page de fin de campagne tient dans ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/campagne-terminee');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoPageOverflow(page, `/campagne-terminee en ${viewport.name}`);
    });

    test(`la politique de confidentialité tient dans ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/confidentialite');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoPageOverflow(page, `/confidentialite en ${viewport.name}`);
    });
  }

  for (const viewport of WIDTHS) {
    test(`le formulaire de capture tient dans ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      test.skip(!process.env.E2E_ACTIVE_SLUG, 'E2E_ACTIVE_SLUG not provided');
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/c/${process.env.E2E_ACTIVE_SLUG}`);
      await expect(page.getByLabel('Prénom')).toBeVisible();
      await expectNoPageOverflow(page, `/c/:slug en ${viewport.name}`);
    });
  }

  /**
   * Asserted on /login rather than /c/:slug because both render the same `Input`
   * atom and this one needs no seeded campaign — so the guard runs in every
   * environment instead of skipping in most of them.
   *
   * Under 16px Safari zooms the page on focus and never zooms back: the layout
   * jumps mid-typing, on the one screen filled in by a stranger holding a phone.
   */
  test('les champs font 16px sur mobile — sinon iOS zoome à la saisie', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    const size = await page.getByLabel('E-mail').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
    await expectNoPageOverflow(page, '/login en iPhone 14');
  });
});

test.describe('application responsive', () => {
  test.skip(!configured, 'E2E member env not configured');

  for (const viewport of WIDTHS) {
    test(`aucun débordement horizontal en ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);

      for (const route of ['/apercu', '/contacts', '/pipeline', '/taches', '/rappels', '/campagnes']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoPageOverflow(page, `${route} en ${viewport.name}`);
      }
    });
  }

  test('sur téléphone le tableau des contacts défile au lieu d’être rogné', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('/contacts');

    const table = page.getByRole('table');
    test.skip((await table.count()) === 0, 'aucun contact dans ce scope');

    // It used to sit behind `overflow-hidden`, which CLIPS: the owner, the date and
    // the row actions simply vanished with nothing on screen saying so.
    const scroller = table.locator('xpath=ancestor::div[1]');
    const box = await scroller.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(box.scroll).toBeGreaterThan(box.client);

    await expectNoPageOverflow(page, '/contacts en 390px');
  });
});
