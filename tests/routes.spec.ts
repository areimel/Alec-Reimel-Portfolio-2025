import { test, expect } from './fixtures';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith('.html') ? [path] : [];
  });
}

const routes = htmlFiles('dist').map((file) => {
  const path = relative('dist', file).split(sep).join('/');
  return path === '404.html' ? '/missing-review-2026-route' : `/${path.replace(/(?:^|\/)index\.html$/, '')}`;
});

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) await route.continue();
    else await route.fulfill({ status: 204, body: '' });
  });
});

for (const route of routes) {
  test(`production route ${route}`, async ({ page, baseURL }, testInfo) => {
    const errors: string[] = [];
    const failedRequests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => {
      if (new URL(request.url()).origin === new URL(baseURL!).origin) failedRequests.push(request.url());
    });
    page.on('response', (response) => {
      if (
        response.status() >= 400 &&
        new URL(response.url()).origin === new URL(baseURL!).origin &&
        !(response.request().isNavigationRequest() && route === '/missing-review-2026-route')
      ) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(route === '/missing-review-2026-route' ? 404 : 200);
    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
    expect(
      await page.locator('[href], [src]').evaluateAll((elements) =>
        elements.flatMap((element) =>
          ['href', 'src'].flatMap((name) => {
            const value = element.getAttribute(name);
            return value && new URL(value, location.href).pathname.startsWith('/src/') ? [value] : [];
          })
        )
      )
    ).toEqual([]);
    if (route === '/') {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => innerWidth)
      );
      await page.screenshot({ path: testInfo.outputPath('homepage.png'), fullPage: true });
    }
  });
}

test('detail pages highlight their navigation section', async ({ page }) => {
  await page.goto('/projects/arda-site-scanner');
  await expect(page.locator('#sidebar-nav a[aria-current="page"]')).toHaveAttribute('href', '/projects');
  await page.goto('/web-development-with-cursor');
  await expect(page.locator('#sidebar-nav a[aria-current="page"]')).toHaveAttribute('href', '/blog');
});

test('theme survives browser back and forward and resets after cleared storage on reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#theme-settings-btn').click();
  await page.locator('.theme-button[data-theme="amber"]').click();
  await page.keyboard.press('Escape');
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator('html')).toHaveClass(/theme-amber/);
  await page.goForward();
  await expect(page).toHaveURL(/contact/);
  await expect(page.locator('html')).toHaveClass(/theme-amber/);
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/theme-severance/);
});

test('homepage fits narrow phones and tablets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  for (const width of [320, 390, 768, 800, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(0);
  }
});
