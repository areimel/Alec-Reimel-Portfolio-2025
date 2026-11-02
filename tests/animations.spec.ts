import { test, expect } from './fixtures';

const fixture = '/review-fixtures/animations';

test('standalone Unicode text and loading completion settle correctly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#unicode .decoder-text')).toHaveCSS('opacity', '1');
  await expect(page.locator('#unicode .decoder-text')).toHaveText('A 🧪 third word');
  await expect(page.locator('#loading .decoder-text')).toHaveCSS('opacity', '1');
  await expect(page.locator('#loading .decoder-text')).toHaveText('Loading complete');
  expect(
    await page
      .locator('#unicode .decoder-char')
      .evaluateAll((chars) => chars.map((char) => Number((char as HTMLElement).dataset.index)))
  ).toEqual([0, 2, 4, 5, 6, 7, 8, 10, 11, 12, 13]);
  expect(errors).toEqual([]);
});

for (const trigger of ['hover', 'click'] as const) {
  test(`${trigger} triggers replay after completion`, async ({ page }) => {
    await page.goto(fixture);
    await expect(page.locator('#loading-screen')).toBeHidden();
    const target = page.locator(`#${trigger} .animation-wrapper`);
    const text = target.locator('.decoder-text');
    const finalText = trigger === 'hover' ? 'Hover replay' : 'Click replay';
    await expect(text).toHaveText(finalText);
    await expect(text).toHaveCSS('opacity', '1');
    for (let replay = 0; replay < 2; replay++) {
      if (trigger === 'hover') {
        await page.mouse.move(0, 0);
        await target.hover();
      } else await target.click();
      await expect(text).not.toHaveText(finalText);
      await expect(text).toHaveText(finalText);
    }
  });
}

test('in-view waits for visibility and applies initial delay once', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const text = page.locator('#in-view .decoder-text');
  await expect(text).toHaveCSS('opacity', '0');
  await text.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect(text).toHaveCSS('opacity', '0');
  await expect(text).toHaveCSS('opacity', '1', { timeout: 1500 });
  await expect(text).toHaveText('Visible later', { timeout: 700 });
  expect(errors).toEqual([]);
});

test('mobileDisable keeps final text on mobile clicks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const text = page.locator('#mobile .decoder-text');
  await expect(text).toHaveCSS('opacity', '1');
  await text.click();
  await expect(text).toHaveText('Mobile readable');
  await page.waitForTimeout(100);
  await expect(text).toHaveText('Mobile readable');
});

for (const mode of ['reduced-motion', 'no-javascript'] as const) {
  test(`${mode} leaves headings and trigger text readable`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: mode !== 'no-javascript', reducedMotion: 'reduce' });
    await context.route('https://**/*', (route) => route.fulfill({ status: 204, body: '' }));
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4399${fixture}`);
    for (const id of ['unicode', 'loading', 'hover', 'click', 'mobile', 'in-view']) {
      await expect(page.locator(`#${id} .decoder-text`)).toHaveCSS('opacity', '1');
    }
    await expect(page.locator('#unicode')).toHaveText('A 🧪 third word');
    await expect(page.locator('#unicode')).toBeVisible();
    if (mode === 'no-javascript') await expect(page.locator('#loading-screen')).toBeHidden();
    await context.close();
  });
}

test('rapid navigation cancels decoding without errors and reinitializes on return', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.locator('#click .animation-wrapper').click();
  await page.locator('a[href="/"]').click();
  // Give browser-driven view transitions a separate navigation budget.
  await expect(page).toHaveURL('/', { timeout: 15_000 });
  await page.goBack();
  await expect(page).toHaveURL(fixture, { timeout: 15_000 });
  await page.locator('#click .animation-wrapper').click();
  await expect(page.locator('#click .decoder-text')).not.toHaveText('Click replay');
  await expect(page.locator('#click .decoder-text')).toHaveText('Click replay');
  expect(errors).toEqual([]);
});
