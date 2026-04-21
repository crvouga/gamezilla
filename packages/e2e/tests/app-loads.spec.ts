import { expect, test } from '@playwright/test';

test('web app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 60_000 });
});
