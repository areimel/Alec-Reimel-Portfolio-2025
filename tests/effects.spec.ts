import { test, expect } from './fixtures';

test('effects remain usable with blocked storage and survive navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.goto('/');
  await page.locator('#theme-settings-btn').click();
  await page.locator('label[for="noise-effect"]').first().click();
  await expect(page.locator('#noise-effect')).not.toBeChecked();
  await expect(page.locator('.terminal-overlay .noise')).toHaveClass(/hidden/);
  await page.keyboard.press('Escape');
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  await expect(page.locator('.terminal-overlay .noise')).toHaveClass(/hidden/);
  await page.locator('#theme-settings-btn').click();
  await expect(page.locator('#noise-effect')).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('effect preferences persist on reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#theme-settings-btn').click();
  await page.locator('label[for="scanline-effect"]').first().click();
  await expect(page.locator('#scanline-effect')).not.toBeChecked();
  await page.reload();
  await expect(page.locator('.terminal-overlay .scanline')).toHaveClass(/hidden/);
  await page.locator('#theme-settings-btn').click();
  await expect(page.locator('#scanline-effect')).not.toBeChecked();
});

test('reduced motion disables moving effects by default and supports explicit choices', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.terminal-overlay .noise')).toHaveClass(/hidden/);
  await expect(page.locator('.terminal-overlay .scanline')).toHaveClass(/hidden/);
  await page.locator('#theme-settings-btn').click();
  await expect(page.locator('#noise-effect')).not.toBeChecked();
  await expect(page.locator('#scanline-effect')).not.toBeChecked();
  await expect(page.locator('#overlay-effect')).toBeChecked();
  await page.locator('label[for="scanline-effect"]').first().click();
  await expect(page.locator('.terminal-overlay .scanline')).not.toHaveClass(/hidden/);
  await expect
    .poll(() => page.locator('.terminal-overlay .scanline').evaluate((el) => el.getAnimations().length))
    .toBeGreaterThan(0);
});
