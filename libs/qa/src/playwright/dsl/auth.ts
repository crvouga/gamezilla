import { expect, type Page } from '@playwright/test';

import {
  expectDevIdpChooser,
  expectDevIdpHandoffStarted,
  expectLeftDevIdpChooser,
  pickDevIdpAccount,
  pickFirstDevIdpAccount,
  type DevIdpTestAccount,
} from '../helpers/dev-idp';
import { openUserMenu, openUserMenuAndClick } from '../helpers/chrome-menu';
import {
  confirmSignOut,
  dismissSignInModalSuccess,
  dismissSignOutModalSuccess,
  expectSignInModalResumed,
  expectSignInModalSuccess,
  expectSignOutModalLoading,
  expectSignOutModalSuccess,
} from '../helpers/mutation-phases';

/** High-level auth flows for Playwright specs. */
export class AuthDSL {
  constructor(private readonly page: Page) {}

  /** Menu → dev IdP → account → sign-in success (steps 2–7). */
  async signInWithDevIdp(account?: DevIdpTestAccount): Promise<void> {
    await openUserMenuAndClick(this.page, 'Sign in');
    await this.page
      .getByRole('button', { name: /sign in with dev idp/i })
      .click();
    await expectDevIdpHandoffStarted(this.page);
    await expectDevIdpChooser(this.page);
    if (account !== undefined) {
      await pickDevIdpAccount(this.page, account);
    } else {
      await pickFirstDevIdpAccount(this.page);
    }
    await expectLeftDevIdpChooser(this.page);
    await expectSignInModalResumed(this.page);
    await expectSignInModalSuccess(this.page);
  }

  /** Dismisses the sign-in success modal (step 8); main shell is visible again. */
  async dismissSignInSuccess(): Promise<void> {
    await dismissSignInModalSuccess(this.page);
    await expect(
      this.page.getByRole('heading', { level: 1, name: 'Spaces' }).first()
    ).toBeVisible({ timeout: 30_000 });
  }

  /** Menu → confirm sign-out → loading → success → dismiss (steps 9–11). */
  async signOut(): Promise<void> {
    await openUserMenuAndClick(this.page, 'Sign out');
    await confirmSignOut(this.page);
    await expectSignOutModalLoading(this.page);
    await expectSignOutModalSuccess(this.page);
    await dismissSignOutModalSuccess(this.page);
  }

  /** Signed-out chrome: user menu offers Sign in, not Sign out (step 12). */
  async expectSignedOut(): Promise<void> {
    await openUserMenu(this.page);
    await expect(
      this.page.getByRole('button', { name: 'Sign in' })
    ).toBeVisible();
    await expect(
      this.page.getByRole('button', { name: 'Sign out' })
    ).toHaveCount(0);
  }
}
