import { expect, test, type Locator, type Page } from './fixtures';

const endpoint = 'https://api.web3forms.com/submit';

async function fillForm(form: Locator) {
  await form.locator('[name="name"]').fill('Automated Review');
  await form.locator('[name="email"]').fill('review@example.com');
  await form.locator('[name="message"]').fill('This submission is intercepted by an automated browser test.');
  await form.locator('label:has([name="privacy_agreement"])').click();
  await expect(form.locator('[name="privacy_agreement"]')).toBeChecked();
  await form.locator('[name="privacy_agreement"]').focus();
  await expect(form.locator('.privacy-checkbox + .custom-checkbox')).not.toHaveCSS('box-shadow', 'none');
}

async function openForm(page: Page, kind: string) {
  await page.goto(kind === 'full' ? '/contact' : '/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 15000 });
  if (kind === 'modal') {
    await page.evaluate(() => window.opencontactModal());
    await expect(page.locator('#contact-container')).toBeVisible();
  }
  return page.locator(`#contact-form-${kind}`);
}

for (const kind of ['full', 'modal']) {
  const successId = kind === 'full' ? 'thankYouFull' : 'thankYouModal';
  const errorId = kind === 'full' ? 'errorFull' : 'errorModal';

  test(`${kind}: native validation prevents empty submission`, async ({ page }) => {
    let requests = 0;
    await page.route(endpoint, async (route) => {
      requests++;
      await route.fulfill({ json: { success: true } });
    });
    const form = await openForm(page, kind);
    await form.locator('[type="submit"]').click();
    expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(false);
    expect(requests).toBe(0);
  });

  test(`${kind}: successful submission resets controls and can be repeated without duplicate requests`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route(endpoint, async (route) => {
      requests++;
      expect(route.request().postDataJSON().email).toBe('review@example.com');
      await route.fulfill({ json: { success: true, message: 'Sent' } });
    });
    const form = await openForm(page, kind);
    // Repeated lifecycle events must not attach duplicate submit listeners.
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (kind === 'modal' && attempt > 1) await page.evaluate(() => window.opencontactModal());
      await fillForm(form);
      await form.locator('label:has([name="contact_method"][value="phone"])').click();
      await expect(form.locator('[name="contact_method"][value="phone"]')).toBeChecked();
      await form.locator('[type="submit"]').click();
      await expect(page.locator(`#${successId}-container`)).toBeVisible();
      await expect(form.locator('[name="name"]')).toHaveValue('');
      await expect(form.locator('[name="privacy_agreement"]')).not.toBeChecked();
      await expect(form.locator('.check-icon')).toHaveClass(/opacity-0/);
      await expect(form.locator('[name="contact_method"][value="email"]')).toBeChecked();
      await expect(form.locator('[value="email"] + .custom-radio .radio-dot')).toHaveClass(/opacity-100/);
      await expect(form.locator('[type="submit"]')).toBeEnabled();
      expect(requests).toBe(attempt);
      await page.locator(`#${successId}-close`).click();
      await expect(page.locator(`#${successId}-container`)).toBeHidden();
    }
  });

  for (const failure of ['application', 'network']) {
    test(`${kind}: ${failure} failure keeps entered fields and allows retry`, async ({ page }) => {
      await page.route(endpoint, async (route) => {
        if (failure === 'network') await route.abort('failed');
        else await route.fulfill({ status: 200, json: { success: false, message: 'Rejected test submission' } });
      });
      const form = await openForm(page, kind);
      await fillForm(form);
      await form.locator('[type="submit"]').click();
      await expect(page.locator(`#${errorId}-container`)).toBeVisible();
      await expect(form.locator('[name="name"]')).toHaveValue('Automated Review');
      await expect(form.locator('[type="submit"]')).toBeEnabled();
      await expect(page.locator(`#${successId}-container`)).toBeHidden();
      if (failure === 'application') {
        await expect(page.locator(`#error-message-${kind}`)).toHaveText('Rejected test submission');
      }
      await page.locator(`#${errorId}-close`).click();
      if (kind === 'modal') await page.evaluate(() => window.opencontactModal());
      await page.route(endpoint, (route) => route.fulfill({ json: { success: true } }));
      await form.locator('[type="submit"]').click();
      await expect(page.locator(`#${successId}-container`)).toBeVisible();
    });
  }
}
