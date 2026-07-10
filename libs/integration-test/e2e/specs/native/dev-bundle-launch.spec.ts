import { expect, test } from '@playwright/test';

/**
 * Dev bundle launch smoke. Loads a `__DEV__ === true` web bundle from Metro
 * (`playwright.native.config.ts` / `qa:metro:web-dev`) and asserts the app
 * mounts instead of white-screening.
 *
 * Two independent signals:
 *  1. `app-root` (the outermost `GestureHandlerRootView`) becomes visible — a
 *     render throw in a child provider (e.g. `ConfigServiceProvider` calling
 *     `getApiBaseUrl()`) unwinds the tree, so the root never commits.
 *  2. No uncaught `pageerror` fires during startup — Tiger-policy `assert`
 *     throws during startup surface here as a page error.
 */
test('dev bundle launches past splash without a startup crash', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  await page.goto('/');

  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 60_000 });

  expect(
    pageErrors,
    `Uncaught startup errors (blank-screen risk):\n${pageErrors.join('\n')}`
  ).toEqual([]);
});
