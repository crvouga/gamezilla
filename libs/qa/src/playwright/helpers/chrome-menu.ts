import type { Page } from '@playwright/test';

export type UserMenuItem = 'Sign in' | 'Sign out';

/** Opens the header account menu from the avatar trigger. */
export async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'User menu' }).click();
}

/** Clicks a row in the open user menu (menu must already be open). */
export async function clickUserMenuItem(
  page: Page,
  item: UserMenuItem
): Promise<void> {
  await page.getByRole('button', { name: item }).click();
}

/** Opens the user menu and selects a row. */
export async function openUserMenuAndClick(
  page: Page,
  item: UserMenuItem
): Promise<void> {
  await openUserMenu(page);
  await clickUserMenuItem(page, item);
}
