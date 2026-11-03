import { test, expect } from './fixtures';

test('blocked animation chunk still dismisses the loader and shows content', async ({ page }) => {
  await page.route('**/_astro/*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 8000 });
  // The failsafe fires 6s after load, which can land after the loader's own fallback.
  await expect(page.locator('html')).not.toHaveClass(/motion-ok/, { timeout: 8000 });
  await expect(page.locator('main')).toBeVisible();
});

test('motion flag survives client-side navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/motion-ok/);
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  await expect(page.locator('html')).toHaveClass(/motion-ok/);
});

test('reduced motion does not set the motion flag', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/motion-ok/);
});

test('a throwing page feature does not stop later features or raise page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/review-fixtures/animations');
  await expect(page.locator('html')).toHaveAttribute('data-fixture-on-page', 'ran');
  expect(pageErrors).toEqual([]);
});
