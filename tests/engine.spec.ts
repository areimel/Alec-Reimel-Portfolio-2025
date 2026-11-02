import { test, expect } from './fixtures';

test('blocked animation chunk still dismisses the loader and shows content', async ({ page }) => {
  await page.route('**/_astro/*.js', (route) => route.abort());
  // Until the entry point imports feature chunks, Astro inlines it and the abort above has no effect,
  // so also make the readiness flag unsettable to simulate an entry that never finishes.
  await page.addInitScript(() => {
    Object.defineProperty(window, '__fxReady', { get: () => undefined, set: () => {} });
  });
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
