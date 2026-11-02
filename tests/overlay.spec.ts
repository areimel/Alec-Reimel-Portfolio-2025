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

test('noise layer moves by transform with no GIF requested', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('/');
  // Anime.js pauses its engine while the document is hidden, which parallel WebKit pages can be.
  await page.bringToFront();
  const noise = page.locator('.terminal-overlay .noise');
  const transform = () => noise.evaluate((el) => (el as HTMLElement).style.transform);
  // Wait for the first jitter tick (module load time varies), then require movement within 1s (loaded CI workers can stall a 15fps timer past 500ms).
  await expect.poll(transform, { timeout: 5000 }).not.toBe('');
  const first = await transform();
  await expect.poll(transform, { timeout: 1000 }).not.toBe(first);
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
