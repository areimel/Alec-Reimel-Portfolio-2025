import { test, expect } from './fixtures';

const FORBIDDEN = ['boxShadow', 'textShadow', 'width', 'backgroundPosition'];

test('boot animates no shadow or width properties', async ({ page }) => {
  await page.addInitScript(() => {
    const seen = new Set<string>();
    (window as unknown as { __seen: Set<string> }).__seen = seen;
    const sample = () => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        for (const frame of effect?.getKeyframes() ?? []) {
          for (const key of Object.keys(frame)) seen.add(key);
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  const seen = await page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen]);
  expect(seen.length).toBeGreaterThan(0);
  for (const property of FORBIDDEN) expect(seen).not.toContain(property);
});

test('second reload in a session uses the short exit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('fx-booted'))).not.toBeNull();
  await page.reload({ waitUntil: 'load' });
  const start = Date.now();
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 800 });
  expect(Date.now() - start).toBeLessThan(800);
});

test('loader never returns on client-side navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  await expect(page.locator('#loading-screen')).toBeHidden();
  expect(errors).toEqual([]);
});

test('navigating during boot leaves no stuck state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#sidebar-nav a[href="/contact"]').dispatchEvent('click');
  await expect(page).toHaveURL(/contact/);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('#loading-screen')).toBeHidden();
  expect(errors).toEqual([]);
});
