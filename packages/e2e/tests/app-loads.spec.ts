import { expect, test } from '@playwright/test';

test('web app loads spaces screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Spaces' }),
  ).toBeVisible({ timeout: 60_000 });
});
