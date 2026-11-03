import { test, expect, type Page } from './fixtures';

const fixture = '/review-fixtures/animations';

test('standalone Unicode text and loading completion settle correctly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#unicode .decoder-text')).toHaveCSS('opacity', '1');
  await expect(page.locator('#unicode .decoder-text')).toHaveText('A 🧪 third word');
  await expect(page.locator('#loading .decoder-text')).toHaveCSS('opacity', '1');
  await expect(page.locator('#loading .decoder-text')).toHaveText('Loading complete');
  expect(errors).toEqual([]);
});

for (const trigger of ['hover', 'click'] as const) {
  test(`${trigger} triggers replay after completion`, async ({ page }) => {
    await page.goto(fixture);
    await expect(page.locator('#loading-screen')).toBeHidden();
    const text = page.locator(`#${trigger} .decoder-text`);
    const target = text;
    const finalText = trigger === 'hover' ? 'Hover replay' : 'Click replay';
    await expect(text).toHaveText(finalText);
    await expect(text).toHaveCSS('opacity', '1');
    for (let replay = 0; replay < 2; replay++) {
      if (trigger === 'hover') {
        await page.mouse.move(0, 0);
        await target.hover();
      } else await target.click();
      await expect(text).not.toHaveText(finalText);
      await expect(text).toHaveText(finalText);
    }
  });
}

test('in-view waits for visibility and applies initial delay once', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const text = page.locator('#in-view .decoder-text');
  await expect(text).toHaveCSS('opacity', '0');
  await text.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect(text).toHaveCSS('opacity', '0');
  await expect(text).toHaveCSS('opacity', '1', { timeout: 1500 });
  await expect(text).toHaveText('Visible later', { timeout: 700 });
  expect(errors).toEqual([]);
});

test('mobileDisable keeps final text on mobile clicks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const text = page.locator('#mobile .decoder-text');
  await expect(text).toHaveCSS('opacity', '1');
  await text.click();
  await expect(text).toHaveText('Mobile readable');
  await page.waitForTimeout(100);
  await expect(text).toHaveText('Mobile readable');
});

for (const mode of ['reduced-motion', 'no-javascript'] as const) {
  test(`${mode} leaves headings and trigger text readable`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: mode !== 'no-javascript', reducedMotion: 'reduce' });
    await context.route('https://**/*', (route) => route.fulfill({ status: 204, body: '' }));
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4399${fixture}`);
    for (const id of ['unicode', 'loading', 'hover', 'click', 'mobile', 'in-view']) {
      await expect(page.locator(`#${id} .decoder-text`)).toHaveCSS('opacity', '1');
    }
    await expect(page.locator('#unicode')).toHaveText('A 🧪 third word');
    await expect(page.locator('#unicode')).toBeVisible();
    if (mode === 'no-javascript') await expect(page.locator('#loading-screen')).toBeHidden();
    await context.close();
  });
}

test('rapid navigation cancels decoding without errors and reinitializes on return', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.locator('#click .decoder-text').click();
  await page.locator('a[href="/"]').click();
  // Give browser-driven view transitions a separate navigation budget.
  await expect(page).toHaveURL('/', { timeout: 15_000 });
  await page.goBack();
  await expect(page).toHaveURL(fixture, { timeout: 15_000 });
  await page.locator('#click .decoder-text').click();
  await expect(page.locator('#click .decoder-text')).not.toHaveText('Click replay');
  await expect(page.locator('#click .decoder-text')).toHaveText('Click replay');
  expect(errors).toEqual([]);
});

const lonelySurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test('emoji text never shows a broken character while decoding', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const emoji = page.locator('#emoji .decoder-text');
  await expect(emoji).toHaveText('Beep 🧪 boop 👩‍🔬');
  await emoji.click();
  const samples = await page.evaluate(async () => {
    const el = document.querySelector('#emoji .decoder-text')!;
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      seen.push(el.textContent || '');
      await new Promise((r) => setTimeout(r, 16));
    }
    return seen;
  });
  expect(samples.some((text) => text !== 'Beep 🧪 boop 👩‍🔬')).toBe(true);
  expect(samples.filter((text) => lonelySurrogate.test(text) || !text.includes('🧪') || !text.includes('👩‍🔬'))).toEqual(
    []
  );
  await expect(emoji).toHaveText('Beep 🧪 boop 👩‍🔬');
});

test('decode causes no layout shift', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __shift: number }).__shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { hadRecentInput: boolean; value: number }[])
        if (!entry.hadRecentInput) (window as unknown as { __shift: number }).__shift += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __shift: number }).__shift)).toBeLessThan(0.01);

  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const result = await page.evaluate(async () => {
    const el = document.querySelector<HTMLElement>('#auto-far')!;
    const original = el.textContent;
    const box = () => {
      const r = el.getBoundingClientRect();
      return `${r.left}|${r.top + scrollY}|${r.width}|${r.height}`;
    };
    el.scrollIntoView();
    const boxes = new Set<string>();
    let scrambled = 0;
    for (let i = 0; i < 70; i++) {
      boxes.add(box());
      if (el.textContent !== original) scrambled++;
      await new Promise((r) => setTimeout(r, 16));
    }
    return { boxes: [...boxes], scrambled };
  });
  expect(result.scrambled).toBeGreaterThan(0);
  expect(result.boxes).toHaveLength(1);
});

test('headings stay accessible during decode', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const original =
    'A very long heading that has to wrap across several lines on a narrow phone screen while it decodes';
  const long = page.locator('#auto-long');
  await long.evaluate((el) => el.scrollIntoView());
  await expect(long).not.toHaveText(original);
  // The role query must resolve while the visible text is scrambled: it is checked before and after.
  let whileScrambled = 0;
  for (let i = 0; i < 3; i++) {
    const before = await long.evaluate((el, text) => el.textContent?.replace(/\s+/g, ' ').trim() !== text, original);
    const matches = await page.getByRole('heading', { name: original }).count();
    const after = await long.evaluate((el, text) => el.textContent?.replace(/\s+/g, ' ').trim() !== text, original);
    expect(matches).toBe(1);
    if (before && after) whileScrambled++;
  }
  expect(whileScrambled).toBeGreaterThan(0);
});

test('heading keeps its label and hidden view while scrambled, then drops both', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const result = await page.evaluate(async () => {
    const el = document.querySelector<HTMLElement>('#auto-far')!;
    const text = el.textContent;
    el.scrollIntoView();
    let scrambled = 0;
    let unlabelled = 0;
    for (let i = 0; i < 70; i++) {
      if (el.textContent !== text) {
        scrambled++;
        if (el.getAttribute('aria-label') !== text || !el.querySelector('[aria-hidden="true"]')) unlabelled++;
      }
      await new Promise((r) => setTimeout(r, 16));
    }
    return { scrambled, unlabelled };
  });
  expect(result.scrambled).toBeGreaterThan(0);
  expect(result.unlabelled).toBe(0);
  const heading = page.getByRole('heading', { name: 'Auto heading far' });
  await expect(heading).toBeVisible();
  await expect(heading).not.toHaveAttribute('aria-label', /.*/);
  await expect(heading.locator('[aria-hidden]')).toHaveCount(0);
});

test('auto heading decodes then ends on its exact text', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const heading = page.locator('#auto-far');
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).not.toHaveText('Auto heading far');
  await expect(heading).toHaveText('Auto heading far');
});

test('html source contains real heading text', async ({ page }) => {
  const html = await (await page.request.get(fixture)).text();
  expect(html).toContain('>Auto heading far<');
  expect(html).toContain('Visible later');
});

test('headings with links are skipped', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const changed = await page.evaluate(async () => {
    const el = document.querySelector<HTMLElement>('#linked-heading')!;
    const original = el.textContent;
    let changed = 0;
    for (let i = 0; i < 40; i++) {
      if (el.textContent !== original || el.hasAttribute('aria-label')) changed++;
      await new Promise((r) => setTimeout(r, 25));
    }
    return changed;
  });
  expect(changed).toBe(0);
});

test('each heading decodes once per page view', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const heading = page.locator('#auto-far');
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).not.toHaveText('Auto heading far');
  await expect(heading).toHaveText('Auto heading far');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(200);
  await heading.scrollIntoViewIfNeeded();
  const texts = await page.evaluate(async () => {
    const el = document.querySelector('#auto-far')!;
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
      seen.push(el.textContent || '');
      await new Promise((r) => setTimeout(r, 25));
    }
    return seen;
  });
  expect(new Set(texts)).toEqual(new Set(['Auto heading far']));
});

test('navigation mid-decode restores on return', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const heading = page.locator('#auto-far');
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).not.toHaveText('Auto heading far');
  await page.locator('a[href="/"]').click();
  await expect(page).toHaveURL('/', { timeout: 15_000 });
  await page.goBack();
  await expect(page).toHaveURL(fixture, { timeout: 15_000 });
  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#unicode .decoder-text')).toHaveText('A 🧪 third word');
  await page.waitForTimeout(1200);
  await expect(page.locator('#auto-top')).toHaveText('Auto heading top');
  await expect(page.locator('#auto-far')).toHaveText('Auto heading far');
  await expect(page.locator('[aria-label][aria-hidden], #auto-far [aria-hidden]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Headless browsers never really hide a page, so hiding is simulated the way Anime.js observes it.
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

for (const when of ['before', 'during'] as const) {
  test(`a heading ${when === 'before' ? 'reached in an already hidden tab' : 'hidden mid-decode'} ends on real text`, async ({
    page,
  }) => {
    await page.goto(fixture);
    await expect(page.locator('#loading-screen')).toBeHidden();
    const heading = page.locator('#auto-far');
    if (when === 'before') await setHidden(page, true);
    await page.evaluate(() => document.querySelector('#auto-far')!.scrollIntoView());
    if (when === 'during') {
      await expect(heading).not.toHaveText('Auto heading far');
      await setHidden(page, true);
    }
    // Hidden: no animation frames are relied on, the text must already be real or settle on its own.
    await expect(heading).toHaveText('Auto heading far', { timeout: 1500 });
    await expect(heading.locator('[aria-hidden]')).toHaveCount(0);
    await expect(heading).not.toHaveAttribute('aria-label', /.*/);
    await setHidden(page, false);
    await page.waitForTimeout(300);
    await expect(heading).toHaveText('Auto heading far');
  });
}

test.describe('narrow proportional layout', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  for (const [heading, sibling] of [
    ['#auto-long', '#after-long'],
    ['#auto-flex', '#flex-sibling'],
  ] as const) {
    test(`${heading} and its sibling do not move during decode`, async ({ page }) => {
      await page.goto(fixture);
      await expect(page.locator('#loading-screen')).toBeHidden();
      const result = await page.evaluate(
        async ([h, s]) => {
          const el = document.querySelector<HTMLElement>(h)!;
          const next = document.querySelector<HTMLElement>(s)!;
          const original = el.textContent;
          const rect = (node: HTMLElement) => {
            const r = node.getBoundingClientRect();
            return `${r.left}|${r.top + scrollY}|${r.width}|${r.height}`;
          };
          el.scrollIntoView();
          const own = new Set<string>();
          const other = new Set<string>();
          let scrambled = 0;
          for (let i = 0; i < 80; i++) {
            own.add(rect(el));
            other.add(rect(next));
            if (el.textContent !== original) scrambled++;
            await new Promise((r) => setTimeout(r, 16));
          }
          return { own: [...own], other: [...other], scrambled };
        },
        [heading, sibling]
      );
      expect(result.scrambled).toBeGreaterThan(0);
      expect(result.own).toHaveLength(1);
      expect(result.other).toHaveLength(1);
    });
  }
});

test('a decoder-text heading in main is decoded once and ends on its real text', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#loading-screen')).toBeHidden();
  const result = await page.evaluate(async () => {
    const el = document.querySelector<HTMLElement>('h2.decoder-h2')!;
    const real = 'Decoder text as heading';
    el.scrollIntoView();
    let scrambled = 0;
    let wrongLabel = 0;
    for (let i = 0; i < 180; i++) {
      const label = el.getAttribute('aria-label');
      if (el.textContent !== real) scrambled++;
      if (label !== null && label !== real) wrongLabel++;
      await new Promise((r) => setTimeout(r, 16));
    }
    return { scrambled, wrongLabel, text: el.textContent, label: el.getAttribute('aria-label') };
  });
  expect(result.scrambled).toBeGreaterThan(0);
  expect(result.wrongLabel).toBe(0);
  expect(result).toMatchObject({ text: 'Decoder text as heading', label: null });
});
