import { test, expect } from '@playwright/test';

const themes = ['green', 'amber', 'cyber', 'cyber-yellow', 'severance'];
for (const stored of [null, '', 'dark', 'light', 'obsolete', ...themes]) {
  test(`resolves stored theme ${JSON.stringify(stored)}`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.clear();
      if (value !== null) localStorage.setItem('theme', value);
    }, stored);
    await page.goto('/');
    const expected = themes.includes(stored ?? '') ? stored : 'severance';
    await expect(page.locator('html')).toHaveClass(new RegExp(`theme-${expected}(?: |$)`));
    expect(
      await page.locator('html').evaluate((root) => [...root.classList].filter((name) => name.startsWith('theme-')))
    ).toEqual([`theme-${expected}`]);
    await page.locator('#theme-settings-btn').click();
    await expect(page.locator(`.theme-button[data-theme="${expected}"]`)).toHaveAttribute('aria-pressed', 'true');
  });
}

test('themes work after navigation and persist on reload', async ({ page }) => {
  await page.goto('/');
  for (const theme of themes) {
    await page.locator('#theme-settings-btn').click();
    await page.locator(`.theme-button[data-theme="${theme}"]`).click();
    await expect(page.locator('html')).toHaveClass(new RegExp(`theme-${theme}(?: |$)`));
    await page.keyboard.press('Escape');
    await expect(page.locator('#themeOptions-container')).toBeHidden();
    await page.locator('#sidebar-nav a[href="/contact"]').click();
    await expect(page).toHaveURL(/contact/);
    await page.locator('#sidebar-nav a[href="/"]').click();
    await expect(page).toHaveURL('/');
  }
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/theme-severance/);
});

test('storage exceptions still allow theme switching', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/theme-severance/);
  await page.locator('#theme-settings-btn').click();
  await page.locator('.theme-button[data-theme="amber"]').click();
  await expect(page.locator('html')).toHaveClass(/theme-amber/);
});

test('Severance renders without JavaScript and without theme classes', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.locator('html')).toHaveClass(/theme-severance/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 14, 20)');
  await context.close();
});

test('CSS supplies fallback when theme classes disappear', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.className = '';
  });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 14, 20)');
});
