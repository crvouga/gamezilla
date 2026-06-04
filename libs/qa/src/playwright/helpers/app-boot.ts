import { expect, type Page } from '@playwright/test';

/** Navigates to `/` and waits until the spaces shell is interactive. */
export async function expectAppBooted(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Spaces' })
  ).toBeVisible({ timeout: 60_000 });
}
