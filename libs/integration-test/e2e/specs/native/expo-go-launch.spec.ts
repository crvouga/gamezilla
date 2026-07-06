import { expect, test } from '@playwright/test';

/**
 * Expo Go launch smoke. Loads the `__DEV__ === true` web bundle (served by
 * `playwright.native.config.ts`) and asserts the app actually mounts instead
 * of white-screening.
 *
 * Two independent signals:
 *  1. `app-root` (the outermost `GestureHandlerRootView`) becomes visible — a
 *     render throw in a child provider (e.g. `ConfigServiceProvider` calling
 *     `getApiBaseUrl()`) unwinds the tree, so the root never commits.
 *  2. No uncaught `pageerror` fires during startup — the Tiger-policy
 *     `assert` throw that blanks Expo Go surfaces here as a page error.
 */
test('expo-go dev bundle launches past splash without a startup crash', async ({
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
