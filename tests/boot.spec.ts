import { test, expect, type Page } from './fixtures';

const FORBIDDEN = ['boxShadow', 'textShadow', 'width', 'backgroundPosition'];

type Seen = { props: Set<string>; containerProps: Set<string>; ends: number };
const trackAnimations = () => {
  const seen: Seen = { props: new Set(), containerProps: new Set(), ends: 0 };
  (window as unknown as { __seen: Seen }).__seen = seen;
  document.addEventListener('loading-screen-end', () => seen.ends++);
  const sample = () => {
    for (const animation of document.getAnimations()) {
      const effect = animation.effect as KeyframeEffect | null;
      const onContainer = (effect?.target as Element | null)?.classList.contains('loading-container');
      for (const frame of effect?.getKeyframes() ?? []) {
        for (const key of Object.keys(frame)) {
          seen.props.add(key);
          if (onContainer) seen.containerProps.add(key);
        }
      }
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
};
const readSeen = (page: Page) =>
  page.evaluate(() => {
    const seen = (window as unknown as { __seen: Seen }).__seen;
    return { props: [...seen.props], containerProps: [...seen.containerProps], ends: seen.ends };
  });

test('boot animates no shadow or width properties', async ({ page }) => {
  await page.addInitScript(trackAnimations);
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  const { props } = await readSeen(page);
  expect(props).toContain('transform');
  for (const property of FORBIDDEN) expect(props).not.toContain(property);
});

test('first load fires exactly one loading-screen-end', async ({ page }) => {
  await page.addInitScript(trackAnimations);
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.waitForTimeout(1500);
  expect((await readSeen(page)).ends).toBe(1);
});

test('second reload in a session uses the short exit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('fx-booted'))).not.toBeNull();
  await page.addInitScript(trackAnimations);
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 1500 });
  const { containerProps, ends } = await readSeen(page);
  expect(containerProps).not.toContain('transform');
  expect(containerProps).not.toContain('opacity');
  expect(ends).toBe(1);
});

test('reduced motion hides the loader immediately without flicker or beam', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(trackAnimations);
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 1000 });
  const { containerProps, ends } = await readSeen(page);
  expect(containerProps).toEqual([]);
  expect(ends).toBe(1);
});

test('a load in a hidden tab still completes', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'hidden', { get: () => true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
  });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 1500 });
});

test('blocked chunks still release text waiting on the loader', async ({ page }) => {
  await page.route('**/_astro/*.js', (route) => route.abort());
  await page.goto('/review-fixtures/animations');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 8000 });
  await expect(page.locator('#loading .decoder-text')).toHaveCSS('opacity', '1');
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

const BANNED = ['boxShadow', 'textShadow', 'filter', 'width', 'backgroundPosition'];

test('no route runs banned animation properties', async ({ page }) => {
  await page.addInitScript((banned) => {
    const hits = new Set<string>();
    (window as unknown as { __banned: Set<string> }).__banned = hits;
    const sample = () => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        // View-transition pseudo-element animations are out of scope.
        if (effect?.pseudoElement?.startsWith('::view-transition')) continue;
        for (const frame of effect?.getKeyframes() ?? []) {
          for (const key of Object.keys(frame)) if (banned.includes(key)) hits.add(key);
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, BANNED);
  const banned = () => page.evaluate(() => [...(window as unknown as { __banned: Set<string> }).__banned]);

  for (const route of ['/', '/contact', '/projects/arda-site-scanner']) {
    await page.goto(route);
    await expect(page.locator('#loading-screen')).toBeHidden();
    await page.mouse.move(0, 0);
    for (const link of await page.locator('a:visible').all()) {
      await link.hover({ timeout: 1000 }).catch(() => undefined);
    }
    await page.locator('#theme-settings-btn').click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    expect(await banned(), route).toEqual([]);
  }
});
