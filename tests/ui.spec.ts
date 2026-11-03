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
  // Cursors only animate while on screen, and this one starts below the fold.
  await page.locator('.flashing:visible').first().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('.flashing:visible')
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
  // Cursors only animate while on screen, and this one starts below the fold.
  await page.locator('.flashing:visible').first().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('.flashing:visible')
        .first()
        .evaluate((el) => el.getAnimations().length)
    )
    .toBe(1);
  const opacities = await page
    .locator('.flashing:visible')
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

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;
const isBelowFold = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect().top > window.innerHeight);

test('reveal targets show after scrolling', async ({ page }) => {
  await ready(page, '/about');
  const target = page.locator('.reveal:visible').last();
  if (isDesktop(page)) {
    expect(await isBelowFold(target)).toBe(true);
    expect(await opacityOf(target)).toBe('0');
  }
  await target.scrollIntoViewIfNeeded();
  await expect.poll(() => opacityOf(target), { timeout: 5000 }).toBe('1');
});

test('reveal taller than 4 viewports appears', async ({ page }) => {
  await ready(page, '/review-fixtures/animations');
  const tall = page.locator('#reveal-tall');
  if (isDesktop(page)) {
    expect(await isBelowFold(tall)).toBe(true);
    expect(await opacityOf(tall)).toBe('0');
  }
  await tall.scrollIntoViewIfNeeded();
  await expect.poll(() => opacityOf(tall), { timeout: 5000 }).toBe('1');
});

test('hash link target appears', async ({ page }) => {
  await ready(page, '/review-fixtures/animations#reveal-target');
  await expect.poll(() => opacityOf(page.locator('#reveal-target')), { timeout: 5000 }).toBe('1');
  // The hash jump leaves this one above the viewport, so it is still hidden on desktop.
  if (isDesktop(page)) expect(await opacityOf(page.locator('#reveal-above'))).toBe('0');
});

test('print shows unrevealed targets', async ({ page }) => {
  await ready(page, '/review-fixtures/animations');
  await page.emulateMedia({ media: 'print' });
  expect(await opacityOf(page.locator('#reveal-tall'))).toBe('1');
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
  test.skip(!isDesktop(page), 'reveals do not animate below 768px');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page, '/review-fixtures/animations');
  const target = page.locator('#reveal-target');
  await target.scrollIntoViewIfNeeded();
  // Leave only once the reveal is actually running.
  await expect.poll(() => target.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('main a[href="/"]')!.click());
  await page.waitForURL('**/');
  await page.goBack();
  await page.waitForURL('**/review-fixtures/animations');
  // Everything reveals once scrolled to; nothing may stay hidden or displaced.
  const count = await page.locator('.reveal').count();
  for (let i = 0; i < count; i++) {
    const item = page.locator('.reveal').nth(i);
    await item.scrollIntoViewIfNeeded();
    await expect.poll(() => opacityOf(item), { timeout: 5000 }).toBe('1');
    await expect.poll(() => item.evaluate((el) => getComputedStyle(el).transform), { timeout: 5000 }).toBe('none');
  }
  expect(errors).toEqual([]);
});

test('cursors in a hidden modal do not animate until shown', async ({ page }) => {
  await ready(page, '/');
  await expect(page.locator('.modal-container.hidden .flashing').first()).toHaveCount(1);
  // A handle, because the locator would stop matching once the modal is shown.
  const hidden = await page.locator('.modal-container.hidden .flashing').first().elementHandle();
  if (!hidden) throw new Error('no hidden cursor');
  // A box-less animation can't run on the compositor and costs a style recalculation every frame.
  const running = () =>
    hidden.evaluate(
      (el: Element) => el.getAnimations().filter((animation) => animation.playState === 'running').length
    );
  await page.waitForTimeout(500);
  expect(await running()).toBe(0);
  await hidden.evaluate((el: Element) => el.closest('.modal-container')?.classList.remove('hidden'));
  await expect.poll(running).toBe(1);
});
