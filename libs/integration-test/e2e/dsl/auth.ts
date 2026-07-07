import { clerk } from '@clerk/testing/playwright';
import { expect, type Page } from '@playwright/test';

import { openUserMenu } from '../../src/chrome-menu';

function requireE2eClerkUserEmail(): string {
  const email = process.env['E2E_CLERK_USER_EMAIL']?.trim() ?? '';
  if (email.length === 0) {
    throw new Error(
      'E2E_CLERK_USER_EMAIL must be set for Clerk browser E2E (Infisical dev / CI secrets).'
    );
  }
  return email;
}

/** High-level auth flows for Playwright specs. */
export class AuthDSL {
  constructor(private readonly page: Page) {}

  /** Programmatic Clerk sign-in (bypasses hosted UI). */
  async signIn(): Promise<void> {
    await clerk.signIn({
      page: this.page,
      emailAddress: requireE2eClerkUserEmail(),
    });
    await this.waitForSignedInReplication();
  }

  /** Programmatic Clerk sign-out. */
  async signOut(): Promise<void> {
    await clerk.signOut({ page: this.page });
  }

  /** Waits for auth refresh after sign-in (identity bridge may push zero patches). */
  async waitForSignedInReplication(): Promise<void> {
    await this.page
      .waitForResponse(
        (resp) => resp.url().includes('/auth/refresh') && resp.ok(),
        { timeout: 30_000 }
      )
      .catch(() => undefined);
  }

  /** Signed-out chrome: user menu offers Sign in, not Sign out. */
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
