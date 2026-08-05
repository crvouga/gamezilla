import { by, type Driver } from '@pkgs/ui-testing';

export type UserMenuItem = 'Sign in' | 'Sign out' | 'Account' | 'Settings';

/** Opens account actions via the header avatar menu. */
export async function openUserMenu(driver: Driver): Promise<void> {
  await driver.tap(by.testId('account-menu-trigger'));
}

/** Clicks a row in the open user menu (menu must already be open). */
export async function clickUserMenuItem(
  driver: Driver,
  item: UserMenuItem
): Promise<void> {
  await driver.tap(by.role('button', item));
}

/** Opens the user menu and selects a row. */
export async function openUserMenuAndClick(
  driver: Driver,
  item: UserMenuItem
): Promise<void> {
  await openUserMenu(driver);
  await clickUserMenuItem(driver, item);
}
