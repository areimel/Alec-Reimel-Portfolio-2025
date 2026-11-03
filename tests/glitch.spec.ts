import { test, expect, type Page } from './fixtures';

async function ready(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 15000 });
  await page.bringToFront();
}

/** Records every `data-fx-glitch` start and end, with animation counts and viewport state at the start. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const log = {
      starts: 0,
      max: 0,
      inViewport: [] as boolean[],
      times: [] as number[],
      animations: [] as number[],
      durations: [] as number[],
    };
    const began = new WeakMap<Element, number>();
    new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as Element;
        if (el.hasAttribute('data-fx-glitch') && !began.has(el)) {
          began.set(el, performance.now());
          log.starts++;
          log.times.push(performance.now());
          const rect = el.getBoundingClientRect();
          log.inViewport.push(rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth);
          log.animations.push(el.getAnimations().length);
        } else if (!el.hasAttribute('data-fx-glitch') && began.has(el)) {
          log.durations.push(performance.now() - began.get(el)!);
          began.delete(el);
        }
      }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-fx-glitch'] });
    const sample = () => {
      log.max = Math.max(log.max, document.querySelectorAll('[data-fx-glitch]').length);
      requestAnimationFrame(sample);
    };
    sample();
    (window as unknown as { __glitchLog: typeof log }).__glitchLog = log;
  });
}

const readLog = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __glitchLog: {
            starts: number;
            max: number;
            inViewport: boolean[];
            animations: number[];
            durations: number[];
            times: number[];
          };
        }
      ).__glitchLog
  );

async function sweep(page: Page) {
  const links = page.locator('#sidebar-nav a');
  const count = await links.count();
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < count; i++) {
      const box = (await links.nth(i).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    }
  }
  await page.waitForTimeout(400);
}

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'Hover glitches need a fine pointer');
});

test('hover triggers a short burst', async ({ page }) => {
  await ready(page);
  await watch(page);
  const box = (await page.locator('#sidebar-nav a').nth(1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  await expect.poll(async () => (await readLog(page)).durations.length).toBeGreaterThan(0);
  const log = await readLog(page);
  expect(log.animations[0]).toBeGreaterThan(0);
  expect(log.durations[0]).toBeLessThan(300);
});

test('hovering many links never exceeds 3 running', async ({ page }) => {
  await ready(page);
  await watch(page);
  await sweep(page);
  const log = await readLog(page);
  expect(log.starts).toBeGreaterThan(0);
  expect(log.max).toBeLessThanOrEqual(3);
  // 3 starts per rolling second, site-wide
  for (const time of log.times) {
    expect(log.times.filter((other) => other >= time && other < time + 1000).length).toBeLessThanOrEqual(3);
  }
});

test('glitches leave layout and inline styles alone', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const state = { shift: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.shift += (entry as unknown as { value: number }).value;
    }).observe({ type: 'layout-shift', buffered: false });
    (window as unknown as { __shift: typeof state }).__shift = state;
  });
  await watch(page);
  // The page-change glitch hits a heading with content below it, where a layout change would move things.
  await page.evaluate(() => document.dispatchEvent(new Event('astro:before-preparation')));
  await page.waitForTimeout(400);
  await sweep(page);
  expect((await readLog(page)).starts).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __shift: { shift: number } }).__shift.shift)).toBeLessThan(
    0.01
  );
  const leftovers = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('#sidebar-nav a')).filter(
        (el) => el.hasAttribute('data-fx-glitch') || el.hasAttribute('style')
      ).length
  );
  expect(leftovers).toBe(0);
});

test('ambient fires within 30s on one visible element', async ({ page }) => {
  await page.clock.install();
  await ready(page);
  await watch(page);
  await page.clock.fastForward(30000);
  await expect.poll(async () => (await readLog(page)).starts).toBeGreaterThan(0);
  const log = await readLog(page);
  expect(log.inViewport.every(Boolean)).toBe(true);
});

test('modal-opened glitches the content and keeps its transform', async ({ page }) => {
  await ready(page, '/contact');
  await watch(page);
  await page.evaluate(() => window.openthankYouFullModal());
  await expect.poll(async () => (await readLog(page)).starts).toBeGreaterThan(0);
  await expect.poll(async () => (await readLog(page)).durations.length).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  const after = await page.locator('#thankYouFull-content').evaluate((el) => ({
    style: el.getAttribute('style'),
    attr: el.hasAttribute('data-fx-glitch'),
  }));
  expect(after.attr).toBe(false);
  // Whatever the modal itself leaves inline stays; the glitch adds nothing and never touches transform.
  expect(after.style ?? '').not.toMatch(/translate:|opacity|clip-path/);
  expect(after.style ?? '').toContain('translate(-50%, -50%)');
});

test('page change glitches the first heading and a swap clears bursts', async ({ page }) => {
  await ready(page);
  await watch(page);
  await page.evaluate(() => document.dispatchEvent(new Event('astro:before-preparation')));
  await expect.poll(async () => (await readLog(page)).starts).toBeGreaterThan(0);
  const tag = await page.evaluate(() => document.querySelector('[data-fx-glitch]')?.tagName ?? null);
  expect(tag === null || /^H[12]$/.test(tag)).toBe(true);
  await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
  expect(await page.evaluate(() => document.querySelectorAll('[data-fx-glitch]').length)).toBe(0);
});

test('no glitches under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await watch(page);
  await sweep(page);
  expect((await readLog(page)).starts).toBe(0);
});

test('no glitches at tier 2', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    document.documentElement.dataset.fxTier = '2';
    document.dispatchEvent(new Event('fx-tier-change'));
  });
  await watch(page);
  await sweep(page);
  expect((await readLog(page)).starts).toBe(0);
});
