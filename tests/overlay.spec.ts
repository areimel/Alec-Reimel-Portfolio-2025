import { test, expect, type Page } from './fixtures';

const animationCount = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => el.getAnimations().length);

async function scanlineReady(page: Page) {
  await page.goto('/');
  await expect.poll(() => animationCount(page, '.terminal-overlay .scanline')).toBeGreaterThan(0);
}

test('scanline animates transform only', async ({ page }) => {
  await scanlineReady(page);
  const properties = await page
    .locator('.terminal-overlay .scanline')
    .evaluate((el) =>
      el
        .getAnimations()
        .flatMap((animation) =>
          (animation as CSSAnimation & { effect: KeyframeEffect }).effect
            .getKeyframes()
            .flatMap((frame) => Object.keys(frame))
        )
    );
  const bookkeeping = new Set(['offset', 'computedOffset', 'easing', 'composite']);
  expect([...new Set(properties.filter((name) => !bookkeeping.has(name)))]).toEqual(['transform']);
});

test('toggling scanline off stops its animation', async ({ page }) => {
  await scanlineReady(page);
  await page.locator('#theme-settings-btn').click();
  await page.locator('label[for="scanline-effect"]').first().click();
  await expect(page.locator('.terminal-overlay .scanline')).toHaveClass(/hidden/);
  await expect
    .poll(() =>
      page
        .locator('.terminal-overlay .scanline')
        .evaluate((el) => el.getAnimations().filter((animation) => animation.playState === 'running').length)
    )
    .toBe(0);
});

test('noise moves on the compositor with no script tick', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('/');
  // Anime.js pauses its engine while the document is hidden, which parallel WebKit pages can be.
  await page.bringToFront();
  const noise = page.locator('.terminal-overlay .noise');
  await expect.poll(() => animationCount(page, '.terminal-overlay .noise')).toBeGreaterThan(0);

  // One stepped animation of transform keyframes does the work: no per-tick script writes the inline style.
  const shape = await noise.evaluate((el) => {
    const effect = el.getAnimations()[0].effect as KeyframeEffect;
    return {
      easing: effect.getTiming().easing,
      properties: [...new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame)))],
      keyframes: effect.getKeyframes().length,
    };
  });
  expect(shape.easing).toMatch(/^steps\(/);
  expect(
    shape.properties.filter((name) => !['offset', 'computedOffset', 'easing', 'composite'].includes(name))
  ).toEqual(['transform']);
  expect(shape.keyframes).toBeGreaterThan(30);

  const mutations = await noise.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        let count = 0;
        const observer = new MutationObserver((records) => (count += records.length));
        observer.observe(el, { attributes: true, attributeFilter: ['style'] });
        setTimeout(() => {
          observer.disconnect();
          resolve(count);
        }, 1500);
      })
  );
  expect(mutations).toBe(0);

  // It still moves: the computed transform changes, and the jitter stays within the layer's inset.
  const computed = () => noise.evaluate((el) => getComputedStyle(el).transform);
  const first = await computed();
  await expect.poll(computed, { timeout: 2000 }).not.toBe(first);
  expect(requested.filter((url) => url.includes('terminal-static-animated'))).toEqual([]);
});

test('overlay animation continues across navigation', async ({ page }) => {
  await scanlineReady(page);
  const time = () =>
    page.locator('.terminal-overlay .scanline').evaluate((el) => Number(el.getAnimations()[0]?.currentTime ?? 0));
  // A restart would reset currentTime to near zero, so let it advance first.
  await expect.poll(time).toBeGreaterThan(400);
  const before = await time();
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  expect(await time()).toBeGreaterThan(before);
});

test('overlay still animating after back/forward', async ({ page }) => {
  await scanlineReady(page);
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  await page.goBack();
  await expect(page.locator('main')).toBeVisible();
  await expect.poll(() => animationCount(page, '.terminal-overlay .scanline')).toBeGreaterThan(0);
});
