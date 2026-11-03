import { test, expect, type Page } from './fixtures';

// A returning session skips the long boot, so the governor starts about 2s after load.
const skipBoot = (page: Page) =>
  page.addInitScript(() => {
    try {
      sessionStorage.setItem('fx-booted', '1');
    } catch {
      /* blocked */
    }
  });

const tierOf = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.fxTier ?? null).then((tier) => Number(tier ?? 0));

/** Runs a rAF loop whose every frame busy-waits `frameMs`. Stop it with `window.__burn = false`. */
const burn = (page: Page, frameMs: number, totalMs: number) =>
  page.evaluate(
    ({ frameMs, totalMs }) =>
      new Promise<void>((resolve) => {
        const end = performance.now() + totalMs;
        const frame = () => {
          const start = performance.now();
          while (performance.now() - start < frameMs);
          if (performance.now() < end) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      }),
    { frameMs, totalMs }
  );

test.beforeEach(async ({ page }) => {
  await skipBoot(page);
});

test('sustained long frames step the tier down', async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto('/');
  await burn(page, 80, 12_000);
  expect(await tierOf(page)).toBeGreaterThanOrEqual(1);
});

test('steady 30fps does not step down', async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto('/');
  // Pace by frame period: each callback busy-waits until 30ms after the previous callback started.
  const gaps = await page.evaluate(
    (totalMs) =>
      new Promise<number[]>((resolve) => {
        const recorded: number[] = [];
        const end = performance.now() + totalMs;
        let previous = performance.now();
        const frame = () => {
          while (performance.now() - previous < 30);
          const now = performance.now();
          recorded.push(now - previous);
          previous = now;
          if (now < end) requestAnimationFrame(frame);
          else resolve(recorded);
        };
        requestAnimationFrame(frame);
      }),
    10_000
  );
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  expect(median).toBeGreaterThanOrEqual(28);
  expect(median).toBeLessThanOrEqual(45);
  expect(await tierOf(page)).toBe(0);
});

test('a short stall in a young window does not step down', async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto('/');
  await page.waitForTimeout(3_500); // measuring has started
  await page.evaluate(async () => {
    // Clear the window the way a tab switch does, then stall right after it starts refilling.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete (document as unknown as Record<string, unknown>).visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
    const start = performance.now();
    while (performance.now() - start < 400);
    await frame();
    await frame();
  });
  await page.waitForTimeout(1_000);
  expect(await tierOf(page)).toBe(0);
});

test('sustained 200ms frames for 4s step the tier down', async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto('/');
  await page.waitForTimeout(2_500); // measuring has started
  await burn(page, 200, 4_500);
  expect(await tierOf(page)).toBeGreaterThanOrEqual(1);
});

test('hidden tab time does not count', async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto('/');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await burn(page, 80, 10_000);
  await page.evaluate(() => {
    delete (document as unknown as Record<string, unknown>).visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // A few healthy frames after returning must not count the stalled one either.
  await page.waitForTimeout(500);
  expect(await tierOf(page)).toBe(0);
});

test('a tier set mid-session survives client-side navigation', async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto('/');
  await burn(page, 80, 12_000);
  const before = await tierOf(page);
  expect(before).toBeGreaterThanOrEqual(1);
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  expect(await tierOf(page)).toBeGreaterThanOrEqual(before);
});

test('a tier set mid-session survives navigation with blocked sessionStorage reads', async ({ page }) => {
  test.setTimeout(40_000);
  await page.goto('/');
  await burn(page, 80, 12_000);
  const before = await tierOf(page);
  expect(before).toBeGreaterThanOrEqual(1);
  // Reads fail from here on, as with blocked storage: only the governor's own memory can restore it.
  await page.evaluate(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  expect(await tierOf(page)).toBeGreaterThanOrEqual(before);
});

test('tier lock survives navigation and reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fx-tier-lock', '2'));
  await page.reload();
  await expect.poll(() => tierOf(page)).toBe(2);
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  expect(await tierOf(page)).toBe(2);
  await page.reload();
  expect(await tierOf(page)).toBe(2);
});

test('tier 3 lightens glow', async ({ page }) => {
  // Pin a theme that has a glow (severance has none, and the default is not guaranteed).
  await page.addInitScript(() => localStorage.setItem('theme', 'green'));
  await page.goto('/');
  // `body` itself carries no shadow (its nested rule is dropped from the built CSS), so read a hovered nav link.
  const link = page.locator('#sidebar-nav a.nav-link').first();
  const glow = async () => {
    await link.hover();
    return link.evaluate((el) => getComputedStyle(el).textShadow);
  };
  const base = await glow();
  expect(base).not.toBe('none');
  await page.evaluate(() => localStorage.setItem('fx-tier-lock', '3'));
  await page.reload();
  await expect.poll(glow).not.toBe(base);
});

test('governor never enables a disabled effect', async ({ page }) => {
  await page.goto('/');
  const noise = page.locator('.terminal-overlay .noise');
  const transform = () => noise.evaluate((el) => (el as HTMLElement).style.transform);
  // Control: with noise on, the jitter does move it.
  const first = await transform();
  await expect.poll(transform).not.toBe(first);
  await page.locator('#theme-settings-btn').click();
  await page.locator('label[for="noise-effect"]').first().click();
  await expect(noise).toHaveClass(/hidden/);
  await page.evaluate(() => localStorage.setItem('fx-tier-lock', '0'));
  await page.reload();
  await page.evaluate(() => localStorage.setItem('fx-tier-lock', '3'));
  await page.reload();
  await expect.poll(() => tierOf(page)).toBe(3);
  await expect(noise).toHaveClass(/hidden/);
  const before = await transform();
  await page.waitForTimeout(500);
  expect(await transform()).toBe(before);
});

test('blocked storage does not break it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked');
      },
    });
  });
  await page.goto('/');
  await burn(page, 80, 8_000);
  expect(errors).toEqual([]);
});
