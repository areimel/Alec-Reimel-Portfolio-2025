import { test, expect } from './fixtures';
import { serializeStructuredData } from '../src/utils/serializeStructuredData';

const canonicalOrigin = 'https://www.alecreimel.com';
const publicRoutes = [
  '/',
  '/about',
  '/projects',
  '/blog',
  '/contact',
  '/resume',
  '/projects/arda-site-scanner',
  '/web-development-with-cursor',
];

for (const route of publicRoutes) {
  test(`SEO metadata and identity: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('head title')).toHaveCount(1);
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', '');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}${route}`);
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${canonicalOrigin}${route}`);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /^https:\/\//);
    const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(structuredData.length).toBeGreaterThan(0);
    const nodes = structuredData.flatMap((text) => {
      const parsed = JSON.parse(text);
      return parsed['@graph'] ?? [parsed];
    });
    expect(nodes.some((node) => node['@type'] === 'Person' && node.name === 'Alec Reimel')).toBe(true);
  });
}

test('robots and sitemap advertise only canonical public content', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${canonicalOrigin}/sitemap-index.xml`);
  expect(await robots.text()).toMatch(/User-agent:\s*\*/);
  expect(await robots.text()).not.toMatch(/^Disallow:\s*\/\s*$/m);

  const index = await request.get('/sitemap-index.xml');
  expect(index.status()).toBe(200);
  const sitemapPaths = [...(await index.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => {
    expect(new URL(match[1]).origin).toBe(canonicalOrigin);
    return new URL(match[1]).pathname;
  });
  expect(sitemapPaths.length).toBeGreaterThan(0);
  const urls: string[] = [];
  for (const path of sitemapPaths) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    urls.push(...[...(await response.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]));
  }
  expect(urls).toEqual(expect.arrayContaining(publicRoutes.map((path) => `${canonicalOrigin}${path}`)));
  for (const url of urls) {
    expect(new URL(url).origin).toBe(canonicalOrigin);
    expect(new URL(url).pathname).not.toMatch(
      /^\/(?:styleguide|services|pricing|terms|404|review-fixtures|decapcms)(?:\/|$)/
    );
    const response = await request.get(new URL(url).pathname);
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toMatch(/name="robots"[^>]*content="[^"]*noindex/);
  }
});

test('internal pages and retired templates stay out of search', async ({ page, request }) => {
  await page.goto('/styleguide');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  for (const route of ['/services', '/pricing', '/terms', '/missing-seo-review-route']) {
    expect((await request.get(route)).status()).toBe(404);
  }
  await page.goto('/missing-seo-review-route');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('llms.txt links to maintained canonical hiring resources', async ({ request }) => {
  const response = await request.get('/llms.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/text\/plain/);
  const body = await response.text();
  expect(body).toContain('Alec Reimel');
  for (const route of ['/about', '/projects', '/contact', '/resume']) {
    expect(body).toContain(`${canonicalOrigin}${route}`);
  }
  expect(body).not.toContain('https://alecreimel.com/');
});

test('Astro navigation updates metadata and page structured data', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.evaluate(() => ((window as Window & { seoNavigationMarker?: string }).seoNavigationMarker = 'retained'));
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL('/contact');
  expect(await page.evaluate(() => (window as Window & { seoNavigationMarker?: string }).seoNavigationMarker)).toBe(
    'retained'
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}/contact`);
  await expect(page).toHaveTitle(/Contact/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${canonicalOrigin}/contact`);
  const data = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((text) =>
    JSON.parse(text)
  );
  expect(JSON.stringify(data)).toContain(`${canonicalOrigin}/contact`);
});

test('default share image preserves its declared dimensions and alternative text', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image:width"]').first()).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]').first()).toHaveAttribute('content', '628');
  await expect(page.locator('meta[property="og:image:alt"]').first()).not.toHaveAttribute('content', '');
});

test('structured data serialization cannot escape its script element and preserves content', () => {
  const data = { name: '</script><script>alert("test")</script>&', description: 'line\u2028paragraph\u2029' };
  const encoded = serializeStructuredData(data);
  expect(encoded).not.toMatch(/[<>&\u2028\u2029]/);
  expect(JSON.parse(encoded)).toEqual(data);
});

test('main pages have distinct employer-focused descriptions and no template claims', async ({ page }) => {
  const descriptions: string[] = [];
  const titles: string[] = [];
  for (const route of ['/', '/about', '/resume', '/projects', '/blog', '/contact', '/privacy']) {
    await page.goto(route);
    descriptions.push((await page.locator('meta[name="description"]').getAttribute('content'))!);
    titles.push(await page.title());
    await expect(page.locator('main')).not.toContainText(/AstroWind LLC|Beautiful Website Templates|248 employees/);
  }
  expect(new Set(descriptions).size).toBe(descriptions.length);
  expect(new Set(titles).size).toBe(titles.length);
});

test('hiring content and contact links work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await context.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === new URL(baseURL!).origin) await route.continue();
    else await route.fulfill({ status: 204, body: '' });
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL!);
    await expect(page.locator('h1')).toHaveText('Alec Reimel — Software Developer');
    await expect(page.locator('#loading-screen')).toBeHidden();
    await page.getByRole('link', { name: 'Contact me about a role', exact: true }).first().click();
    await expect(page).toHaveURL(`${baseURL}/contact`);
    await expect(page.locator('a[href="mailto:alecreimel@gmail.com"]')).toBeVisible();
    await page.goto(`${baseURL}/projects/arda-analytics`);
    await expect(page.locator('h1')).toContainText('ARDA Analytics');
    await expect(page.getByRole('link', { name: 'View on GitHub' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('project evidence has responsive images and matching breadcrumb/schema relationships', async ({ page }) => {
  await page.goto('/projects/arda-analytics');
  const image = page.locator('main img').first();
  await expect(image).toHaveAttribute('srcset', /480w/);
  await expect(image).toHaveAttribute('width', /^\d+$/);
  await expect(image).toHaveAttribute('height', /^\d+$/);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('ARDA Analytics');
  const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((text) => {
    const parsed = JSON.parse(text);
    return parsed['@graph'] ?? [parsed];
  });
  const source = nodes.find((node) => node['@type'] === 'SoftwareSourceCode');
  expect(source.codeRepository).toBe('https://github.com/areimel/ARDA-Analytics');
  expect(source.author['@id']).toBe(`${canonicalOrigin}/#person`);
  expect(nodes.find((node) => node['@type'] === 'BreadcrumbList').itemListElement).toHaveLength(3);
});

test('hiring and case-study pages fit phones and tablets without clipping navigation labels', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      '/',
      '/about',
      '/resume',
      '/contact',
      '/projects/arda-analytics',
      '/projects/arda-site-scanner',
    ]) {
      await page.goto(route);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
        .toBeLessThanOrEqual(0);
      const labelsFit = await page.locator('#sidebar-nav a span').evaluateAll((labels) =>
        labels.every((label) => {
          const nav = label.closest('nav')!.getBoundingClientRect();
          const bounds = label.getBoundingClientRect();
          return bounds.left >= nav.left && bounds.right <= nav.right;
        })
      );
      expect(labelsFit, `navigation labels at ${width}px`).toBe(true);
    }
  }
});

test('résumé download and professional profiles connect visible content, schema, and llms.txt', async ({
  page,
  request,
}) => {
  await page.goto('/resume');
  await expect(page.getByRole('heading', { name: 'Professional experience' })).toBeVisible();
  await expect(page.locator('main')).toContainText('December 2025 – October 2026');
  await expect(page.locator('main')).toContainText('Syracuse University');
  const download = page.getByRole('link', { name: 'Download résumé (PDF)', exact: true });
  await expect(download).toHaveAttribute('download', '');
  await expect(download).toHaveAttribute('href', '/resume/alec-reimel-resume-2026.pdf');
  const pdf = await request.get((await download.getAttribute('href'))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toMatch(/application\/pdf/);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.locator('main a[href="https://www.linkedin.com/in/alecwreimel/"]')).toBeVisible();
  const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((text) => {
    const parsed = JSON.parse(text);
    return parsed['@graph'] ?? [parsed];
  });
  const person = nodes.find((node) => node['@type'] === 'Person');
  expect(person.sameAs).toEqual(
    expect.arrayContaining(['https://www.linkedin.com/in/alecwreimel/', 'https://github.com/areimel'])
  );
  expect(person.alumniOf.name).toBe('Syracuse University');
  expect(person.subjectOf.url).toBe(`${canonicalOrigin}/resume/alec-reimel-resume-2026.pdf`);
  expect(person.worksFor).toBeUndefined();
  const llms = await (await request.get('/llms.txt')).text();
  expect(llms).toContain(person.subjectOf.url);
  expect(llms).toContain('https://www.linkedin.com/in/alecwreimel/');
});
