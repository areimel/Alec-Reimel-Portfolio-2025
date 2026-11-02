import { test as base } from '@playwright/test';

export { expect, type Locator, type Page } from '@playwright/test';

// Exercise local behavior without sending analytics or depending on third-party services.
// Page-level contact mocks take precedence over this context-level isolation.
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await context.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin === new URL(baseURL!).origin) await route.continue();
      else await route.fulfill({ status: 204, body: '' });
    });
    await use(context);
  },
});
