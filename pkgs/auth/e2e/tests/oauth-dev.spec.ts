import { expect, test } from '@playwright/test';

const POPUP_BLOCKED =
  'Popup window was blocked by the browser or failed to open. This can happen in mobile browsers when the window.open() method was invoked too long after a user input was fired.';

test('dev oauth popup chooser completes sign-in', async ({ page }) => {
  await page.goto('/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('harness-sign-in-dev').click();
  const popup = await popupPromise;
  await popup.waitForSelector('[data-testid="dev-idp-page"]');
  await popup.getByTestId('dev-idp-subject-input').fill('alice');
  await popup.getByTestId('dev-idp-continue').click();
  await expect(page.getByTestId('harness-token')).not.toHaveText('', {
    timeout: 15_000,
  });
  const token = await page.getByTestId('harness-token').textContent();
  expect(token?.length).toBeGreaterThan(0);
});

test('closing popup shows cancelled error', async ({ page }) => {
  await page.goto('/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('harness-sign-in-dev').click();
  const popup = await popupPromise;
  await popup.waitForSelector('[data-testid="dev-idp-page"]');
  await popup.close();
  await expect(page.getByTestId('harness-error')).toContainText(
    "Sign-in was cancelled or didn't finish."
  );
});

test('blocked popup shows exact browser message', async ({ page }) => {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto('/');
  await page.getByTestId('harness-sign-in-dev').click();
  await expect(page.getByTestId('harness-error')).toHaveText(POPUP_BLOCKED);
});

test('google launch redirects to Google authorize URL', async ({ page }) => {
  await page.goto('/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('harness-sign-in-google').click();
  const popup = await popupPromise;
  await popup.waitForURL(/accounts\.google\.com/);
  expect(popup.url()).toContain('client_id=cid');
});
