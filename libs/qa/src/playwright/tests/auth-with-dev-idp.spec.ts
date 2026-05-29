import { expect, test } from '@playwright/test';

import { signInWithDevIdp } from '../helpers/sign-in-with-dev-idp';

test('user signs in with the local dev IdP', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 60_000 });

  await signInWithDevIdp(page, {
    name: 'Playwright Tester',
    email: 'playwright@example.com',
  });

  // After the callback completes the app shows the signed-in account label
  // wherever the "Sign in" button used to be. Just assert the modal trigger
  // is gone from the chrome — the heaviest signal that auth succeeded.
  await expect(page.getByRole('button', { name: /^sign in$/i })).toHaveCount(
    0,
    { timeout: 30_000 }
  );
});
