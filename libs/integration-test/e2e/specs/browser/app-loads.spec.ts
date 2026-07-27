import { expect, test } from '@playwright/test';
import { byComponent, byScreen } from '../../../src/by-component';

test('web app loads spaces screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Spaces' }).first()
  ).toBeVisible({ timeout: 60_000 });
  await expect(byScreen(page, 'spaces')).toBeVisible({ timeout: 60_000 });
  await expect(byComponent(page, 'ScreenBase').first()).toBeVisible();
});
