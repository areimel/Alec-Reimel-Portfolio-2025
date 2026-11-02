import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4399', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command:
      'REVIEW_TEST_FIXTURES=1 pnpm exec astro build --outDir .test-dist && pnpm exec astro preview --outDir .test-dist --host 127.0.0.1 --port 4399',
    timeout: 120_000,
    url: 'http://127.0.0.1:4399',
    reuseExistingServer: false,
  },
});
