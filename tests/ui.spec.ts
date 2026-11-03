import { test, expect, type Locator, type Page } from './fixtures';

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 15000 });
  await page.bringToFront();
}

test('modal opens and closes through waapi', async ({ page }) => {
  await ready(page, '/contact');
  await page.evaluate(() => window.openthankYouFullModal());
  const animating = await page.locator('#thankYouFull-content').evaluate((el) => el.getAnimations().length);
  expect(animating).toBeGreaterThan(0);
  await expect(page.locator('#thankYouFull-container [role=dialog]')).toBeVisible();
  await expect.poll(() => page.locator('#thankYouFull-content').evaluate((el) => el.getAnimations().length)).toBe(0);
  await page.evaluate(() => window.closethankYouFullModal?.());
  await expect(page.locator('#thankYouFull-container')).toHaveClass(/hidden/);
});

test('rapid open and close settles correctly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page, '/contact');
  await page.evaluate(() => {
    window.openthankYouFullModal();
    window.closethankYouFullModal?.();
    window.openthankYouFullModal();
    window.closethankYouFullModal?.();
  });
  await page.waitForTimeout(500);
  await expect(page.locator('#thankYouFull-container')).toHaveClass(/hidden/);
  expect(errors).toEqual([]);
});

test('modal-opened fires with the content element', async ({ page }) => {
  await ready(page, '/contact');
  const id = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener('modal-opened', (event) => resolve((event as CustomEvent).detail.id), { once: true });
        window.openthankYouFullModal();
      })
  );
  expect(id).toBe('thankYouFull-content');
});

test('cursor blinks with one animation per cursor', async ({ page }) => {
  await ready(page, '/contact');
  await expect
    .poll(() =>
      page
        .locator('.flashing')
        .first()
        .evaluate((el) => el.getAnimations().length)
    )
    .toBe(1);
});

test('cursor does not animate under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, '/contact');
  expect(
    await page
      .locator('.flashing')
      .first()
      .evaluate((el) => el.getAnimations().length)
  ).toBe(0);
});

test('no CSS keyframes left in ui components', async ({ page }) => {
  await ready(page, '/contact');
  const names = await page.evaluate(() =>
    document
      .getAnimations()
      .flatMap((animation) => ('animationName' in animation ? [String(animation.animationName)] : []))
  );
  expect(names).not.toContain('flash');
  expect(names).not.toContain('pulse');
});

test('cursor is fully on for half the cycle and fully off for the rest', async ({ page }) => {
  await ready(page, '/contact');
  const opacities = await page
    .locator('.flashing')
    .first()
    .evaluate((el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      return [100, 400, 600, 900].map((time) => {
        animation.currentTime = time;
        return getComputedStyle(el).opacity;
      });
    });
  expect(opacities).toEqual(['1', '1', '0', '0']);
});

const opacityOf = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).opacity);

test('reveal targets show after scrolling', async ({ page }) => {
  await ready(page, '/about');
  const target = page.locator('.reveal:visible').last();
  await target.scrollIntoViewIfNeeded();
  await expect.poll(() => opacityOf(target), { timeout: 5000 }).toBe('1');
});

test('reveal taller than 4 viewports appears', async ({ page }) => {
  await ready(page, '/review-fixtures/animations');
  const tall = page.locator('#reveal-tall');
  await tall.scrollIntoViewIfNeeded();
  await expect.poll(() => opacityOf(tall), { timeout: 5000 }).toBe('1');
});

test('hash link target appears', async ({ page }) => {
  await ready(page, '/review-fixtures/animations#reveal-target');
  await expect.poll(() => opacityOf(page.locator('#reveal-target')), { timeout: 5000 }).toBe('1');
});

test('reduced motion keeps reveal targets visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, '/review-fixtures/animations');
  expect(await opacityOf(page.locator('#reveal-tall'))).toBe('1');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('reveal targets stay visible', async ({ page }) => {
    await page.goto('/review-fixtures/animations');
    expect(await opacityOf(page.locator('#reveal-tall'))).toBe('1');
  });
});

test('navigating away mid-reveal then back shows content', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page, '/review-fixtures/animations');
  await page.locator('#reveal-target').scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: 'Home' }).click();
  await page.waitForURL('**/');
  await page.goBack();
  await page.waitForURL('**/review-fixtures/animations');
  // Everything reveals once scrolled to; nothing may stay at opacity 0.
  const count = await page.locator('.reveal').count();
  for (let i = 0; i < count; i++) {
    const item = page.locator('.reveal').nth(i);
    await item.scrollIntoViewIfNeeded();
    await expect.poll(() => opacityOf(item), { timeout: 5000 }).toBe('1');
  }
  expect(errors).toEqual([]);
});
