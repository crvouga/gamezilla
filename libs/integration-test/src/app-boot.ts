import { expect, type Page } from '@playwright/test';

/** Navigates to `/` and waits until the spaces shell is interactive. */
export async function expectAppBooted(page: Page): Promise<void> {
  // Fresh OPFS per spec — avoids expo-sqlite web session-lock flakes under Playwright.
  await page.goto('/?reset-db=1');
  await expect(page.getByTestId('app-root')).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Spaces' }).first()
  ).toBeVisible({ timeout: 60_000 });
}
