import { test, expect, type Page } from './fixtures';

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
