import type { Page } from '@playwright/test';

/** Matches {@link @pkgs/ui} `BREAKPOINT_MIN_TABLET` — mobile chrome uses overflow, not headerEnd. */
const MOBILE_MAX_WIDTH_PX = 767;

export type UserMenuItem = 'Sign in' | 'Sign out';

function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport !== null && viewport.width <= MOBILE_MAX_WIDTH_PX;
}

/** Opens account actions — header avatar menu (desktop) or overflow (mobile). */
export async function openUserMenu(page: Page): Promise<void> {
  if (isMobileViewport(page)) {
    await page
      .getByTestId('header-overflow-menu')
      .locator('visible=true')
      .click();
    return;
  }
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
